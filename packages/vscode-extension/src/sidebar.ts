import * as vscode from 'vscode';

export type SidebarProblem = {
    id: string;
    problemName: string;
    topic: string;
    difficulty: string;
    platform: string;
    problemUrl?: string | null;
    localPath?: string | null;
    revisionCount?: number;
    nextRevisionAt?: string | null;
};

export type SidebarSnapshot = {
    authenticated: boolean;
    today: number;
    streak: number;
    revisionDue: number;
    pendingCount: number;
    syncLabel: string;
    strongestTopic?: string | null;
    weakTopics: string[];
    nextSuggestion?: string;
    achievements: string[];
    dueRevisions: SidebarProblem[];
    recentProblems: SidebarProblem[];
};

type NodeKind = 'action' | 'summary' | 'section' | 'revision' | 'recent' | 'insight' | 'achievement' | 'empty';

type NodePayload = {
    kind: NodeKind;
    label: string;
    description?: string;
    tooltip?: string;
    icon?: string;
    contextValue?: string;
    collapsibleState?: vscode.TreeItemCollapsibleState;
    command?: vscode.Command;
    children?: NodePayload[];
    problem?: SidebarProblem;
};

export class SidebarTreeItem extends vscode.TreeItem {
    readonly children?: NodePayload[];
    readonly payload?: SidebarProblem;

    constructor(node: NodePayload) {
        super(node.label, node.collapsibleState ?? vscode.TreeItemCollapsibleState.None);
        this.description = node.description;
        this.tooltip = node.tooltip || node.label;
        this.contextValue = node.contextValue;
        this.command = node.command;
        this.children = node.children;
        this.payload = node.problem;
        this.iconPath = node.icon ? new vscode.ThemeIcon(node.icon) : undefined;
    }
}

export class DSAFlowSidebarProvider implements vscode.TreeDataProvider<SidebarTreeItem> {
    private readonly onDidChangeTreeDataEmitter = new vscode.EventEmitter<SidebarTreeItem | undefined>();
    readonly onDidChangeTreeData = this.onDidChangeTreeDataEmitter.event;

    private snapshot: SidebarSnapshot = {
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

    setSnapshot(snapshot: SidebarSnapshot) {
        this.snapshot = snapshot;
        this.refresh();
    }

    refresh() {
        this.onDidChangeTreeDataEmitter.fire(undefined);
    }

    getTreeItem(element: SidebarTreeItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: SidebarTreeItem): Thenable<SidebarTreeItem[]> {
        if (!element) {
            return Promise.resolve(this.buildRootItems());
        }

        return Promise.resolve((element.children || []).map((child) => new SidebarTreeItem(child)));
    }

    private buildRootItems(): SidebarTreeItem[] {
        if (!this.snapshot.authenticated) {
            return [
                new SidebarTreeItem({
                    kind: 'action',
                    label: 'Connect DSAFlow',
                    description: 'Start automatic tracking',
                    tooltip: 'Open the browser and connect your DSAFlow account.',
                    icon: 'account',
                    command: { command: 'dsaflow.login', title: 'Connect DSAFlow' },
                }),
                new SidebarTreeItem({
                    kind: 'summary',
                    label: 'Sync',
                    description: this.snapshot.syncLabel,
                    icon: this.snapshot.pendingCount > 0 ? 'cloud-upload' : 'cloud',
                }),
                new SidebarTreeItem({
                    kind: 'action',
                    label: 'Import Workspace History',
                    description: 'Scan existing files',
                    tooltip: 'Scan this workspace and bulk-import historical DSA files.',
                    icon: 'folder-opened',
                    command: { command: 'dsaflow.importWorkspace', title: 'Import Workspace History' },
                }),
            ];
        }

        const dueRevisionChildren: NodePayload[] = this.snapshot.dueRevisions.length
            ? this.snapshot.dueRevisions.map((problem) => ({
                kind: 'revision',
                label: problem.problemName,
                description: `${problem.topic} - ${problem.difficulty}`,
                tooltip: problem.problemUrl || problem.localPath || problem.problemName,
                icon: 'history',
                contextValue: 'dsaflow.revision',
                command: { command: 'dsaflow.openProblemItem', title: 'Open Problem', arguments: [problem] },
                problem,
            }))
            : [{
                kind: 'empty',
                label: 'Nothing due right now',
                description: 'You are caught up',
                icon: 'check',
            }];

        const recentProblemChildren: NodePayload[] = this.snapshot.recentProblems.length
            ? this.snapshot.recentProblems.map((problem) => ({
                kind: 'recent',
                label: problem.problemName,
                description: `${problem.platform} - ${problem.topic}`,
                tooltip: problem.problemUrl || problem.localPath || problem.problemName,
                icon: 'symbol-file',
                contextValue: 'dsaflow.recent',
                command: { command: 'dsaflow.openProblemItem', title: 'Open Problem', arguments: [problem] },
                problem,
            }))
            : [{
                kind: 'empty',
                label: 'No recent solves yet',
                description: 'Log your first problem',
                icon: 'circle-large-outline',
            }];

        const insightChildren: NodePayload[] = [];
        if (this.snapshot.strongestTopic) {
            insightChildren.push({
                kind: 'insight',
                label: `Strongest: ${this.snapshot.strongestTopic}`,
                icon: 'sparkle',
            });
        }
        if (this.snapshot.weakTopics.length) {
            insightChildren.push({
                kind: 'insight',
                label: `Weak: ${this.snapshot.weakTopics.join(', ')}`,
                icon: 'warning',
            });
        }
        if (this.snapshot.nextSuggestion) {
            insightChildren.push({
                kind: 'insight',
                label: this.snapshot.nextSuggestion,
                description: 'Suggested next move',
                icon: 'lightbulb',
                tooltip: this.snapshot.nextSuggestion,
            });
        }
        if (!insightChildren.length) {
            insightChildren.push({
                kind: 'empty',
                label: 'Solve a few problems to unlock learning insights',
                icon: 'sparkle',
            });
        }

        const achievementChildren: NodePayload[] = this.snapshot.achievements.length
            ? this.snapshot.achievements.map((title) => ({
                kind: 'achievement',
                label: title,
                icon: 'trophy',
            }))
            : [{
                kind: 'empty',
                label: 'Your first milestone is waiting',
                description: 'Log a problem to get started',
                icon: 'trophy',
            }];

        return [
            new SidebarTreeItem({
                kind: 'action',
                label: 'Import Workspace History',
                description: 'Scan current workspace',
                tooltip: 'Scan this workspace and bulk-import historical DSA files.',
                icon: 'folder-opened',
                command: { command: 'dsaflow.importWorkspace', title: 'Import Workspace History' },
            }),
            new SidebarTreeItem({
                kind: 'action',
                label: 'Log Current File',
                description: 'Manual fallback',
                tooltip: 'Log the currently active file into DSAFlow.',
                icon: 'add',
                command: { command: 'dsaflow.logCurrentFile', title: 'Log Current File' },
            }),
            new SidebarTreeItem({
                kind: 'summary',
                label: 'Today',
                description: `${this.snapshot.today} solve${this.snapshot.today === 1 ? '' : 's'}`,
                icon: 'flame',
            }),
            new SidebarTreeItem({
                kind: 'summary',
                label: 'Streak',
                description: `${this.snapshot.streak} day${this.snapshot.streak === 1 ? '' : 's'}`,
                icon: 'pulse',
            }),
            new SidebarTreeItem({
                kind: 'summary',
                label: 'Revision',
                description: `${this.snapshot.revisionDue} due`,
                icon: 'history',
            }),
            new SidebarTreeItem({
                kind: 'summary',
                label: 'Sync',
                description: this.snapshot.syncLabel,
                icon: this.snapshot.pendingCount > 0 ? 'cloud-upload' : 'cloud',
            }),
            new SidebarTreeItem({
                kind: 'section',
                label: 'Due Revisions',
                description: `${this.snapshot.dueRevisions.length}`,
                icon: 'history',
                collapsibleState: vscode.TreeItemCollapsibleState.Expanded,
                children: dueRevisionChildren,
            }),
            new SidebarTreeItem({
                kind: 'section',
                label: 'Recent Solves',
                description: `${this.snapshot.recentProblems.length}`,
                icon: 'clock',
                collapsibleState: vscode.TreeItemCollapsibleState.Expanded,
                children: recentProblemChildren,
            }),
            new SidebarTreeItem({
                kind: 'section',
                label: 'Learning Signals',
                icon: 'sparkle',
                collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
                children: insightChildren,
            }),
            new SidebarTreeItem({
                kind: 'section',
                label: 'Milestones',
                description: `${this.snapshot.achievements.length}`,
                icon: 'trophy',
                collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
                children: achievementChildren,
            }),
        ];
    }
}
