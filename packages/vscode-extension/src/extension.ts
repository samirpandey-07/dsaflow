import axios from 'axios';
import * as path from 'path';
import * as vscode from 'vscode';

const SECRET_KEY = 'dsaflow-token';
const PENDING_KEY = 'dsaflow-pendingProblems';
const SESSION_COUNT_KEY = 'dsaflow-sessionSolvedCount';
const LAST_PROBLEM_ID_KEY = 'dsaflow-lastSolvedProblemId';
const RECENT_EVENT_TTL_MS = 15_000;
const DEFAULT_API_URL = 'http://localhost:3001/api/problems';
const DEFAULT_DASHBOARD_URL = 'http://localhost:3000';
const DEFAULT_GLOB = '**/*.{cpp,py,java,js,ts}';
const SUPPORTED_LANGUAGE_IDS = new Set(['cpp', 'python', 'java', 'javascript', 'typescript']);

type PendingProblem = {
    problem: string;
    language: string;
    platform: string;
    difficulty: 'Easy' | 'Medium' | 'Hard';
    problem_url: string;
    code_snippet: string;
};

type ExtensionConfig = {
    apiUrl: string;
    dashboardUrl: string;
    watchedGlob: string;
    autoLogOnCreate: boolean;
    promptOnSave: boolean;
    promptForProblemUrl: boolean;
    savePromptDebounceMs: number;
    defaultDifficulty: 'Easy' | 'Medium' | 'Hard';
};

let extensionContext: vscode.ExtensionContext;
let statusBarItem: vscode.StatusBarItem;
let outputChannel: vscode.LogOutputChannel;
let fileWatcher: vscode.FileSystemWatcher | undefined;
let solvedTodayCount = 0;
let lastSolvedProblemId: string | null = null;
let saveDebounceTimer: NodeJS.Timeout | undefined;
const recentEventTimestamps = new Map<string, number>();

export function activate(context: vscode.ExtensionContext) {
    extensionContext = context;
    solvedTodayCount = context.workspaceState.get<number>(SESSION_COUNT_KEY, 0);
    lastSolvedProblemId = context.workspaceState.get<string | null>(LAST_PROBLEM_ID_KEY, null);

    outputChannel = vscode.window.createOutputChannel('DSAFlow', { log: true });
    outputChannel.info('DSAFlow extension activated.');

    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    statusBarItem.command = 'dsaflow.openDashboard';
    updateStatusBar('Ready');
    statusBarItem.show();

    const subscriptions: vscode.Disposable[] = [
        statusBarItem,
        outputChannel,
        registerCommands(context),
        vscode.workspace.onDidChangeConfiguration((event) => {
            if (event.affectsConfiguration('dsaflow')) {
                outputChannel.info('Configuration changed. Restarting watcher with latest settings.');
                restartWatcher(context);
            }
        }),
    ];

    context.subscriptions.push(...subscriptions);
    context.subscriptions.push(vscode.window.registerUriHandler({ handleUri: (uri) => handleAuthUri(uri, context) }));

    void retryPendingProblems(context, { silentWhenEmpty: true });
    startWatcher(context);
}

function registerCommands(context: vscode.ExtensionContext): vscode.Disposable {
    const commands = [
        vscode.commands.registerCommand('dsaflow.startTracking', () => {
            startWatcher(context, true);
            return vscode.window.showInformationMessage('DSAFlow tracking started.');
        }),
        vscode.commands.registerCommand('dsaflow.stopTracking', () => {
            disposeWatcher();
            updateStatusBar('Paused', 'warning');
            return vscode.window.showInformationMessage('DSAFlow tracking paused.');
        }),
        vscode.commands.registerCommand('dsaflow.openDashboard', async () => {
            const config = getConfig();
            await vscode.env.openExternal(vscode.Uri.parse(config.dashboardUrl));
        }),
        vscode.commands.registerCommand('dsaflow.login', async () => {
            const loginUrl = buildLoginUrl(context);
            outputChannel.info(`Opening login URL: ${loginUrl}`);
            await vscode.env.openExternal(vscode.Uri.parse(loginUrl));
            void vscode.window.showInformationMessage('DSAFlow opened the browser for sign-in.');
        }),
        vscode.commands.registerCommand('dsaflow.logout', async () => {
            await context.secrets.delete(SECRET_KEY);
            await context.globalState.update(PENDING_KEY, []);
            outputChannel.info('Stored token and pending queue cleared.');
            void vscode.window.showInformationMessage('DSAFlow signed out and cleared its offline queue.');
        }),
        vscode.commands.registerCommand('dsaflow.addNote', async () => {
            if (!lastSolvedProblemId) {
                void vscode.window.showWarningMessage('No recently logged problem is available for notes yet.');
                return;
            }

            await promptForNote(lastSolvedProblemId);
        }),
        vscode.commands.registerCommand('dsaflow.viewStats', async () => {
            await showStatsWebview(context);
        }),
        vscode.commands.registerCommand('dsaflow.retryPendingSync', async () => {
            await retryPendingProblems(context);
        }),
    ];

    return vscode.Disposable.from(...commands);
}

function buildLoginUrl(context: vscode.ExtensionContext): string {
    const config = getConfig();
    const dashboardUrl = config.dashboardUrl.replace('localhost', '127.0.0.1');
    return `${dashboardUrl}/login?source=vscode&scheme=${vscode.env.uriScheme}&extId=${context.extension.id}`;
}

async function handleAuthUri(uri: vscode.Uri, context: vscode.ExtensionContext): Promise<void> {
    outputChannel.info(`Received auth callback: ${uri.toString(true)}`);
    if (uri.path !== '/auth') {
        return;
    }

    const params = new URLSearchParams(uri.query);
    const token = params.get('token');

    if (!token) {
        void vscode.window.showErrorMessage('DSAFlow login failed because no token was returned.');
        return;
    }

    await context.secrets.store(SECRET_KEY, token);
    outputChannel.info('Access token stored in VS Code SecretStorage.');
    void vscode.window.showInformationMessage('DSAFlow connected successfully.');
    void retryPendingProblems(context, { silentWhenEmpty: true });
}

function startWatcher(context: vscode.ExtensionContext, forceRestart = false): void {
    const config = getConfig();

    if (fileWatcher && !forceRestart) {
        return;
    }

    disposeWatcher();
    fileWatcher = vscode.workspace.createFileSystemWatcher(config.watchedGlob);

    fileWatcher.onDidCreate((uri) => {
        if (!config.autoLogOnCreate) {
            outputChannel.info(`Skipping create event because autoLogOnCreate is disabled: ${uri.fsPath}`);
            return;
        }

        void handleCandidateFile(uri, context, 'create');
    });

    const saveListener = vscode.workspace.onDidSaveTextDocument((document) => {
        if (!config.promptOnSave || !SUPPORTED_LANGUAGE_IDS.has(document.languageId)) {
            return;
        }

        if (saveDebounceTimer) {
            clearTimeout(saveDebounceTimer);
        }

        saveDebounceTimer = setTimeout(() => {
            void promptToLogSavedDocument(document, context);
        }, config.savePromptDebounceMs);
    });

    context.subscriptions.push(fileWatcher, saveListener);
    updateStatusBar('Watching', 'pulse');
    outputChannel.info(`Watching files with glob: ${config.watchedGlob}`);
}

function restartWatcher(context: vscode.ExtensionContext): void {
    startWatcher(context, true);
}

function disposeWatcher(): void {
    if (fileWatcher) {
        fileWatcher.dispose();
        fileWatcher = undefined;
    }

    if (saveDebounceTimer) {
        clearTimeout(saveDebounceTimer);
        saveDebounceTimer = undefined;
    }
}

async function promptToLogSavedDocument(
    document: vscode.TextDocument,
    context: vscode.ExtensionContext,
): Promise<void> {
    const action = await vscode.window.showInformationMessage(
        `Log ${path.basename(document.fileName)} to DSAFlow?`,
        'Log Problem',
        'Dismiss',
    );

    if (action === 'Log Problem') {
        await handleCandidateFile(document.uri, context, 'save');
    }
}

async function handleCandidateFile(
    uri: vscode.Uri,
    context: vscode.ExtensionContext,
    source: 'create' | 'save',
): Promise<void> {
    try {
        const config = getConfig();
        const token = await context.secrets.get(SECRET_KEY);

        if (!config.apiUrl) {
            void vscode.window.showErrorMessage('DSAFlow is missing its API URL. Update "dsaflow.apiUrl" in Settings.');
            return;
        }

        if (!token) {
            const action = await vscode.window.showWarningMessage(
                'DSAFlow needs you to sign in before it can log problems.',
                'Login',
                'Later',
            );
            if (action === 'Login') {
                await vscode.commands.executeCommand('dsaflow.login');
            }
            return;
        }

        const eventKey = `${source}:${uri.fsPath}`;
        if (isDuplicateEvent(eventKey)) {
            outputChannel.info(`Ignoring duplicate ${source} event for ${uri.fsPath}`);
            return;
        }

        const payload = await buildProblemPayload(uri, config);
        if (!payload) {
            return;
        }

        await submitProblem(payload, context, token, config.apiUrl);
    } catch (error) {
        outputChannel.error(`Unexpected error while handling file ${uri.fsPath}: ${toMessage(error)}`);
        void vscode.window.showErrorMessage('DSAFlow hit an unexpected error while preparing your problem log.');
    }
}

async function buildProblemPayload(uri: vscode.Uri, config: ExtensionConfig): Promise<PendingProblem | undefined> {
    const filePath = uri.fsPath;
    const fileName = path.basename(filePath);
    const extension = path.extname(fileName);
    const problemName = path.basename(fileName, extension);
    const topic = path.basename(path.dirname(filePath));
    const language = mapLanguage(extension);

    if (!problemName || !topic || language === 'Unknown') {
        void vscode.window.showWarningMessage('DSAFlow could not infer the problem details from this file.');
        return undefined;
    }

    const problemUrl = config.promptForProblemUrl
        ? await vscode.window.showInputBox({
            prompt: 'Paste the problem URL if you have it',
            placeHolder: 'https://leetcode.com/problems/two-sum',
            ignoreFocusOut: true,
            validateInput: (value) => {
                if (!value.trim()) {
                    return undefined;
                }

                try {
                    new URL(value);
                    return undefined;
                } catch {
                    return 'Enter a valid URL or leave it blank.';
                }
            },
        })
        : '';

    const codeSnippet = await readDocumentText(uri);
    const platform = detectPlatform(problemUrl ?? '');

    return {
        topic,
        problem: problemName,
        language,
        platform,
        difficulty: config.defaultDifficulty,
        problem_url: problemUrl?.trim() ?? '',
        code_snippet: codeSnippet,
    };
}

async function readDocumentText(uri: vscode.Uri): Promise<string> {
    try {
        const document = await vscode.workspace.openTextDocument(uri);
        return document.getText();
    } catch (error) {
        outputChannel.warn(`Unable to read document text for ${uri.fsPath}: ${toMessage(error)}`);
        return '';
    }
}

async function submitProblem(
    payload: PendingProblem,
    context: vscode.ExtensionContext,
    token: string,
    apiUrl: string,
): Promise<void> {
    try {
        const response = await axios.post(apiUrl, payload, {
            headers: { Authorization: `Bearer ${token}` },
            timeout: 15_000,
        });

        const wasCreated = String(response.headers['x-dsaflow-created'] ?? 'true').toLowerCase() !== 'false';
        const problemId = response.data?.data?.id ?? response.data?.data?.[0]?.id ?? null;
        if (wasCreated) {
            solvedTodayCount += 1;
            lastSolvedProblemId = problemId;
            await context.workspaceState.update(SESSION_COUNT_KEY, solvedTodayCount);
            await context.workspaceState.update(LAST_PROBLEM_ID_KEY, lastSolvedProblemId);
            updateStatusBar(`${solvedTodayCount} solved this session`, 'check');
        } else {
            updateStatusBar(`${solvedTodayCount} solved this session`, 'check');
        }

        if (problemId) {
            if (wasCreated) {
                const action = await vscode.window.showInformationMessage(
                    `Logged ${payload.problem} in ${payload.topic}. Add a note?`,
                    'Add Note',
                    'Done',
                );

                if (action === 'Add Note') {
                    await promptForNote(problemId);
                }
            } else {
                void vscode.window.showInformationMessage(`DSAFlow already logged ${payload.problem}.`);
            }
        } else {
            void vscode.window.showInformationMessage(
                wasCreated ? `DSAFlow logged ${payload.problem}.` : `DSAFlow already logged ${payload.problem}.`,
            );
        }
    } catch (error) {
        await queueProblem(context, payload);
        const status = axios.isAxiosError(error) ? error.response?.status : undefined;

        if (status === 401) {
            void vscode.window.showErrorMessage('DSAFlow could not authenticate. Please run "DSAFlow: Login" again.');
        } else if (status === 429) {
            void vscode.window.showWarningMessage('DSAFlow is rate limited right now. Your problem was saved for retry.');
        } else {
            void vscode.window.showWarningMessage('DSAFlow could not reach the API. Your problem was saved for retry.');
        }

        outputChannel.warn(`Problem queued for retry because submit failed: ${toMessage(error)}`);
    }
}

async function queueProblem(context: vscode.ExtensionContext, payload: PendingProblem): Promise<void> {
    const pending = context.globalState.get<PendingProblem[]>(PENDING_KEY, []);
    pending.push(payload);
    await context.globalState.update(PENDING_KEY, pending);
}

async function retryPendingProblems(
    context: vscode.ExtensionContext,
    options: { silentWhenEmpty?: boolean } = {},
): Promise<void> {
    const pending = context.globalState.get<PendingProblem[]>(PENDING_KEY, []);

    if (pending.length === 0) {
        if (!options.silentWhenEmpty) {
            void vscode.window.showInformationMessage('DSAFlow has no pending problems to sync.');
        }
        return;
    }

    const token = await context.secrets.get(SECRET_KEY);
    const config = getConfig();

    if (!token) {
        void vscode.window.showWarningMessage('DSAFlow still has pending problems, but you need to log in before syncing.');
        return;
    }

    updateStatusBar('Syncing queue', 'sync');
    const stillPending: PendingProblem[] = [];

    for (const item of pending) {
        try {
            await axios.post(config.apiUrl, item, {
                headers: { Authorization: `Bearer ${token}` },
                timeout: 15_000,
            });
        } catch (error) {
            stillPending.push(item);
            outputChannel.warn(`Pending item sync failed for ${item.problem}: ${toMessage(error)}`);
        }
    }

    await context.globalState.update(PENDING_KEY, stillPending);
    updateStatusBar(`${solvedTodayCount} solved this session`, 'check');

    const syncedCount = pending.length - stillPending.length;
    if (syncedCount > 0) {
        void vscode.window.showInformationMessage(`DSAFlow synced ${syncedCount} pending problem(s).`);
    } else if (!options.silentWhenEmpty) {
        void vscode.window.showWarningMessage('DSAFlow could not sync pending problems yet.');
    }
}

async function promptForNote(problemId: string): Promise<void> {
    const noteInput = await vscode.window.showInputBox({
        prompt: 'Add your note for this problem',
        placeHolder: 'Edge cases, time complexity, gotchas, or the trick you want to remember',
        ignoreFocusOut: true,
    });

    if (!noteInput?.trim()) {
        return;
    }

    const token = await extensionContext.secrets.get(SECRET_KEY);
    const apiUrl = getConfig().apiUrl;

    if (!token || !apiUrl) {
        void vscode.window.showErrorMessage('DSAFlow could not save the note because the extension is not fully configured.');
        return;
    }

    const notesUrl = apiUrl.replace(/\/problems\/?$/, '/notes');

    try {
        await axios.post(
            notesUrl,
            { problem_id: problemId, note: noteInput.trim() },
            { headers: { Authorization: `Bearer ${token}` }, timeout: 15_000 },
        );

        void vscode.window.showInformationMessage('DSAFlow saved your note.');
    } catch (error) {
        outputChannel.error(`Failed to save note for ${problemId}: ${toMessage(error)}`);
        void vscode.window.showErrorMessage('DSAFlow could not save the note right now.');
    }
}

async function showStatsWebview(context: vscode.ExtensionContext): Promise<void> {
    const token = await context.secrets.get(SECRET_KEY);
    const apiUrl = getConfig().apiUrl.replace(/\/problems\/?$/, '/stats');

    let statsHtml = '<p style="color:#8b8f98">No stats are available yet. Log your first problem to get started.</p>';

    if (token) {
        try {
            const response = await axios.get(apiUrl, {
                headers: { Authorization: `Bearer ${token}` },
                timeout: 15_000,
            });
            const stats = response.data;

            statsHtml = `
                <div class="stats-grid">
                    <div class="card"><div class="num">${stats.solved ?? 0}</div><div class="label">Total solved</div></div>
                    <div class="card easy"><div class="num">${stats.easy ?? 0}</div><div class="label">Easy</div></div>
                    <div class="card med"><div class="num">${stats.medium ?? 0}</div><div class="label">Medium</div></div>
                    <div class="card hard"><div class="num">${stats.hard ?? 0}</div><div class="label">Hard</div></div>
                </div>
            `;
        } catch (error) {
            outputChannel.warn(`Unable to fetch stats: ${toMessage(error)}`);
        }
    }

    const panel = vscode.window.createWebviewPanel('dsaflowStats', 'DSAFlow Stats', vscode.ViewColumn.Beside, {});

    panel.webview.html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>DSAFlow Stats</title>
<style>
    :root {
        color-scheme: dark;
        --bg: #0c111b;
        --card: rgba(255, 255, 255, 0.06);
        --border: rgba(255, 255, 255, 0.12);
        --muted: #8b8f98;
        --text: #f6f7fb;
        --accent: #50e3c2;
        --easy: #5cb4ff;
        --medium: #ffaf45;
        --hard: #ff7575;
    }

    * { box-sizing: border-box; }
    body {
        margin: 0;
        font-family: "Segoe UI", system-ui, sans-serif;
        background:
            radial-gradient(circle at top, rgba(80, 227, 194, 0.16), transparent 32%),
            linear-gradient(180deg, #111827 0%, #0c111b 100%);
        color: var(--text);
        padding: 28px;
    }

    h1 {
        margin: 0;
        font-size: 28px;
        line-height: 1.1;
    }

    .sub {
        color: var(--muted);
        margin: 8px 0 24px;
    }

    .stats-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 14px;
    }

    .card {
        background: var(--card);
        border: 1px solid var(--border);
        border-radius: 18px;
        padding: 18px;
        backdrop-filter: blur(10px);
    }

    .card.easy { border-color: rgba(92, 180, 255, 0.35); }
    .card.med { border-color: rgba(255, 175, 69, 0.35); }
    .card.hard { border-color: rgba(255, 117, 117, 0.35); }

    .num {
        font-size: 38px;
        font-weight: 800;
        letter-spacing: -0.04em;
    }

    .label {
        margin-top: 6px;
        color: var(--muted);
        font-size: 12px;
        text-transform: uppercase;
        letter-spacing: 0.12em;
    }

    .session {
        margin-top: 18px;
        border: 1px solid var(--border);
        border-radius: 16px;
        padding: 16px;
        background: rgba(255, 255, 255, 0.03);
        color: var(--muted);
    }

    strong { color: var(--text); }
</style>
</head>
<body>
    <h1>DSAFlow</h1>
    <p class="sub">Track your solved problems without leaving VS Code.</p>
    ${statsHtml}
    <div class="session">This VS Code session: <strong>${solvedTodayCount} solved</strong></div>
</body>
</html>`;
}

function getConfig(): ExtensionConfig {
    const config = vscode.workspace.getConfiguration('dsaflow');

    return {
        apiUrl: config.get<string>('apiUrl', DEFAULT_API_URL),
        dashboardUrl: config.get<string>('dashboardUrl', DEFAULT_DASHBOARD_URL),
        watchedGlob: config.get<string>('watchedGlob', DEFAULT_GLOB),
        autoLogOnCreate: config.get<boolean>('autoLogOnCreate', true),
        promptOnSave: config.get<boolean>('promptOnSave', true),
        promptForProblemUrl: config.get<boolean>('promptForProblemUrl', true),
        savePromptDebounceMs: Math.max(config.get<number>('savePromptDebounceMs', 1500), 250),
        defaultDifficulty: config.get<'Easy' | 'Medium' | 'Hard'>('defaultDifficulty', 'Medium'),
    };
}

function detectPlatform(problemUrl: string): string {
    const lower = problemUrl.toLowerCase();
    if (!lower) {
        return 'Other';
    }

    if (lower.includes('leetcode.com')) {
        return 'LeetCode';
    }
    if (lower.includes('geeksforgeeks.org')) {
        return 'GeeksforGeeks';
    }
    if (lower.includes('codeforces.com')) {
        return 'Codeforces';
    }
    if (lower.includes('hackerrank.com')) {
        return 'HackerRank';
    }
    return 'Other';
}

function mapLanguage(extension: string): string {
    switch (extension) {
    case '.cpp':
        return 'C++';
    case '.py':
        return 'Python';
    case '.java':
        return 'Java';
    case '.js':
        return 'JavaScript';
    case '.ts':
        return 'TypeScript';
    default:
        return 'Unknown';
    }
}

function updateStatusBar(text: string, icon: 'pulse' | 'warning' | 'check' | 'sync' = 'pulse'): void {
    const codicon = {
        pulse: '$(pulse)',
        warning: '$(warning)',
        check: '$(check)',
        sync: '$(sync~spin)',
    }[icon];

    statusBarItem.text = `${codicon} DSAFlow ${text}`;
    statusBarItem.tooltip = 'Open the DSAFlow dashboard';
}

function isDuplicateEvent(eventKey: string): boolean {
    const now = Date.now();
    const lastSeen = recentEventTimestamps.get(eventKey);
    recentEventTimestamps.set(eventKey, now);

    for (const [key, timestamp] of recentEventTimestamps.entries()) {
        if (now - timestamp > RECENT_EVENT_TTL_MS) {
            recentEventTimestamps.delete(key);
        }
    }

    return typeof lastSeen === 'number' && now - lastSeen < RECENT_EVENT_TTL_MS;
}

function toMessage(error: unknown): string {
    if (error instanceof Error) {
        return error.message;
    }
    return String(error);
}

export function deactivate(): void {
    disposeWatcher();
}
