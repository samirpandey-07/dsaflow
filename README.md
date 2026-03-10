# DSAFlow

**DSAFlow** is a premium problem-tracking dashboard and VS Code extension designed to help you master Data Structures and Algorithms with zero friction. It automatically logs your solves, tracks your topic mastery, and provides beautiful analytics—all while you stay focused in your editor.

## ✨ Features

- 🛠️ **Seamless Tracking**: Automatically detects when you solve problems in VS Code.
- 📊 **Beautiful Analytics**: Topic mastery bar charts, difficulty distribution split, and GitHub-style activity heatmaps.
- ⚡ **Real-time Sync**: Uses Supabase Realtime to update your dashboard instantly the moment you save a file.
- 📝 **Quick Notes**: Prompted to add edge-case notes or time complexity insights after every solve.
- 🎮 **Gamification**: Daily solve counts, status bar widgets, and achievement notifications.

## 🏗️ Architecture

DSAFlow is built as a scalable monorepo:

- **`apps/api`**: Express.js backend with Zod validation and Swagger documentation.
- **`apps/dashboard`**: Next.js (App Router) frontend with Recharts and Tailwind CSS.
- **`packages/vscode-extension`**: TypeScript extension for VS Code with interactive metadata prompts.
- **`supabase`**: Database migrations and configuration for the live PostgreSQL/Auth/Realtime backend.

---

## Quick Start (Docker)

The fastest way to get the full stack running:

1. **Clone the repository**:

   ```bash
   git clone https://github.com/samirpandey-07/dsaflow.git
   cd dsaflow
   ```
2. **Configure Environment Variables**:
   Create a `.env` file in the root:

   ```env
   SUPABASE_URL=your_supabase_project_url
   SUPABASE_ANON_KEY=your_supabase_anon_key
   ```
3. **Spin up with Docker**:

   ```bash
   docker-compose up --build
   ```

   - **Dashboard**: `http://localhost:3000`
   - **API Docs**: `http://localhost:3001/api-docs`

---

## 🛠️ Local Development

### Prerequisites

- Node.js 18+
- Supabase Project

### Installation

```bash
npm install
npm run dev --workspaces
```

### VS Code Extension Setup

1. Open the `packages/vscode-extension` folder in VS Code.
2. Press `F5` to open the **Extension Development Host**.
3. Open VS Code Settings (`Ctrl+,`) and search for **DSAFlow**:
   - Set **Api Url**: `http://localhost:3001/api/problems`
   - Set **Token**: Your Supabase Anon Key.

---

## 📖 API Documentation

The API comes with built-in interactive Swagger documentation. When the API is running, visit:
👉 **`http://localhost:3001/api-docs`**

---

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.
