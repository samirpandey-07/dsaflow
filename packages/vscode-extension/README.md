# DSAFlow for VS Code

DSAFlow helps you track DSA solves directly from VS Code. It watches your solution files, sends solve metadata to your DSAFlow backend, and keeps your progress visible without switching tools.

## What it does

- Logs supported solution files when they are created
- Only auto-logs inside folders you explicitly approve
- Optionally prompts you to log saves for existing files
- Stores your auth token securely in VS Code SecretStorage
- Queues failed API requests and retries them later
- Opens your dashboard and quick stats from the Command Palette
- Lets you attach notes to the last logged problem

## Supported file types

- `.cpp`
- `.py`
- `.java`
- `.js`
- `.ts`

## Getting started

1. Install the extension.
2. Open your DSAFlow dashboard and sign in.
3. Run `DSAFlow: Sign In` from the Command Palette.
4. Run `DSAFlow: Manage Tracked Folders` and approve the folders DSAFlow may log from.
5. Configure the extension if your API or dashboard is not running on localhost.
6. Create or save a supported file like `Arrays/two_sum.cpp`.
7. DSAFlow logs the solve and offers to attach a note.

## Commands

- `DSAFlow: Sign In`
- `DSAFlow: Sign Out`
- `DSAFlow: Start Tracking`
- `DSAFlow: Stop Tracking`
- `DSAFlow: Open Dashboard`
- `DSAFlow: View Stats`
- `DSAFlow: Add Note to Last Problem`
- `DSAFlow: Retry Pending Sync`
- `DSAFlow: Manage Tracked Folders`
- `DSAFlow: Add Tracked Folder`
- `DSAFlow: Remove Tracked Folder`

## Settings

- `dsaflow.apiUrl`: Full API endpoint used to log solves.
- `dsaflow.dashboardUrl`: Dashboard URL opened by the extension.
- `dsaflow.watchedGlob`: Glob used by the file watcher.
- `dsaflow.requireFolderApproval`: Require explicit folder approval before auto-logging.
- `dsaflow.workspaceConfigFile`: Workspace config file that stores tracked folders.
- `dsaflow.autoLogOnCreate`: Automatically log new solution files.
- `dsaflow.promptOnSave`: Prompt before logging supported file saves.
- `dsaflow.promptForProblemUrl`: Ask for the source problem URL before logging.
- `dsaflow.defaultDifficulty`: Difficulty sent when the extension cannot infer one.
- `dsaflow.savePromptDebounceMs`: Debounce before the save prompt appears.

## Workspace config

DSAFlow stores approved and ignored folders in a workspace config file, `.dsaflow.json` by default:

```json
{
  "trackedFolders": ["Arrays", "DynamicProgramming"],
  "ignoredFolders": ["scratch"]
}
```

Only files inside `trackedFolders` are auto-logged when `dsaflow.requireFolderApproval` is enabled.

## Local development

```bash
npm install
npm run compile --workspace=packages/vscode-extension
```

To package the extension locally:

```bash
npm run package --workspace=packages/vscode-extension
```

## Publishing checklist

- Create or confirm your VS Code Marketplace publisher ID
- Update the `publisher` field in `package.json` if needed
- Confirm the production API and dashboard URLs
- Run `npm run check --workspace=packages/vscode-extension`
- Run `npm run package --workspace=packages/vscode-extension`
- Publish with `npx vsce publish`

## Repository

[GitHub repository](https://github.com/samirpandey-07/dsaflow)
