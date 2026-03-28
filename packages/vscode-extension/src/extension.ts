import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import * as vscode from 'vscode';
import { DSAFlowSidebarProvider, type SidebarProblem, type SidebarSnapshot } from './sidebar';

const SECRET_KEY = 'dsaflow-token';
const PENDING_KEY = 'dsaflow-pendingProblems';
const SESSION_COUNT_KEY = 'dsaflow-sessionSolvedCount';
const LAST_PROBLEM_ID_KEY = 'dsaflow-lastSolvedProblemId';
const AUTO_AUTH_LAST_OPENED_KEY = 'dsaflow-autoAuthLastOpenedAt';
const FILE_INDEX_KEY = 'dsaflow-fileIndex';
const WORKSPACE_IMPORT_PREFIX = 'dsaflow-workspaceImport';
const RECENT_EVENT_TTL_MS = 15_000;
const AUTO_AUTH_COOLDOWN_MS = 6 * 60 * 60 * 1000;
const SIDEBAR_REFRESH_INTERVAL_MS = 5 * 60 * 1000;
const DEFAULT_API_URL = 'https://dsaflow.onrender.com/api/problems';
const DEFAULT_DASHBOARD_URL = 'https://dsaflow-dashboard.vercel.app';
const DEFAULT_GLOB = '**/*.{cpp,py,java,js,ts}';
const DEFAULT_WORKSPACE_CONFIG_FILE = '.dsaflow.json';
const SUPPORTED_LANGUAGE_IDS = new Set(['cpp', 'python', 'java', 'javascript', 'typescript']);
const KNOWN_TOPIC_TAGS = [
    'arrays',
    'strings',
    'hashmap',
    'hashing',
    'dp',
    'dynamic programming',
    'graph',
    'graphs',
    'tree',
    'trees',
    'linked list',
    'linkedlist',
    'binary search',
    'greedy',
    'backtracking',
    'two pointers',
    'sliding window',
    'heap',
    'stack',
    'queue',
    'recursion',
    'math',
    'prefix sum',
    'bit manipulation',
    'trie',
];

type PendingProblem = {
    problem: string;
    topic: string;
    language: string;
    platform: string;
    difficulty: 'Easy' | 'Medium' | 'Hard';
    problem_url: string;
    code_snippet: string;
    tags: string[];
    local_path?: string;
};

type ExtensionConfig = {
    apiUrl: string;
    dashboardUrl: string;
    watchedGlob: string;
    requireFolderApproval: boolean;
    workspaceConfigFile: string;
    autoLogOnCreate: boolean;
    promptOnSave: boolean;
    promptForProblemUrl: boolean;
    savePromptDebounceMs: number;
    defaultDifficulty: 'Easy' | 'Medium' | 'Hard';
    autoImportOnFirstRun: boolean;
    showLearningCardAfterLog: boolean;
};

type ApiProblem = {
    id: string;
    problem_name: string;
    topic: string;
    difficulty: string;
    language: string;
    platform: string;
    problem_url: string | null;
    tags?: string[];
    solved_at: string;
    revision_count: number;
    next_revision_at: string | null;
};

type OverviewData = {
    solved_today: number;
    current_streak: number;
    revision_due: number;
};

type RevisionQueueData = {
    due_today: ApiProblem[];
    overdue: ApiProblem[];
};

type InsightsData = {
    strongest_topic?: string | null;
    weak_topics?: Array<{ topic: string; count: number }>;
    next_problem_suggestion?: string;
};

type Achievement = {
    title: string;
    unlocked: boolean;
};

type ResolvedMetadata = {
    problem: string;
    topic: string;
    difficulty: 'Easy' | 'Medium' | 'Hard';
    platform: string;
    problem_url: string;
    tags: string[];
};

type FolderTrackingConfig = {
    trackedFolders: string[];
    ignoredFolders: string[];
};

let extensionContext: vscode.ExtensionContext;
let statusBarItem: vscode.StatusBarItem;
let outputChannel: vscode.LogOutputChannel;
let fileWatcher: vscode.FileSystemWatcher | undefined;
let sidebarProvider: DSAFlowSidebarProvider;
let solvedTodayCount = 0;
let lastSolvedProblemId: string | null = null;
let saveDebounceTimer: NodeJS.Timeout | undefined;
const recentEventTimestamps = new Map<string, number>();
const sessionSkippedFolderPrompts = new Set<string>();
let latestSnapshot: SidebarSnapshot = {
    authenticated: false,
    today: 0,
    streak: 0,
    revisionDue: 0,
    pendingCount: 0,
    syncLabel: 'Sign in required',
    weakTopics: [],
    achievements: [],
    dueRevisions: [],
    recentProblems: [],
};
let currentSyncState: 'synced' | 'queued' | 'syncing' | 'offline' | 'auth' = 'auth';

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

    sidebarProvider = new DSAFlowSidebarProvider();
    const sidebarView = vscode.window.createTreeView('dsaflow.sidebar', {
        treeDataProvider: sidebarProvider,
        showCollapseAll: true,
    });
    context.subscriptions.push(sidebarView);

    const subscriptions: vscode.Disposable[] = [
        statusBarItem,
        outputChannel,
        registerCommands(context),
        vscode.workspace.onDidChangeConfiguration((event) => {
            if (event.affectsConfiguration('dsaflow')) {
                outputChannel.info('Configuration changed. Restarting watcher with latest settings.');
                restartWatcher(context);
                void refreshStudentSnapshot(context);
            }
        }),
    ];

    context.subscriptions.push(...subscriptions);
    context.subscriptions.push(vscode.window.registerUriHandler({ handleUri: (uri) => handleAuthUri(uri, context) }));

    void retryPendingProblems(context, { silentWhenEmpty: true });
    startWatcher(context);
    void maybeStartAutomaticAuthentication(context, 'activate');
    void refreshStudentSnapshot(context);
    void maybeOfferWorkspaceImport(context);

    const refreshTimer = setInterval(() => {
        void refreshStudentSnapshot(context);
    }, SIDEBAR_REFRESH_INTERVAL_MS);
    context.subscriptions.push({
        dispose: () => clearInterval(refreshTimer),
    });
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
            await openLogin(context, { automatic: false, reason: 'command' });
        }),
        vscode.commands.registerCommand('dsaflow.logout', async () => {
            await context.secrets.delete(SECRET_KEY);
            await context.globalState.update(PENDING_KEY, []);
            currentSyncState = 'auth';
            outputChannel.info('Stored token and pending queue cleared.');
            await refreshStudentSnapshot(context);
            void vscode.window.showInformationMessage('DSAFlow signed out and cleared its offline queue.');
        }),
        vscode.commands.registerCommand('dsaflow.addNote', async (problem?: SidebarProblem) => {
            const targetProblemId = problem?.id || lastSolvedProblemId;
            if (!targetProblemId) {
                void vscode.window.showWarningMessage('No recently logged problem is available for notes yet.');
                return;
            }

            await promptForNote(targetProblemId);
        }),
        vscode.commands.registerCommand('dsaflow.viewStats', async () => {
            await showStatsWebview(context);
        }),
        vscode.commands.registerCommand('dsaflow.retryPendingSync', async () => {
            await retryPendingProblems(context);
        }),
        vscode.commands.registerCommand('dsaflow.refreshSidebar', async () => {
            await refreshStudentSnapshot(context, { notify: true });
        }),
        vscode.commands.registerCommand('dsaflow.importWorkspace', async () => {
            await importWorkspaceHistory(context, { firstRun: false });
        }),
        vscode.commands.registerCommand('dsaflow.manageTrackedFolders', async () => {
            await manageTrackedFolders(context);
        }),
        vscode.commands.registerCommand('dsaflow.addTrackedFolder', async () => {
            await addTrackedFolder(context);
        }),
        vscode.commands.registerCommand('dsaflow.removeTrackedFolder', async () => {
            await removeTrackedFolder(context);
        }),
        vscode.commands.registerCommand('dsaflow.logCurrentFile', async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                void vscode.window.showWarningMessage('Open a solution file first.');
                return;
            }

            await handleCandidateFile(editor.document.uri, context, 'manual');
        }),
        vscode.commands.registerCommand('dsaflow.openProblemItem', async (problem?: SidebarProblem) => {
            if (problem) {
                await openSidebarProblem(problem);
            }
        }),
        vscode.commands.registerCommand('dsaflow.completeRevision', async (problem?: SidebarProblem) => {
            if (!problem?.id) {
                return;
            }
            await reviseProblemFromSidebar(problem.id, 'complete');
        }),
        vscode.commands.registerCommand('dsaflow.snoozeRevision', async (problem?: SidebarProblem) => {
            if (!problem?.id) {
                return;
            }
            await reviseProblemFromSidebar(problem.id, 'snooze');
        }),
        vscode.commands.registerCommand('dsaflow.showLearningCard', async (problem?: SidebarProblem) => {
            const targetProblemId = problem?.id || lastSolvedProblemId;
            if (!targetProblemId) {
                void vscode.window.showWarningMessage('No logged problem is available for a learning card yet.');
                return;
            }

            await showLearningCard(targetProblemId, problem?.problemName);
        }),
    ];

    return vscode.Disposable.from(...commands);
}

function buildLoginUrl(context: vscode.ExtensionContext): string {
    const config = getConfig();
    const dashboardUrl = config.dashboardUrl.replace('localhost', '127.0.0.1');
    return `${dashboardUrl}/login?source=vscode&scheme=${vscode.env.uriScheme}&extId=${context.extension.id}`;
}

async function openLogin(
    context: vscode.ExtensionContext,
    options: { automatic: boolean; reason: 'activate' | 'command' | 'required' },
): Promise<void> {
    const loginUrl = buildLoginUrl(context);
    outputChannel.info(`Opening login URL (${options.reason}): ${loginUrl}`);
    await vscode.env.openExternal(vscode.Uri.parse(loginUrl));

    if (options.automatic) {
        updateStatusBar('Waiting for sign-in', 'sync');
        void vscode.window.showInformationMessage('DSAFlow opened the browser to connect your account.');
    } else {
        void vscode.window.showInformationMessage('DSAFlow opened the browser for sign-in.');
    }
}

async function maybeStartAutomaticAuthentication(
    context: vscode.ExtensionContext,
    reason: 'activate' | 'required',
): Promise<void> {
    const token = await context.secrets.get(SECRET_KEY);
    if (token) {
        return;
    }

    const lastOpenedAt = context.globalState.get<number>(AUTO_AUTH_LAST_OPENED_KEY, 0);
    if (Date.now() - lastOpenedAt < AUTO_AUTH_COOLDOWN_MS) {
        outputChannel.info(`Skipping automatic auth redirect because it was opened recently (${reason}).`);
        currentSyncState = 'auth';
        updateStatusBar('Sign in required', 'warning');
        return;
    }

    await context.globalState.update(AUTO_AUTH_LAST_OPENED_KEY, Date.now());
    await openLogin(context, { automatic: true, reason });
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
    await context.globalState.update(AUTO_AUTH_LAST_OPENED_KEY, 0);
    outputChannel.info('Access token stored in VS Code SecretStorage.');
    currentSyncState = 'synced';
    void vscode.window.showInformationMessage('DSAFlow connected successfully.');
    void retryPendingProblems(context, { silentWhenEmpty: true });
    void refreshStudentSnapshot(context);
    void maybeOfferWorkspaceImport(context);
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

function normalizeFolderPath(folderPath: string): string {
    const normalized = folderPath.replace(/\\/g, '/').replace(/^\.\/+/, '').replace(/^\/+|\/+$/g, '').trim();
    return normalized || '.';
}

function getWorkspaceRootForUri(uri: vscode.Uri): string | null {
    return vscode.workspace.getWorkspaceFolder(uri)?.uri.fsPath || null;
}

function getRelativeFolderForUri(uri: vscode.Uri): string | null {
    const workspaceRoot = getWorkspaceRootForUri(uri);
    if (!workspaceRoot) {
        return null;
    }

    const relativeFilePath = path.relative(workspaceRoot, uri.fsPath);
    return normalizeFolderPath(path.dirname(relativeFilePath));
}

function getWorkspaceConfigPath(workspaceRoot: string, config: ExtensionConfig): string {
    return path.join(workspaceRoot, config.workspaceConfigFile || DEFAULT_WORKSPACE_CONFIG_FILE);
}

function readFolderTrackingConfig(workspaceRoot: string, config: ExtensionConfig): FolderTrackingConfig {
    const configPath = getWorkspaceConfigPath(workspaceRoot, config);

    if (!fs.existsSync(configPath)) {
        return { trackedFolders: [], ignoredFolders: [] };
    }

    try {
        const raw = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        return {
            trackedFolders: Array.isArray(raw?.trackedFolders) ? raw.trackedFolders.map((value: string) => normalizeFolderPath(String(value))) : [],
            ignoredFolders: Array.isArray(raw?.ignoredFolders) ? raw.ignoredFolders.map((value: string) => normalizeFolderPath(String(value))) : [],
        };
    } catch (error) {
        outputChannel.warn(`Failed to read ${config.workspaceConfigFile}: ${toMessage(error)}`);
        return { trackedFolders: [], ignoredFolders: [] };
    }
}

async function writeFolderTrackingConfig(
    workspaceRoot: string,
    config: ExtensionConfig,
    tracking: FolderTrackingConfig,
): Promise<void> {
    const configPath = getWorkspaceConfigPath(workspaceRoot, config);
    const payload = {
        trackedFolders: [...new Set(tracking.trackedFolders.map((value) => normalizeFolderPath(value)))].sort(),
        ignoredFolders: [...new Set(tracking.ignoredFolders.map((value) => normalizeFolderPath(value)))].sort(),
    };

    await fs.promises.writeFile(configPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

function folderRuleMatches(rule: string, relativeFolder: string): boolean {
    const normalizedRule = normalizeFolderPath(rule);
    const normalizedFolder = normalizeFolderPath(relativeFolder);

    return normalizedRule === '.'
        || normalizedFolder === normalizedRule
        || normalizedFolder.startsWith(`${normalizedRule}/`);
}

function isFolderTracked(relativeFolder: string, tracking: FolderTrackingConfig): boolean {
    return tracking.trackedFolders.some((rule) => folderRuleMatches(rule, relativeFolder));
}

function isFolderIgnored(relativeFolder: string, tracking: FolderTrackingConfig): boolean {
    return tracking.ignoredFolders.some((rule) => folderRuleMatches(rule, relativeFolder));
}

async function ensureFolderPermission(
    uri: vscode.Uri,
    context: vscode.ExtensionContext,
    config: ExtensionConfig,
    source: 'create' | 'save' | 'manual',
): Promise<boolean> {
    if (!config.requireFolderApproval) {
        return true;
    }

    const workspaceRoot = getWorkspaceRootForUri(uri);
    const relativeFolder = getRelativeFolderForUri(uri);
    if (!workspaceRoot || !relativeFolder) {
        void vscode.window.showWarningMessage('Open the file inside a workspace folder before logging with DSAFlow.');
        return false;
    }

    const tracking = readFolderTrackingConfig(workspaceRoot, config);
    const promptKey = `${workspaceRoot}::${relativeFolder}`;
    if (isFolderTracked(relativeFolder, tracking)) {
        sessionSkippedFolderPrompts.delete(promptKey);
        return true;
    }
    if (isFolderIgnored(relativeFolder, tracking)) {
        outputChannel.info(`Skipping ${uri.fsPath} because folder "${relativeFolder}" is blocked in ${config.workspaceConfigFile}.`);
        return false;
    }
    if (sessionSkippedFolderPrompts.has(promptKey)) {
        return false;
    }

    const action = await vscode.window.showInformationMessage(
        `Allow DSAFlow to ${source === 'manual' ? 'log files from' : 'auto-log files in'} "${relativeFolder}"?`,
        'Allow Folder',
        'Not Now',
        'Never For This Folder',
    );

    if (action === 'Allow Folder') {
        tracking.trackedFolders.push(relativeFolder);
        tracking.ignoredFolders = tracking.ignoredFolders.filter((folder) => folder !== relativeFolder);
        await writeFolderTrackingConfig(workspaceRoot, config, tracking);
        sessionSkippedFolderPrompts.delete(promptKey);
        await refreshStudentSnapshot(context);
        void vscode.window.showInformationMessage(`DSAFlow will now log files inside "${relativeFolder}".`);
        return true;
    }

    if (action === 'Never For This Folder') {
        tracking.ignoredFolders.push(relativeFolder);
        await writeFolderTrackingConfig(workspaceRoot, config, tracking);
        sessionSkippedFolderPrompts.delete(promptKey);
        return false;
    }

    sessionSkippedFolderPrompts.add(promptKey);
    return false;
}

async function handleCandidateFile(
    uri: vscode.Uri,
    context: vscode.ExtensionContext,
    source: 'create' | 'save' | 'manual',
): Promise<void> {
    try {
        const config = getConfig();
        const allowed = await ensureFolderPermission(uri, context, config, source);
        if (!allowed) {
            return;
        }
        const token = await context.secrets.get(SECRET_KEY);

        if (!config.apiUrl) {
            void vscode.window.showErrorMessage('DSAFlow is missing its API URL. Update "dsaflow.apiUrl" in Settings.');
            return;
        }

        if (!token) {
            updateStatusBar('Sign in required', 'warning');
            void maybeStartAutomaticAuthentication(context, 'required');
            void vscode.window.showWarningMessage('DSAFlow is redirecting you to sign in before logging problems.');
            return;
        }

        const eventKey = `${source}:${uri.fsPath}`;
        if (isDuplicateEvent(eventKey)) {
            outputChannel.info(`Ignoring duplicate ${source} event for ${uri.fsPath}`);
            return;
        }

        const payload = await buildProblemPayload(uri, config, {
            token,
            interactive: false,
            silent: false,
        });
        if (!payload) {
            return;
        }

        await submitProblem(payload, context, token, config.apiUrl);
    } catch (error) {
        outputChannel.error(`Unexpected error while handling file ${uri.fsPath}: ${toMessage(error)}`);
        void vscode.window.showErrorMessage('DSAFlow hit an unexpected error while preparing your problem log.');
    }
}

async function buildProblemPayload(
    uri: vscode.Uri,
    config: ExtensionConfig,
    options: {
        token?: string;
        interactive?: boolean;
        silent?: boolean;
        existingText?: string;
    } = {},
): Promise<PendingProblem | undefined> {
    const filePath = uri.fsPath;
    const fileName = path.basename(filePath);
    const extension = path.extname(fileName);
    const rawProblemName = path.basename(fileName, extension);
    const language = mapLanguage(extension);

    if (!rawProblemName || language === 'Unknown') {
        if (!options.silent) {
            void vscode.window.showWarningMessage('DSAFlow could not infer the problem details from this file.');
        }
        return undefined;
    }

    const codeSnippet = options.existingText ?? await readDocumentText(uri);
    const detectedUrl = extractProblemUrl(codeSnippet);
    const manualUrl = config.promptForProblemUrl && options.interactive
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
    const problemUrl = (detectedUrl || manualUrl || '').trim();
    const metadata = await resolveMetadata(config, {
        token: options.token,
        url: problemUrl,
        fileName,
        pathHint: filePath,
        difficultyHint: inferDifficultyFromText(filePath),
        tagsHint: inferTagsFromPath(filePath),
    });
    const topic = metadata?.topic || inferTopicFromPath(filePath);
    const problemName = metadata?.problem || prettifyProblemName(rawProblemName);
    const difficulty = metadata?.difficulty || inferDifficultyFromText(filePath) || config.defaultDifficulty;
    const platform = metadata?.platform || detectPlatform(problemUrl ?? '');
    const tags = uniqueTags([...(metadata?.tags || []), ...inferTagsFromPath(filePath), topic]);

    if (!problemName || !topic) {
        if (!options.silent) {
            void vscode.window.showWarningMessage('DSAFlow could not infer enough metadata from this file yet.');
        }
        return undefined;
    }

    return {
        topic,
        problem: problemName,
        language,
        platform,
        difficulty,
        problem_url: metadata?.problem_url || problemUrl?.trim() || '',
        code_snippet: codeSnippet,
        tags,
        local_path: filePath,
    };
}

function getApiBaseUrl(apiUrl: string): string {
    return apiUrl.replace(/\/problems\/?$/, '');
}

function getBulkImportUrl(apiUrl: string): string {
    return `${getApiBaseUrl(apiUrl)}/problems/bulk-import`;
}

function getMetadataResolveUrl(apiUrl: string): string {
    return `${getApiBaseUrl(apiUrl)}/metadata/resolve`;
}

function getOverviewUrl(apiUrl: string): string {
    return `${getApiBaseUrl(apiUrl)}/analytics/overview`;
}

function getInsightsUrl(apiUrl: string): string {
    return `${getApiBaseUrl(apiUrl)}/analytics/insights`;
}

function getAchievementsUrl(apiUrl: string): string {
    return `${getApiBaseUrl(apiUrl)}/achievements`;
}

function getRevisionQueueUrl(apiUrl: string): string {
    return `${getApiBaseUrl(apiUrl)}/revision-queue`;
}

function getProblemsListUrl(apiUrl: string, limit = 5): string {
    return `${getApiBaseUrl(apiUrl)}/problems?limit=${limit}&sort_by=solved_at&sort_order=desc`;
}

function extractProblemUrl(codeSnippet: string): string {
    const match = codeSnippet.match(/https?:\/\/[^\s'"`<>]+/i);
    return match?.[0] || '';
}

function prettifyProblemName(problemName: string): string {
    return problemName
        .replace(/\.[^.]+$/, '')
        .replace(/^\d+[\s._-]*/, '')
        .replace(/\[[^\]]+\]/g, ' ')
        .replace(/[_-]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .split(' ')
        .filter(Boolean)
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}

function inferTopicFromPath(filePath: string): string {
    const generic = new Set(['src', 'solutions', 'solution', 'problems', 'problem', 'leetcode', 'codeforces', 'geeksforgeeks', 'hackerrank', 'dsa', 'dsaflow']);
    const segments = filePath.split(/[\\/]/).map((segment) => segment.trim()).filter(Boolean);
    for (let index = segments.length - 2; index >= 0; index -= 1) {
        const segment = segments[index];
        if (!generic.has(segment.toLowerCase()) && !segment.includes('.')) {
            return prettifyProblemName(segment);
        }
    }
    return 'General';
}

function inferDifficultyFromText(value: string): 'Easy' | 'Medium' | 'Hard' | undefined {
    const lower = value.toLowerCase();
    if (lower.includes('easy')) return 'Easy';
    if (lower.includes('hard')) return 'Hard';
    if (lower.includes('medium')) return 'Medium';
    return undefined;
}

function inferTagsFromPath(filePath: string): string[] {
    const lowerPath = filePath.toLowerCase();
    const tags = KNOWN_TOPIC_TAGS.filter((tag) => lowerPath.includes(tag));
    return uniqueTags(tags.map((tag) => prettifyProblemName(tag)));
}

function uniqueTags(tags: string[]): string[] {
    return [...new Set(tags.map((tag) => tag.trim()).filter(Boolean))].slice(0, 20);
}

async function resolveMetadata(
    config: ExtensionConfig,
    options: {
        token?: string;
        url: string;
        fileName: string;
        pathHint: string;
        difficultyHint?: string;
        tagsHint?: string[];
    },
): Promise<ResolvedMetadata | null> {
    if (!options.token) {
        return null;
    }

    try {
        const response = await axios.post(
            getMetadataResolveUrl(config.apiUrl),
            {
                url: options.url,
                file_name: options.fileName,
                path_hint: options.pathHint,
                difficulty_hint: options.difficultyHint || '',
                tags_hint: options.tagsHint || [],
            },
            {
                headers: { Authorization: `Bearer ${options.token}` },
                timeout: 15_000,
            },
        );

        return response.data?.data ?? response.data ?? null;
    } catch (error) {
        outputChannel.warn(`Metadata resolution fell back to local inference: ${toMessage(error)}`);
        return null;
    }
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
        currentSyncState = 'synced';
        await rememberProblemLocation(context, payload, problemId);
        if (wasCreated) {
            solvedTodayCount += 1;
            lastSolvedProblemId = problemId;
            await context.workspaceState.update(SESSION_COUNT_KEY, solvedTodayCount);
            await context.workspaceState.update(LAST_PROBLEM_ID_KEY, lastSolvedProblemId);
        }
        await refreshStudentSnapshot(context);

        if (problemId) {
            if (wasCreated) {
                const actions = ['Done', 'Add Note'];
                if (getConfig().showLearningCardAfterLog) {
                    actions.splice(1, 0, 'Learning Card');
                }

                const action = await vscode.window.showInformationMessage(
                    `Logged ${payload.problem} in ${payload.topic}.`,
                    ...actions,
                );

                if (action === 'Add Note') {
                    await promptForNote(problemId);
                }
                if (action === 'Learning Card') {
                    await showLearningCard(problemId, payload.problem, payload.code_snippet);
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
        currentSyncState = 'queued';
        await refreshStudentSnapshot(context);
        const status = axios.isAxiosError(error) ? error.response?.status : undefined;

        if (status === 401) {
            currentSyncState = 'auth';
            void vscode.window.showErrorMessage('DSAFlow could not authenticate. DSAFlow will reopen sign-in for you.');
            void maybeStartAutomaticAuthentication(context, 'required');
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
        currentSyncState = 'auth';
        await refreshStudentSnapshot(context);
        void vscode.window.showWarningMessage('DSAFlow still has pending problems, but you need to log in before syncing.');
        return;
    }

    currentSyncState = 'syncing';
    await refreshStudentSnapshot(context);
    updateStatusBar('Syncing queue', 'sync');
    const stillPending: PendingProblem[] = [];

    for (const item of pending) {
        try {
            const response = await axios.post(config.apiUrl, item, {
                headers: { Authorization: `Bearer ${token}` },
                timeout: 15_000,
            });
            const problemId = response.data?.data?.id ?? response.data?.data?.[0]?.id ?? null;
            await rememberProblemLocation(context, item, problemId);
        } catch (error) {
            stillPending.push(item);
            outputChannel.warn(`Pending item sync failed for ${item.problem}: ${toMessage(error)}`);
        }
    }

    await context.globalState.update(PENDING_KEY, stillPending);
    currentSyncState = stillPending.length ? 'queued' : 'synced';
    await refreshStudentSnapshot(context);

    const syncedCount = pending.length - stillPending.length;
    if (syncedCount > 0) {
        void vscode.window.showInformationMessage(`DSAFlow synced ${syncedCount} pending problem(s).`);
    } else if (!options.silentWhenEmpty) {
        void vscode.window.showWarningMessage('DSAFlow could not sync pending problems yet.');
    }
}

function getProblemIdentity(problemName: string, platform: string): string {
    return `${platform.toLowerCase()}::${problemName.trim().toLowerCase().replace(/\s+/g, ' ')}`;
}

async function getFileIndex(context: vscode.ExtensionContext): Promise<Record<string, string>> {
    return context.globalState.get<Record<string, string>>(FILE_INDEX_KEY, {});
}

async function rememberProblemLocation(
    context: vscode.ExtensionContext,
    payload: PendingProblem,
    problemId: string | null,
): Promise<void> {
    if (!payload.local_path) {
        return;
    }

    const index = await getFileIndex(context);
    index[getProblemIdentity(payload.problem, payload.platform)] = payload.local_path;
    if (problemId) {
        index[`id:${problemId}`] = payload.local_path;
    }
    await context.globalState.update(FILE_INDEX_KEY, index);
}

async function resolveLocalPathForProblem(problem: SidebarProblem): Promise<string | null> {
    const index = await getFileIndex(extensionContext);
    return index[`id:${problem.id}`] || index[getProblemIdentity(problem.problemName, problem.platform)] || null;
}

function getWorkspaceImportKey(): string {
    const folders = vscode.workspace.workspaceFolders?.map((folder) => folder.uri.fsPath).sort().join('|') || 'no-workspace';
    return `${WORKSPACE_IMPORT_PREFIX}:${crypto.createHash('sha1').update(folders).digest('hex')}`;
}

function mapApiProblem(problem: ApiProblem, localPath?: string | null): SidebarProblem {
    return {
        id: problem.id,
        problemName: problem.problem_name,
        topic: problem.topic,
        difficulty: problem.difficulty,
        platform: problem.platform,
        problemUrl: problem.problem_url,
        localPath: localPath || null,
        revisionCount: problem.revision_count,
        nextRevisionAt: problem.next_revision_at,
    };
}

async function refreshStudentSnapshot(
    context: vscode.ExtensionContext,
    options: { notify?: boolean } = {},
): Promise<void> {
    const pending = context.globalState.get<PendingProblem[]>(PENDING_KEY, []);
    const token = await context.secrets.get(SECRET_KEY);
    const config = getConfig();

    if (!token) {
        latestSnapshot = {
            authenticated: false,
            today: solvedTodayCount,
            streak: 0,
            revisionDue: 0,
            pendingCount: pending.length,
            syncLabel: pending.length ? `Queued ${pending.length}` : 'Sign in required',
            weakTopics: [],
            achievements: [],
            dueRevisions: [],
            recentProblems: [],
        };
        sidebarProvider.setSnapshot(latestSnapshot);
        currentSyncState = pending.length ? 'queued' : 'auth';
        updateMotivationStatusBar();
        return;
    }

    try {
        const headers = { Authorization: `Bearer ${token}` };
        const [overviewResponse, revisionsResponse, insightsResponse, achievementsResponse, problemsResponse] = await Promise.all([
            axios.get(getOverviewUrl(config.apiUrl), { headers, timeout: 15_000 }),
            axios.get(getRevisionQueueUrl(config.apiUrl), { headers, timeout: 15_000 }),
            axios.get(getInsightsUrl(config.apiUrl), { headers, timeout: 15_000 }),
            axios.get(getAchievementsUrl(config.apiUrl), { headers, timeout: 15_000 }),
            axios.get(getProblemsListUrl(config.apiUrl, 5), { headers, timeout: 15_000 }),
        ]);

        const overview: OverviewData = overviewResponse.data?.data ?? overviewResponse.data;
        const revisionData: RevisionQueueData = revisionsResponse.data?.data ?? revisionsResponse.data;
        const insights: InsightsData = insightsResponse.data?.data ?? insightsResponse.data;
        const achievements: Achievement[] = achievementsResponse.data?.data ?? achievementsResponse.data ?? [];
        const problems: { items: ApiProblem[] } = problemsResponse.data?.data ?? problemsResponse.data ?? { items: [] };
        const fileIndex = await getFileIndex(context);
        const dueProblems = [...(revisionData.overdue || []), ...(revisionData.due_today || [])]
            .slice(0, 6)
            .map((problem) => mapApiProblem(problem, fileIndex[`id:${problem.id}`] || fileIndex[getProblemIdentity(problem.problem_name, problem.platform)]));
        const recentProblems = (problems.items || [])
            .slice(0, 6)
            .map((problem) => mapApiProblem(problem, fileIndex[`id:${problem.id}`] || fileIndex[getProblemIdentity(problem.problem_name, problem.platform)]));

        latestSnapshot = {
            authenticated: true,
            today: overview?.solved_today || solvedTodayCount,
            streak: overview?.current_streak || 0,
            revisionDue: overview?.revision_due || dueProblems.length,
            pendingCount: pending.length,
            syncLabel: currentSyncState === 'syncing'
                ? 'Syncing…'
                : pending.length
                    ? `Queued ${pending.length}`
                    : 'Synced',
            strongestTopic: insights?.strongest_topic || null,
            weakTopics: (insights?.weak_topics || []).map((entry) => entry.topic).slice(0, 3),
            nextSuggestion: insights?.next_problem_suggestion,
            achievements: achievements.filter((item) => item.unlocked).map((item) => item.title).slice(0, 5),
            dueRevisions: dueProblems,
            recentProblems,
        };

        if (currentSyncState !== 'syncing') {
            currentSyncState = pending.length ? 'queued' : 'synced';
        }
        sidebarProvider.setSnapshot(latestSnapshot);
        updateMotivationStatusBar();

        if (options.notify) {
            void vscode.window.showInformationMessage('DSAFlow refreshed your workspace insights.');
        }
    } catch (error) {
        currentSyncState = 'offline';
        latestSnapshot = {
            ...latestSnapshot,
            authenticated: true,
            pendingCount: pending.length,
            syncLabel: pending.length ? `Offline • queued ${pending.length}` : 'Offline',
        };
        sidebarProvider.setSnapshot(latestSnapshot);
        updateMotivationStatusBar();
        if (options.notify) {
            void vscode.window.showWarningMessage(`DSAFlow could not refresh right now: ${toMessage(error)}`);
        }
    }
}

function updateMotivationStatusBar(): void {
    if (!latestSnapshot.authenticated) {
        updateStatusBar(latestSnapshot.pendingCount ? `Queued ${latestSnapshot.pendingCount}` : 'Sign in', latestSnapshot.pendingCount ? 'warning' : 'warning');
        statusBarItem.tooltip = 'Connect DSAFlow to start automatic tracking.';
        return;
    }

    if (currentSyncState === 'syncing') {
        updateStatusBar(`Syncing | Queue ${latestSnapshot.pendingCount}`, 'sync');
        statusBarItem.tooltip = 'DSAFlow is syncing your offline queue.';
        return;
    }

    const text = `🔥 ${latestSnapshot.today} today | Streak ${latestSnapshot.streak} | Rev ${latestSnapshot.revisionDue}`;
    statusBarItem.text = `$(flame) DSAFlow ${text}`;
    statusBarItem.tooltip = [
        `Today: ${latestSnapshot.today}`,
        `Streak: ${latestSnapshot.streak}`,
        `Due revisions: ${latestSnapshot.revisionDue}`,
        `Sync: ${latestSnapshot.syncLabel}`,
    ].join('\n');
}

async function listFolderCandidates(config: ExtensionConfig): Promise<string[]> {
    const workspaceFolders = vscode.workspace.workspaceFolders || [];
    const fallback = workspaceFolders.map(() => '.');
    const files = await vscode.workspace.findFiles(config.watchedGlob, '**/{node_modules,.git,.next,dist,build,out,target}/**', 500);
    const candidates = new Set<string>(fallback);

    for (const file of files) {
        const relativeFolder = getRelativeFolderForUri(file);
        if (relativeFolder) {
            candidates.add(relativeFolder);
        }
    }

    return [...candidates].sort((left, right) => left.localeCompare(right));
}

async function addTrackedFolder(context: vscode.ExtensionContext, presetFolder?: string): Promise<void> {
    const config = getConfig();
    const workspaceFolders = vscode.workspace.workspaceFolders || [];
    if (!workspaceFolders.length) {
        void vscode.window.showWarningMessage('Open a workspace folder before configuring DSAFlow tracked folders.');
        return;
    }

    const workspaceRoot = workspaceFolders[0].uri.fsPath;
    const tracking = readFolderTrackingConfig(workspaceRoot, config);
    const folder = presetFolder
        ? normalizeFolderPath(presetFolder)
        : await vscode.window.showQuickPick(
            (await listFolderCandidates(config)).map((candidate) => ({
                label: candidate === '.' ? 'Workspace Root' : candidate,
                description: candidate,
            })),
            {
                placeHolder: 'Choose a folder DSAFlow is allowed to auto-log',
                ignoreFocusOut: true,
            },
        ).then((selection) => selection?.description);

    if (!folder) {
        return;
    }

    tracking.trackedFolders.push(folder);
    tracking.ignoredFolders = tracking.ignoredFolders.filter((item) => item !== folder);
    await writeFolderTrackingConfig(workspaceRoot, config, tracking);
    await refreshStudentSnapshot(context);
    void vscode.window.showInformationMessage(`DSAFlow will auto-log files in "${folder}".`);
}

async function removeTrackedFolder(context: vscode.ExtensionContext): Promise<void> {
    const config = getConfig();
    const workspaceFolders = vscode.workspace.workspaceFolders || [];
    if (!workspaceFolders.length) {
        void vscode.window.showWarningMessage('Open a workspace folder before configuring DSAFlow tracked folders.');
        return;
    }

    const workspaceRoot = workspaceFolders[0].uri.fsPath;
    const tracking = readFolderTrackingConfig(workspaceRoot, config);
    if (!tracking.trackedFolders.length) {
        void vscode.window.showInformationMessage('DSAFlow has no tracked folders yet.');
        return;
    }

    const selection = await vscode.window.showQuickPick(
        tracking.trackedFolders.map((folder) => ({
            label: folder === '.' ? 'Workspace Root' : folder,
            description: folder,
        })),
        {
            placeHolder: 'Choose a tracked folder to remove',
            ignoreFocusOut: true,
        },
    );

    if (!selection?.description) {
        return;
    }

    tracking.trackedFolders = tracking.trackedFolders.filter((folder) => folder !== selection.description);
    await writeFolderTrackingConfig(workspaceRoot, config, tracking);
    await refreshStudentSnapshot(context);
    void vscode.window.showInformationMessage(`DSAFlow removed "${selection.description}" from tracked folders.`);
}

async function openWorkspaceConfig(context: vscode.ExtensionContext): Promise<void> {
    const config = getConfig();
    const workspaceFolders = vscode.workspace.workspaceFolders || [];
    if (!workspaceFolders.length) {
        void vscode.window.showWarningMessage('Open a workspace folder before configuring DSAFlow tracked folders.');
        return;
    }

    const workspaceRoot = workspaceFolders[0].uri.fsPath;
    const configPath = getWorkspaceConfigPath(workspaceRoot, config);
    if (!fs.existsSync(configPath)) {
        await writeFolderTrackingConfig(workspaceRoot, config, readFolderTrackingConfig(workspaceRoot, config));
    }

    const document = await vscode.workspace.openTextDocument(vscode.Uri.file(configPath));
    await vscode.window.showTextDocument(document, { preview: false });
    await refreshStudentSnapshot(context);
}

async function manageTrackedFolders(context: vscode.ExtensionContext): Promise<void> {
    const config = getConfig();
    const workspaceFolders = vscode.workspace.workspaceFolders || [];
    if (!workspaceFolders.length) {
        void vscode.window.showWarningMessage('Open a workspace folder before configuring DSAFlow tracked folders.');
        return;
    }

    const workspaceRoot = workspaceFolders[0].uri.fsPath;
    const tracking = readFolderTrackingConfig(workspaceRoot, config);
    const action = await vscode.window.showQuickPick([
        {
            label: 'Add Tracked Folder',
            description: tracking.trackedFolders.length
                ? `Current: ${tracking.trackedFolders.join(', ')}`
                : 'No tracked folders yet',
        },
        {
            label: 'Remove Tracked Folder',
            description: tracking.trackedFolders.length
                ? `Tracked: ${tracking.trackedFolders.length}`
                : 'Nothing to remove',
        },
        {
            label: 'Open Workspace Config',
            description: config.workspaceConfigFile,
        },
    ], {
        placeHolder: 'Manage where DSAFlow is allowed to auto-log',
        ignoreFocusOut: true,
    });

    if (!action) {
        return;
    }

    if (action.label === 'Add Tracked Folder') {
        await addTrackedFolder(context);
        return;
    }

    if (action.label === 'Remove Tracked Folder') {
        await removeTrackedFolder(context);
        return;
    }

    await openWorkspaceConfig(context);
}

async function maybeOfferWorkspaceImport(context: vscode.ExtensionContext): Promise<void> {
    const config = getConfig();
    if (!config.autoImportOnFirstRun || !vscode.workspace.workspaceFolders?.length) {
        return;
    }

    const key = getWorkspaceImportKey();
    if (context.globalState.get<boolean>(key)) {
        return;
    }

    const token = await context.secrets.get(SECRET_KEY);
    if (!token) {
        return;
    }

    if (config.requireFolderApproval) {
        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (!workspaceRoot || !readFolderTrackingConfig(workspaceRoot, config).trackedFolders.length) {
            return;
        }
    }

    const candidates = await findWorkspaceCandidateFiles(config);
    if (!candidates.length) {
        await context.globalState.update(key, true);
        return;
    }

    const action = await vscode.window.showInformationMessage(
        `DSAFlow found ${candidates.length} likely DSA files in this workspace. Import them now?`,
        'Import',
        'Later',
    );

    if (action === 'Import') {
        await importWorkspaceHistory(context, { firstRun: true, candidates });
    } else {
        await context.globalState.update(key, true);
    }
}

async function findWorkspaceCandidateFiles(config: ExtensionConfig): Promise<vscode.Uri[]> {
    const exclude = '**/{node_modules,.git,.next,dist,build,out,target}/**';
    const files = await vscode.workspace.findFiles(config.watchedGlob, exclude, 250);
    return files.filter((uri) => {
        const relativeFolder = getRelativeFolderForUri(uri);
        const workspaceRoot = getWorkspaceRootForUri(uri);
        if (config.requireFolderApproval && relativeFolder && workspaceRoot) {
            const tracking = readFolderTrackingConfig(workspaceRoot, config);
            if (!isFolderTracked(relativeFolder, tracking)) {
                return false;
            }
        }

        const lower = uri.fsPath.toLowerCase();
        return KNOWN_TOPIC_TAGS.some((tag) => lower.includes(tag)) || /\d+[_-]/.test(path.basename(lower)) || lower.includes('leetcode') || lower.includes('codeforces');
    });
}

async function importWorkspaceHistory(
    context: vscode.ExtensionContext,
    options: { firstRun: boolean; candidates?: vscode.Uri[] },
): Promise<void> {
    const token = await context.secrets.get(SECRET_KEY);
    if (!token) {
        currentSyncState = 'auth';
        await maybeStartAutomaticAuthentication(context, 'required');
        return;
    }

    const config = getConfig();
    try {
        if (config.requireFolderApproval) {
            const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
            if (!workspaceRoot || !readFolderTrackingConfig(workspaceRoot, config).trackedFolders.length) {
                void vscode.window.showInformationMessage('Choose at least one tracked folder before importing workspace history.');
                await manageTrackedFolders(context);
                return;
            }
        }

        const candidates = options.candidates || await findWorkspaceCandidateFiles(config);
        if (!candidates.length) {
            void vscode.window.showInformationMessage('DSAFlow did not find any likely DSA files to import.');
            await context.globalState.update(getWorkspaceImportKey(), true);
            return;
        }

        const progressPayloads: PendingProblem[] = [];
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'DSAFlow is scanning your workspace',
            cancellable: false,
        }, async (progress) => {
            for (let index = 0; index < candidates.length; index += 1) {
                const uri = candidates[index];
                progress.report({ message: path.basename(uri.fsPath), increment: (100 / candidates.length) });
                const payload = await buildProblemPayload(uri, config, {
                    token,
                    interactive: false,
                    silent: true,
                });

                if (payload) {
                    progressPayloads.push(payload);
                }
            }
        });

        if (!progressPayloads.length) {
            void vscode.window.showWarningMessage('DSAFlow scanned the workspace but could not infer importable DSA metadata yet.');
            await context.globalState.update(getWorkspaceImportKey(), true);
            return;
        }

        const chunks: PendingProblem[][] = [];
        for (let index = 0; index < progressPayloads.length; index += 100) {
            chunks.push(progressPayloads.slice(index, index + 100));
        }

        let imported = 0;
        currentSyncState = 'syncing';
        await refreshStudentSnapshot(context);

        for (const chunk of chunks) {
            const response = await axios.post(getBulkImportUrl(config.apiUrl), { problems: chunk }, {
                headers: { Authorization: `Bearer ${token}` },
                timeout: 30_000,
            });

            const data = response.data?.data ?? response.data;
            imported += data?.imported || 0;
            for (const payload of chunk) {
                await rememberProblemLocation(context, payload, null);
            }
        }

        await context.globalState.update(getWorkspaceImportKey(), true);
        currentSyncState = 'synced';
        await refreshStudentSnapshot(context);
        void vscode.window.showInformationMessage(
            options.firstRun
                ? `DSAFlow imported ${imported} historical problem(s) from this workspace.`
                : `DSAFlow imported ${imported} problem(s).`,
        );
    } catch (error) {
        currentSyncState = 'offline';
        await refreshStudentSnapshot(context);
        outputChannel.error(`Workspace import failed: ${toMessage(error)}`);
        void vscode.window.showErrorMessage(`DSAFlow could not import the workspace yet: ${toMessage(error)}`);
    }
}

async function openSidebarProblem(problem: SidebarProblem): Promise<void> {
    const localPath = problem.localPath || await resolveLocalPathForProblem(problem);
    if (localPath) {
        try {
            const document = await vscode.workspace.openTextDocument(vscode.Uri.file(localPath));
            await vscode.window.showTextDocument(document, { preview: false });
            return;
        } catch (error) {
            outputChannel.warn(`Could not open local file for ${problem.problemName}: ${toMessage(error)}`);
        }
    }

    if (problem.problemUrl) {
        await vscode.env.openExternal(vscode.Uri.parse(problem.problemUrl));
        return;
    }

    await vscode.commands.executeCommand('dsaflow.openDashboard');
}

async function reviseProblemFromSidebar(problemId: string, action: 'complete' | 'snooze'): Promise<void> {
    const token = await extensionContext.secrets.get(SECRET_KEY);
    if (!token) {
        await maybeStartAutomaticAuthentication(extensionContext, 'required');
        return;
    }

    const config = getConfig();
    try {
        await axios.post(
            `${getApiBaseUrl(config.apiUrl)}/problems/${problemId}/revise`,
            action === 'snooze' ? { action, days: 2 } : { action },
            { headers: { Authorization: `Bearer ${token}` }, timeout: 15_000 },
        );

        void vscode.window.showInformationMessage(action === 'complete' ? 'Revision marked complete.' : 'Revision snoozed for 2 days.');
        await refreshStudentSnapshot(extensionContext);
    } catch (error) {
        outputChannel.error(`Revision action failed: ${toMessage(error)}`);
        void vscode.window.showErrorMessage(`DSAFlow could not update the revision right now: ${toMessage(error)}`);
    }
}

async function showLearningCard(problemId: string, problemName?: string, code?: string): Promise<void> {
    const token = await extensionContext.secrets.get(SECRET_KEY);
    if (!token) {
        await maybeStartAutomaticAuthentication(extensionContext, 'required');
        return;
    }

    const config = getConfig();
    try {
        const response = await axios.post(
            `${getApiBaseUrl(config.apiUrl)}/problems/${problemId}/analyze`,
            code ? { code } : {},
            { headers: { Authorization: `Bearer ${token}` }, timeout: 20_000 },
        );
        const analysis = response.data?.data ?? response.data;
        const panel = vscode.window.createWebviewPanel(
            'dsaflowLearningCard',
            `Learning Card${problemName ? ` • ${problemName}` : ''}`,
            vscode.ViewColumn.Beside,
            {},
        );

        panel.webview.html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>DSAFlow Learning Card</title>
<style>
body { font-family: "Segoe UI", sans-serif; padding: 24px; background: #08111a; color: #f8fafc; }
.card { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 18px; padding: 18px; margin-bottom: 16px; }
.label { color: #7dd3fc; font-size: 12px; text-transform: uppercase; letter-spacing: 0.16em; margin-bottom: 8px; }
h1 { margin-top: 0; font-size: 28px; }
ul { padding-left: 20px; }
</style>
</head>
<body>
    <h1>${problemName || 'DSAFlow Learning Card'}</h1>
    <div class="card"><div class="label">Time Complexity</div><div>${analysis.time_complexity || 'Unknown'}</div></div>
    <div class="card"><div class="label">Space Complexity</div><div>${analysis.space_complexity || 'Unknown'}</div></div>
    <div class="card"><div class="label">Pattern</div><div>${analysis.pattern_detected || 'General'}</div></div>
    <div class="card"><div class="label">Bottleneck</div><div>${analysis.bottlenecks || 'N/A'}</div></div>
    <div class="card"><div class="label">Recommendation</div><div>${analysis.recommendations || 'N/A'}</div></div>
    <div class="card"><div class="label">Alternative Approach</div><div>${analysis.alternative_approach || 'N/A'}</div></div>
    <div class="card"><div class="label">Edge Cases</div><ul>${(analysis.edge_cases || []).map((edgeCase: string) => `<li>${edgeCase}</li>`).join('')}</ul></div>
</body>
</html>`;
    } catch (error) {
        outputChannel.error(`Learning card failed: ${toMessage(error)}`);
        void vscode.window.showErrorMessage(`DSAFlow could not generate the learning card right now: ${toMessage(error)}`);
    }
}

async function promptForNote(problemId: string): Promise<void> {
    const template = await vscode.window.showQuickPick([
        { label: 'Quick Note', value: '' },
        { label: 'Trick', value: 'Trick: ' },
        { label: 'Mistake', value: 'Mistake: ' },
        { label: 'Edge Case', value: 'Edge case: ' },
        { label: 'Revision Takeaway', value: 'Revision takeaway: ' },
        { label: 'Complexity', value: 'Complexity: ' },
    ], {
        placeHolder: 'Choose a note template',
        ignoreFocusOut: true,
    });

    if (!template) {
        return;
    }

    const noteInput = await vscode.window.showInputBox({
        prompt: 'Add your note for this problem',
        placeHolder: 'Edge cases, time complexity, gotchas, or the trick you want to remember',
        ignoreFocusOut: true,
        value: template.value,
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
        requireFolderApproval: config.get<boolean>('requireFolderApproval', true),
        workspaceConfigFile: config.get<string>('workspaceConfigFile', DEFAULT_WORKSPACE_CONFIG_FILE),
        autoLogOnCreate: config.get<boolean>('autoLogOnCreate', true),
        promptOnSave: config.get<boolean>('promptOnSave', false),
        promptForProblemUrl: config.get<boolean>('promptForProblemUrl', false),
        savePromptDebounceMs: Math.max(config.get<number>('savePromptDebounceMs', 1500), 250),
        defaultDifficulty: config.get<'Easy' | 'Medium' | 'Hard'>('defaultDifficulty', 'Medium'),
        autoImportOnFirstRun: config.get<boolean>('autoImportOnFirstRun', true),
        showLearningCardAfterLog: config.get<boolean>('showLearningCardAfterLog', true),
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
