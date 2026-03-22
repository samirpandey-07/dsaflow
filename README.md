# 🚀 DSAFlow

**Automatic DSA Practice Tracker, Revision Engine & Developer Productivity Tool**

DSAFlow is a **full-stack developer productivity platform** that automatically tracks your Data Structures & Algorithms practice directly from your coding environment and transforms it into a **learning analytics system with spaced repetition, streak tracking, and real-time insights**.

Instead of manually maintaining logs or spreadsheets, **DSAFlow turns the simple act of saving a solution file into structured learning data.**

---

# 📌 Table of Contents

* [Overview](#-overview)
* [Features](#-key-features)
* [Architecture](#-system-architecture)
* [Monorepo Structure](#-monorepo-structure)
* [Data Flow](#-data-flow)
* [Database Schema](#-database-schema)
* [Installation](#-installation)
* [Running the Project](#-running-the-project)
* [VS Code Extension Usage](#-vs-code-extension-usage)
* [API Endpoints](#-api-endpoints)
* [Configuration](#-configuration)
* [Deployment](#-deployment)
* [Roadmap](#-future-roadmap)
* [Contributing](#-contributing)
* [Author](#-author)

---

# 🧠 Overview

DSAFlow is designed for developers and students preparing for coding interviews or competitive programming.

It connects **VS Code → Backend → Database → Dashboard** to automatically track problems solved and schedule revision sessions using **spaced repetition**.

The system provides:

* 🕵️ Automatic logging of solved problems
* 📊 Real-time analytics
* 💡 Topic mastery insights
* ⏰ Revision reminders
* 🏎️ Learning velocity metrics

---

# ✨ Key Features

### ⚡ Automatic Problem Tracking
The VS Code extension detects when you create a new solution file and logs the problem automatically.

Example:
```
Arrays/two_sum.cpp
```
Automatically extracts:
- **Topic**: Arrays
- **Problem**: two_sum
- **Language**: C++

### 🔁 Spaced Repetition Revision System
DSAFlow schedules problem reviews using scientifically-backed intervals:
- 1 day
- 3 days
- 7 days
- 14 days
- 30 days

This helps reinforce long-term retention of complex algorithms.

### 🔥 Streak Tracking
Maintains daily practice streaks to keep you motivated.
Example:
- 🔥 7 Day Streak
- 🏆 Longest Streak: 15

### 📊 Real-Time Dashboard
The dashboard updates instantly using **Supabase Realtime WebSockets**.
Visual analytics include:
- Activity Heatmap
- Topic Mastery Chart (Progress breakdown)
- Difficulty Distribution (Easy, Medium, Hard)
- Revision Queue (Priority items)
- Learning Velocity (Solves per day)

### 🤖 Intelligent Technical Review
Each solved problem can be analyzed using **Google Gemini** for instant feedback.
Analysis includes:
- Time complexity (Big O)
- Space complexity
- Potential edge cases
- Actionable optimization suggestions

---

# 🏗 System Architecture

```
VS Code Extension
        ↓
Express API
        ↓
Supabase PostgreSQL
        ↓
Realtime WebSockets
        ↓
Next.js Dashboard
```

### Components

| Layer             | Technology            | Purpose                     |
| ----------------- | --------------------- | --------------------------- |
| VS Code Extension | TypeScript            | Detects solved problems     |
| Backend API       | Node.js / Express     | Validation + Business Logic |
| Database          | Supabase / PostgreSQL | Persistent Storage          |
| Dashboard         | Next.js 15            | Visualization + Analytics   |

---

# 📂 Monorepo Structure

```
dsaflow
│
├── apps
│   ├── api
│   │   └── Express backend
│   │
│   └── dashboard
│       └── Next.js frontend
│
├── packages
│   └── vscode-extension
│       └── VS Code extension
│
├── .github/workflows
│   └── CI/CD pipelines
│
└── README.md
```

---

# 🔄 Data Flow

1. **User creates solution file** in VS Code.
2. **VS Code Extension detects file** and extracts title/topic.
3. **Metadata extracted** via user prompt (Platform/Difficulty).
4. **POST request to API** with secure token.
5. **Supabase database stores record** and updates user stats.
6. **Realtime event triggers dashboard update** via WebSockets.

---

# 🗄 Database Schema

### Problems Table
| Column           | Type        | Description                     |
| ---------------- | ----------- | ------------------------------- |
| id               | UUID        | Primary Key                     |
| user_id          | TEXT        | Owner ID                        |
| problem_name     | TEXT        | Name of the problem             |
| topic            | TEXT        | e.g., Arrays, DP, Strings       |
| language         | TEXT        | e.g., Python, C++, Java         |
| difficulty       | TEXT        | Easy, Medium, Hard              |
| platform         | TEXT        | e.g., LeetCode, GFG             |
| revision_count   | INT         | Times revised                   |
| next_revision_at | TIMESTAMPTZ | Scheduled revision date         |
| solved_at        | TIMESTAMPTZ | Initial solve timestamp         |

### User Stats
| Column          | Type | Description                     |
| --------------- | ---- | ------------------------------- |
| user_id         | TEXT | Primary Key                     |
| current_streak  | INT  | Active consecutive days         |
| longest_streak  | INT  | All-time record                 |
| last_solve_date | DATE | Last day a problem was recorded |

---

# ⚙ Installation

1. **Clone the repository**
```bash
git clone https://github.com/samirpandey-07/dsaflow.git
cd dsaflow
```

2. **Install dependencies**
```bash
npm install
```

---

# ▶ Running the Project

### Start Backend
```bash
cd apps/api
# Add .env with your Supabase/Gemini keys
npm run dev
```
Server runs at `https://dsaflow.onrender.com`

### Start Dashboard
```bash
cd apps/dashboard
# Add .env.local with Supabase keys
npm run dev
```
Open `https://dsaflow-dashboard.vercel.app`

### Run VS Code Extension
1. Open `packages/vscode-extension` in VS Code.
2. Press `F5` to launch the **Extension Development Host**.

---

# 🧩 VS Code Extension Usage

1. Create a file with a structured name (e.g., `Arrays/two_sum.cpp`).
2. Include the problem URL in a comment.
3. The extension will automatically:
   - Detect file creation.
   - Ask for platform and difficulty.
   - Send problem metadata to the API.
   - Update your dashboard stats in real-time.

---

# 📡 API Endpoints

| Endpoint                  | Method | Purpose                 |
| ------------------------- | ------ | ----------------------- |
| `/api/problems`           | POST   | Log solved problem      |
| `/api/problems/:id/revise` | POST   | Mark revision completed |
| `/api/revision-queue`     | GET    | Get problems to revise  |
| `/api/analytics/velocity` | GET    | Solve velocity stats    |
| `/api/user/stats`         | GET    | Streak statistics       |
| `/api/problems/:id/analyze`| POST   | Intelligent analysis    |

---

# ⚙ Configuration

### Backend (.env)
Create `apps/api/.env` from `apps/api/.env.example` and fill in values.

```env
SUPABASE_URL=your_url
SUPABASE_ANON_KEY=your_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Optional
GEMINI_API_KEY=your_key
REDIS_URL=redis://localhost:6379
RESEND_API_KEY=your_key
FROM_EMAIL=onboarding@resend.dev
PORT=3001
```

### Dashboard (.env.local)
Create `apps/dashboard/.env.local` from `apps/dashboard/.env.local.example` and fill in values.

```env
NEXT_PUBLIC_SUPABASE_URL=your_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_key
NEXT_PUBLIC_API_URL=https://dsaflow.onrender.com
```

### Helpful scripts
From the repo root you can run:
- `npm run supabase:link` (link to a Supabase project)
- `npm run supabase:push` (apply migrations to the linked project)
- `npm run supabase:start` (start local Supabase dev stack)
- `npm run supabase:stop` (stop local Supabase stack)

---

# 🚀 Deployment

| Service          | Recommended Stack |
| ---------------- | ----------------- |
| **Frontend**     | Vercel            |
| **Backend**      | Railway / Render  |
| **Database**     | Supabase          |

---

# 🛣 Future Roadmap

- [ ] GitHub / Google OAuth Integration
- [ ] Redis caching for high-performance analytics
- [ ] Automated Weekly Email Digests (Resend)
- [ ] Advanced Graph Visualization for Topic Dependencies
- [ ] Mobile-native tracking companion app

---

# 🤝 Contributing

Contributions are welcome!
1. Fork the repository.
2. Create a feature branch (`git checkout -b feature/cool-feature`).
3. Commit changes (`git commit -m 'Add cool feature'`).
4. Push to branch (`git push origin feature/cool-feature`).
5. Open a Pull Request.

---

# 👨‍💻 Author

**Samir Pandey**
B.Tech CSE Student | Full-Stack Developer | Systems Builder

- **GitHub**: [github.com/samirpandey-07](https://github.com/samirpandey-07)
- **LinkedIn**: [linkedin.com/in/samir-pandey](https://linkedin.com/in/samir-pandey-418086256/)

Samir designed and built **DSAFlow** to streamline the coding practice workflow for developers worldwide.

---

# ⭐ Support the Project

If you find this project useful:
- Star the repository ⭐
- Share it with other developers
- Contribute improvements

**DSAFlow — Turning coding practice into a structured learning system.**
