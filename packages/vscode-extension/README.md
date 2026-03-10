# DSAFlow for Visual Studio Code 🚀

**Master Your Data Structures & Algorithms with AI-Powered Insights and Spaced Repetition.**

DSAFlow is the ultimate companion for competitive programmers. It automatically tracks your solved problems, provides AI-powered code analysis, and helps you internalize concepts using a scientifically-backed Spaced Repetition System (SRS).

## Key Features

- 🕵️ **Automatic Detection**: Automatically detects when you're working on a DSA problem from LeetCode, GeeksforGeeks, and more.
- 📊 **Unified Dashboard**: View your progress, solve velocity, and topic mastery in a beautiful web dashboard.
- 🤖 **AI Code Analysis**: Get instant feedback on your time/space complexity and optimization tips (powered by Gemini AI).
- 🔥 **Streak & Growth**: Keep your momentum alive with streak tracking and detailed activity heatmaps.
- ⏰ **Smart Revisions**: Never forget a concept again. Our Spaced Repetition system tells you exactly when to revise.
- 🔒 **Secure & Private**: Your data is yours. Secure token storage using VS Code's native SecretStorage.

## Getting Started

1. **Install the Extension**: Install DSAFlow from the VS Code Marketplace.
2. **Setup your Dashboard**: Visit the [DSAFlow Dashboard](http://localhost:3000) (if running locally) and sign up.
3. **Login in VS Code**:
   - Open the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`).
   - Run `DSAFlow: Login`.
   - Enter your secure access token from your Dashboard settings.
4. **Start Solving**: Simply create or open a file (e.g., `two-sum.py`) and include the problem URL in a comment. DSAFlow will do the rest!

## Extension Commands

- `DSAFlow: Login` - Securely store your access token.
- `DSAFlow: View Stats` - View your breakdown of solved problems right inside VS Code.
- `DSAFlow: Open Dashboard` - Jump straight to your detailed web analytics.
- `DSAFlow: Add Note to Last Problem` - Quickly jot down thoughts on the problem you just solved.
- `DSAFlow: Start Tracking` / `Stop Tracking` - Manually control the file watcher.

## Settings

Customize the extension via your `settings.json`:

- `dsaflow.apiUrl`: The URL of your DSAFlow backend API.
- `dsaflow.dashboardUrl`: The URL of your DSAFlow dashboard.

## Contributing

We love contributions! Check out our [GitHub repository](https://github.com/dsaflow/dsaflow) to get started.

---
**Built with ❤️ for the competitive programming community.**
