import * as vscode from 'vscode';
import * as path from 'path';
const axios = require('axios');

const SECRET_KEY = 'dsaflow-token';

let statusBarItem: vscode.StatusBarItem;
let fileWatcher: vscode.FileSystemWatcher | undefined;
let solvedTodayCount = 0;
let lastSolvedProblemId: string | null = null;
// Offline queue key in globalState
const PENDING_KEY = 'dsaflow-pendingProblems';

// --- Extension Context (stored on activate for later use) ---
let extensionContext: vscode.ExtensionContext;

export function activate(context: vscode.ExtensionContext) {
    extensionContext = context;
    console.log('DSAFlow extension activated.');

    // 1. Initialize Status Bar
    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    statusBarItem.command = 'dsaflow.openDashboard';
    updateStatusBar('Active');
    statusBarItem.show();
    context.subscriptions.push(statusBarItem);

    // 2. Register Commands
    const startCmd = vscode.commands.registerCommand('dsaflow.startTracking', () => {
        startWatcher(context);
        vscode.window.showInformationMessage('DSAFlow tracking started.');
    });

    const stopCmd = vscode.commands.registerCommand('dsaflow.stopTracking', () => {
        if (fileWatcher) {
            fileWatcher.dispose();
            fileWatcher = undefined;
        }
        updateStatusBar('Paused', '⚠️');
        vscode.window.showInformationMessage('DSAFlow tracking stopped.');
    });

    const dashCmd = vscode.commands.registerCommand('dsaflow.openDashboard', () => {
        const config = vscode.workspace.getConfiguration('dsaflow');
        const dashUrl = config.get<string>('dashboardUrl') || 'http://localhost:3000';
        vscode.env.openExternal(vscode.Uri.parse(dashUrl));
    });

    // 🔐 New secure login command
    const loginCmd = vscode.commands.registerCommand('dsaflow.login', async () => {
        const token = await vscode.window.showInputBox({
            prompt: 'Enter your DSAFlow JWT or Supabase Anon Key',
            placeHolder: 'eyJhbGci...',
            password: true, // Masks input
            ignoreFocusOut: true
        });
        if (token) {
            await context.secrets.store(SECRET_KEY, token);
            vscode.window.showInformationMessage('DSAFlow: Token saved securely! ✅');
        }
    });

    const noteCmd = vscode.commands.registerCommand('dsaflow.addNote', async () => {
        if (!lastSolvedProblemId) {
            vscode.window.showWarningMessage('No recently solved problem to add a note to.');
            return;
        }
        await promptForNote(lastSolvedProblemId);
    });

    // 📊 New stats command
    const statsCmd = vscode.commands.registerCommand('dsaflow.viewStats', async () => {
        await showStatsWebview(context);
    });

    context.subscriptions.push(startCmd, stopCmd, dashCmd, loginCmd, noteCmd, statsCmd);

    // 🔁 Retry offline queue on activation
    retryPendingProblems(context);

    // Default start
    startWatcher(context);
}

// --- Offline Queue: Retry on activation ---
async function retryPendingProblems(context: vscode.ExtensionContext) {
    const pending: any[] = context.globalState.get(PENDING_KEY, []);
    if (pending.length === 0) return;

    const config = vscode.workspace.getConfiguration('dsaflow');
    const apiUrl = config.get<string>('apiUrl');
    const token = await context.secrets.get(SECRET_KEY);

    if (!apiUrl || !token) return;

    const stillPending: any[] = [];

    for (const problem of pending) {
        try {
            await axios.post(apiUrl, problem, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
        } catch {
            stillPending.push(problem); // Failed again, keep in queue
        }
    }

    await context.globalState.update(PENDING_KEY, stillPending);

    if (stillPending.length < pending.length) {
        const synced = pending.length - stillPending.length;
        vscode.window.showInformationMessage(`DSAFlow: Synced ${synced} offline problem(s) ✅`);
    }
}

function startWatcher(context: vscode.ExtensionContext) {
    if (fileWatcher) return;

    fileWatcher = vscode.workspace.createFileSystemWatcher('**/*.{cpp,py,java,js,ts}');
    updateStatusBar('Watching...', '🔥');

    fileWatcher.onDidCreate(async (uri) => {
        await handleNewFile(uri, context);
    });

    context.subscriptions.push(fileWatcher);
}

async function handleNewFile(uri: vscode.Uri, context: vscode.ExtensionContext) {
    try {
        const config = vscode.workspace.getConfiguration('dsaflow');
        const apiUrl = config.get<string>('apiUrl');
        // 🔐 Use SecretStorage instead of settings.json
        const token = await context.secrets.get(SECRET_KEY);

        if (!apiUrl) {
            vscode.window.showErrorMessage('DSAFlow: API URL missing in settings. Add it in VS Code settings under "dsaflow.apiUrl".');
            return;
        }

        if (!token) {
            const action = await vscode.window.showWarningMessage(
                'DSAFlow: No token found. Please log in to start tracking.',
                'Login Now'
            );
            if (action === 'Login Now') {
                await vscode.commands.executeCommand('dsaflow.login');
            }
            return;
        }

        const filePath = uri.fsPath;
        const fileName = path.basename(filePath);

        await new Promise(resolve => setTimeout(resolve, 500));

        const platform = await vscode.window.showQuickPick(
            ['LeetCode', 'GeeksForGeeks', 'Codeforces', 'HackerRank', 'Other'],
            { placeHolder: 'Select the platform for this problem', ignoreFocusOut: true }
        );
        if (!platform) return;

        const difficulty = await vscode.window.showQuickPick(
            ['Easy', 'Medium', 'Hard'],
            { placeHolder: 'Select the difficulty', ignoreFocusOut: true }
        );
        if (!difficulty) return;

        const dirName = path.dirname(filePath);
        const topic = path.basename(dirName);
        const extName = path.extname(fileName);
        const languageMap: Record<string, string> = {
            '.cpp': 'C++', '.py': 'Python', '.java': 'Java', '.js': 'JavaScript', '.ts': 'TypeScript'
        };
        const language = languageMap[extName] || 'Unknown';
        const problemName = path.basename(fileName, extName);

        // 📝 New Phase 9 Feature: Capture Code Snapshot
        let codeSnippet = '';
        try {
            const document = await vscode.workspace.openTextDocument(uri);
            codeSnippet = document.getText();
        } catch (err) {
            console.error('Could not read code snippet:', err);
        }

        // 🔗 New Phase 9 Feature: Prompt for Problem URL
        const problemUrl = await vscode.window.showInputBox({
            prompt: 'Paste the problem URL (optional)',
            placeHolder: 'https://leetcode.com/problems/...',
            ignoreFocusOut: true
        });

        const payload = {
            topic,
            problem: problemName,
            language,
            platform,
            difficulty,
            problem_url: problemUrl || '',
            code_snippet: codeSnippet
        };

        try {
            const response = await axios.post(apiUrl, payload, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            const problemId = response.data?.data?.id || response.data?.data?.[0]?.id;
            solvedTodayCount++;
            updateStatusBar(`${solvedTodayCount} solved today!`, '');

            if (solvedTodayCount === 3) {
                vscode.window.showInformationMessage('🔥 3 Problems solved today! You are on fire!');
            } else if (problemId) {
                lastSolvedProblemId = problemId;
                const action = await vscode.window.showInformationMessage(
                    `✅ Logged: ${problemName} (${difficulty})! Add a note?`,
                    'Yes', 'No'
                );
                if (action === 'Yes') await promptForNote(problemId);
            }

        } catch (apiError: any) {
            // 📡 Offline queue: store for retry
            const pending: any[] = context.globalState.get(PENDING_KEY, []);
            pending.push(payload);
            await context.globalState.update(PENDING_KEY, pending);

            vscode.window.showWarningMessage(
                `DSAFlow: API unreachable. Problem saved to offline queue (${pending.length} pending).`
            );
        }

    } catch (error: any) {
        console.error('Error logging problem:', error);
        vscode.window.showErrorMessage('DSAFlow: An unexpected error occurred.');
    }
}

async function promptForNote(problemId: string) {
    const config = vscode.workspace.getConfiguration('dsaflow');
    const apiUrl = config.get<string>('apiUrl');
    const token = await extensionContext.secrets.get(SECRET_KEY);

    if (!apiUrl || !token) return;

    const noteInput = await vscode.window.showInputBox({
        prompt: 'Add your insights (edge cases, time complexity, gotchas)',
        placeHolder: 'e.g., O(n) space because of the hash map'
    });

    if (noteInput && noteInput.trim().length > 0) {
        try {
            const notesUrl = apiUrl.replace('/problems', '/notes');
            await axios.post(notesUrl, { problem_id: problemId, note: noteInput }, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            vscode.window.showInformationMessage('Note saved! 📝');
            lastSolvedProblemId = null;
        } catch {
            vscode.window.showErrorMessage('Failed to save note.');
        }
    }
}

// 📊 Stats WebView Panel
async function showStatsWebview(context: vscode.ExtensionContext) {
    const config = vscode.workspace.getConfiguration('dsaflow');
    const apiUrl = config.get<string>('apiUrl')?.replace('/api/problems', '/api/stats') || 'http://localhost:3001/api/stats';
    const token = await context.secrets.get(SECRET_KEY);

    let statsHtml = '<p style="color:#888">No stats available or API is offline.</p>';

    try {
        if (token) {
            const res = await axios.get(apiUrl, { headers: { 'Authorization': `Bearer ${token}` } });
            const s = res.data;
            statsHtml = `
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:16px">
                    <div class="card"><div class="num">${s.solved}</div><div class="label">Total Solved</div></div>
                    <div class="card easy"><div class="num">${s.easy}</div><div class="label">Easy</div></div>
                    <div class="card med"><div class="num">${s.medium}</div><div class="label">Medium</div></div>
                    <div class="card hard"><div class="num">${s.hard}</div><div class="label">Hard</div></div>
                </div>`;
        }
    } catch { /* use default html */ }

    const panel = vscode.window.createWebviewPanel('dsaflowStats', 'DSAFlow Stats', vscode.ViewColumn.Beside, {});

    panel.webview.html = `<!DOCTYPE html>
<html>
<head>
<style>
    body { font-family: -apple-system, sans-serif; padding: 24px; background: #0a0a0b; color: #fff; }
    h1 { font-size: 24px; font-weight: 800; margin: 0 0 4px; }
    p.sub { color: #888; margin: 0 0 24px; }
    .card { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; padding: 20px; }
    .card.easy { border-color: rgba(96,165,250,0.3); }
    .card.med  { border-color: rgba(251,146,60,0.3); }
    .card.hard { border-color: rgba(248,113,113,0.3); }
    .num { font-size: 40px; font-weight: 900; }
    .label { font-size: 12px; color: #888; text-transform: uppercase; letter-spacing: 0.1em; margin-top: 4px; }
    .session { margin-top: 24px; background: rgba(255,255,255,0.03); border-radius: 12px; padding: 16px; font-size: 14px; color: #aaa; }
</style>
</head>
<body>
    <h1> DSAFlow</h1>
    <p class="sub">Your personal DSA progress tracker</p>
    ${statsHtml}
    <div class="session">This session: <strong style="color:#fff">${solvedTodayCount} solved</strong></div>
</body>
</html>`;
}

function updateStatusBar(text: string, icon = '🔥') {
    statusBarItem.text = `${icon} DSAFlow: ${text}`;
}

export function deactivate() {
    if (fileWatcher) fileWatcher.dispose();
}
