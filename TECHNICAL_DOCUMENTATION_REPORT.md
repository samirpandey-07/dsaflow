# DSAFlow Technical Documentation

## 1. Project Overview

**Project name:** DSAFlow

**Purpose**
DSAFlow is a monorepo that combines a VS Code extension, a REST API, a background worker, a Supabase/PostgreSQL data layer, and a Next.js dashboard into a single developer-productivity platform for tracking data structures and algorithms practice.

**Problem it solves**
Students and interview-prep developers usually track solved problems manually in spreadsheets, notebooks, or memory. That leads to inconsistent logging, weak revision habits, no structured analytics, and unnecessary context switching between editor and browser. DSAFlow turns editor activity into structured learning data and builds revision, analytics, and progress-sharing on top of it.

**Target users**
- students preparing for coding interviews
- competitive programmers
- self-taught developers doing structured DSA practice
- VS Code-first users who want reduced context switching

**Key implemented features**
- automatic DSA file detection in VS Code
- browser-based sign-in flow for the extension
- metadata inference from file path, filename, comments, and problem URLs
- deduplicated problem logging
- offline queue and retry for extension events
- dashboard analytics for activity, difficulty, topic, platform, streaks, and revisions
- spaced repetition revision scheduling and queue management
- AI-based per-problem analysis via Gemini with fallback mock analysis
- notes per problem
- workspace history import from local files
- platform importers for Codeforces, LeetCode, GeeksforGeeks, and CSV
- goals and interview-readiness scoring
- public profiles and SVG README badge generation
- weekly digest and revision reminder jobs

**Application type**
- monorepo
- web app
- REST API
- background worker
- VS Code extension

**High-level architecture**
- VS Code extension detects work and sends authenticated events to the API.
- API validates input, applies business rules, and writes to Supabase/PostgreSQL.
- Dashboard reads authenticated API endpoints and listens to Supabase realtime notifications.
- Worker process runs email and reminder jobs against Redis/BullMQ and Supabase.
- Public profile and badge features read from a denormalized public snapshot table.

Key entry points:
- API server: [index.js](/D:/ext/dsaflow/apps/api/index.js)
- API route registry: [index.js](/D:/ext/dsaflow/apps/api/src/routes/index.js)
- worker: [worker.js](/D:/ext/dsaflow/apps/api/worker.js)
- dashboard home: [page.tsx](/D:/ext/dsaflow/apps/dashboard/src/app/page.tsx)
- extension activation: [extension.ts](/D:/ext/dsaflow/packages/vscode-extension/src/extension.ts)

---

## 2. Tech Stack Summary

### Frontend

| Technology | What it is | Why used here | Pros in this project | Tradeoffs | Alternatives |
|---|---|---|---|---|---|
| Next.js 15 | React framework with routing and production build/runtime tooling | The dashboard needs file-based routing, metadata management, and production-ready builds | Clean `src/app` structure, Vercel-friendly, standalone output support | Current dashboard is mostly client-rendered, so SSR benefits are underused | Vite + React Router, Remix, Astro |
| React 19 | UI library | The dashboard is component-driven and stateful | Mature ecosystem, good fit for analytics UI | Client-heavy rendering | Vue, Svelte, Solid |
| TypeScript | Static typing | Used in dashboard and extension for safer refactors | Better contracts and tooling | No shared types package across apps | JavaScript, JSDoc typing |
| Tailwind CSS v4 | Utility-first styling | Fast iteration on a custom visual language | Highly expressive and consistent | Long JSX class strings | CSS Modules, styled-components |
| React Query | Server-state library | The dashboard reads many API endpoints and needs caching/invalidation | Clear query boundaries and caching | Invalidation is still broad in places | SWR, RTK Query |
| Supabase JS | Browser auth/realtime client | Dashboard uses Supabase sessions and realtime | Simple auth integration | Vendor coupling | Auth.js + custom websocket layer |
| Supabase Auth UI | Prebuilt auth UI | Login uses Google and GitHub OAuth | Fast auth integration | Less control than custom auth UI | Custom login screen |
| Recharts | Charting library | Dashboard visualizes topic/platform/difficulty stats | Easy React integration | Accessibility and large-data limits | Chart.js, Visx, ECharts |
| Framer Motion | Animation library | Used for card and modal transitions | High-quality motion primitives | Extra client bundle cost | CSS transitions, Motion One |
| Lucide React | Icon library | Used throughout UI | Clean consistent icons | Added bundle weight and previously surfaced stale chunk issues until build hardening | Heroicons, Phosphor |
| ESLint + eslint-config-next | Lint tooling | Static quality checks for dashboard | Standard Next.js setup | No repo-wide shared lint policy | Biome, custom ESLint |

### Backend

| Technology | What it is | Why used here | Pros in this project | Tradeoffs | Alternatives |
|---|---|---|---|---|---|
| Node.js | JavaScript runtime | Keeps API, worker, and extension in the same language ecosystem | Lower context-switch cost across the monorepo | CPU-heavy analytics can become less efficient at scale | Go, Python, Rust |
| Express 5 | Minimal HTTP framework | API is REST-oriented and modular | Simple and widely understood | Less opinionated architecture | Fastify, NestJS |
| Zod | Runtime validation library | API accepts many user-originated payloads | Strong request validation and good error messages | Schemas are not shared to frontend/extension | Joi, Yup, Valibot |
| Supabase JS | Server-side DB/auth SDK | API talks directly to Supabase for auth and Postgres access | Simple query builder, auth-scoped clients | Less type-safe than a typed ORM | Prisma, Drizzle, `pg` |
| Swagger JSDoc + Swagger UI | API docs generation and UI | `/api-docs` exists for API discoverability | Easy to integrate with Express | Limited value without richer route annotations | Redoc, handwritten OpenAPI |
| Helmet | Security middleware | Basic HTTP hardening | Good default security baseline | Only one layer of security | Custom header setup |
| CORS | Cross-origin middleware | Dashboard and API run on separate origins | Necessary browser access control | Misconfiguration can block or overexpose clients | Same-origin reverse proxy |
| Morgan | Request logger | Basic request visibility | Simple dev/prod logs | Unstructured logging only | Pino HTTP, Winston |
| express-rate-limit | Throttling middleware | Protects `/api` from abuse | Easy global limiter | Coarse policy can hit legitimate use cases | Redis-backed limiter |
| BullMQ | Redis-backed jobs | Needed for reminders and digests | Clear worker model and repeatable cron jobs | Requires Redis and a dedicated worker | Temporal, serverless cron |
| ioredis | Redis client | Powers cache and BullMQ | Mature Redis support | Additional operational dependency | node-redis |
| Resend | Email delivery API | Sends reminders and digests | Simple API | External dependency and configuration burden | SES, SendGrid, Postmark |
| Google Generative AI SDK | Gemini SDK | Per-problem AI analysis feature | Direct model integration | Upstream dependency, parsing brittleness | OpenAI SDK, Anthropic SDK |
| dotenv | Env loader | Local/dev env bootstrap | Conventional and simple | Not enough alone for prod secret hygiene | platform-native env config |
| jsonwebtoken | JWT utility | Declared dependency | Could support manual JWT handling | Not referenced in inspected API code | Remove if unused |

### Database and infrastructure

| Technology | What it is | Why used here | Pros in this project | Tradeoffs | Alternatives |
|---|---|---|---|---|---|
| PostgreSQL via Supabase | Relational database | Fits structured per-user analytics and revision data | Strong querying, views, aggregates | Some analytics still fall back to app-side computation | MySQL, SQLite |
| Supabase Auth | Managed auth | Social login and JWT auth across dashboard and extension | Unified auth + DB + RLS model | Supabase-specific coupling | Auth.js, Clerk |
| Supabase CLI migrations | SQL migration workflow | Schema is now versioned under `supabase/migrations` | Better than manual SQL drift | Historical migration complexity remains | Prisma Migrate, Drizzle Kit |
| PostgreSQL views | Derived analytics surfaces | Topic/platform/activity/difficulty analytics use DB aggregations | Pushes work closer to the data | Not materialized yet | Materialized views, aggregate tables |
| Row-Level Security | DB authorization | Multi-tenant app needs user ownership enforced at DB layer | Strong defense beyond API checks | Requires disciplined policy maintenance | API-only auth, which is weaker |
| GitHub Actions | CI platform | Repo is on GitHub and needs basic validation | Simple matrix builds | No API tests or e2e coverage yet | CircleCI, Buildkite |
| Docker / Docker Compose | Container packaging and local orchestration | API, worker, and dashboard all have container definitions | Portable local/prod story | Current files are simple and not deeply optimized | buildpacks, Nix |
| VS Code Marketplace tooling | Extension packaging/publishing | Needed for `.vsix` packaging and publishing | Standard extension release path | Requires publisher and PAT setup | Open VSX tooling |

---

## 3. Frontend Architecture

### Structure
The dashboard is a Next.js App Router application under `apps/dashboard/src/app`.

Primary route files:
- [layout.tsx](/D:/ext/dsaflow/apps/dashboard/src/app/layout.tsx)
- [providers.tsx](/D:/ext/dsaflow/apps/dashboard/src/app/providers.tsx)
- [page.tsx](/D:/ext/dsaflow/apps/dashboard/src/app/page.tsx)
- [login/page.tsx](/D:/ext/dsaflow/apps/dashboard/src/app/login/page.tsx)
- [settings/page.tsx](/D:/ext/dsaflow/apps/dashboard/src/app/settings/page.tsx)
- [u/[slug]/page.tsx](/D:/ext/dsaflow/apps/dashboard/src/app/u/[slug]/page.tsx)
- [not-found.tsx](/D:/ext/dsaflow/apps/dashboard/src/app/not-found.tsx)

### Routing system
- `/` is the authenticated dashboard
- `/login` is the Supabase social auth entry point
- `/settings` is the control center for profile, goals, imports, and badge/email features
- `/u/[slug]` is the public profile page
- `not-found.tsx` is a custom 404 experience

### Component hierarchy
The home page composes:
- hero shell and summary cards
- `InsightsPanel`
- `InterviewReadinessCard`
- `GoalsPanel`
- `ActivityHeatmap`
- `RevisionQueue`
- `TopicMasteryChart`
- `DifficultyPieChart`
- `PlatformBreakdown`
- `AchievementsGrid`
- `ProblemsList`
- `ProfileModal`

The settings page composes local forms and API actions for:
- public profile editing
- README badge copy
- goals CRUD
- import triggers
- connected platform profiles
- digest email trigger

The public profile page renders:
- display name, headline, bio
- total solved
- streak
- interview readiness
- top topics
- achievements
- recent solves

### State management
The dashboard uses:
- local `useState` for modals, forms, filters, and transient messages
- React Query for server state

There is no Redux, Zustand, or global client store.

### Data fetching
`apiFetch()` in [api.ts](/D:/ext/dsaflow/apps/dashboard/src/lib/api.ts):
- builds `NEXT_PUBLIC_API_URL + "/api"`
- reads bearer token from Supabase session using [auth.ts](/D:/ext/dsaflow/apps/dashboard/src/lib/auth.ts)
- unwraps both `{ status, data }` and raw JSON payloads

Main dashboard queries run in parallel:
- overview
- activity
- topics
- platforms
- revisions
- achievements
- insights
- goals
- readiness
- problem-lite list
- health

### Real-time behavior
The dashboard subscribes to `postgres_changes` for the `public.problems` table using Supabase Realtime.
It does not patch local state directly. It invalidates query groups when inserts, deletes, or relevant updates happen.

### Styling methodology
- Tailwind CSS v4 utilities embedded directly in JSX
- dark glass-panel visual language
- `Inter` and `Outfit` fonts
- Framer Motion for transitions and entrance animations

### Forms and validation
- no form library
- no shared frontend validation schema layer
- forms are controlled with `useState`
- backend validation is the primary source of truth
- login is handled by Supabase Auth UI

### Performance design
- charts and heavy UI blocks are dynamically imported with `ssr: false`
- React Query caches server state with a 60-second `staleTime`
- Next build runs a forced clean before build to avoid stale `.next` chunk issues
- `next.config.ts` enables `output: "standalone"` and `bundlePagesRouterDependencies: true`

### Accessibility considerations
The frontend uses native buttons, inputs, selects, and textareas in many places, which gives it a baseline level of accessibility. There is no dedicated accessibility library, audit pipeline, or custom dialog primitive in the inspected code. Charts and highly stylized visual sections rely mostly on visual interpretation rather than explicit text alternatives.

### Reusable components
Important components under `src/components`:
- `ActivityHeatmap`
- `AchievementsGrid`
- `CodeAnalysisModal`
- `CodeViewerModal`
- `DifficultyPieChart`
- `GoalsPanel`
- `InsightsPanel`
- `InterviewReadinessCard`
- `NoteModal`
- `PlatformBreakdown`
- `ProblemsList`
- `ProfileModal`
- `RevisionQueue`
- `TopicMasteryChart`
- `SWBypass`

`SWBypass` is operationally important. It unregisters service workers on mount so stale cached assets do not survive dashboard deploys.

---

## 4. Backend Architecture

### Server structure
The API is started from [index.js](/D:/ext/dsaflow/apps/api/index.js). The worker is a separate process started from [worker.js](/D:/ext/dsaflow/apps/api/worker.js).

The backend uses a layered module structure:
- routes receive HTTP requests
- middleware handles auth and cross-cutting concerns
- services implement business logic
- repositories wrap table/view access through Supabase
- helper modules provide HTTP envelopes, parsing, cache access, and client creation

### API style
The API is REST-style JSON over HTTP.
Main route groups:
- `/problems`
- `/analytics/*`
- `/revision-queue`
- `/notes`
- `/achievements`
- `/topics`
- `/metadata/resolve`
- `/goals`
- `/interview-readiness`
- `/public-profiles/*`
- `/imports/*`
- `/platform-profiles`
- `/email/send-digest`
- `/health`
- `/healthz`

Most endpoints return `{ status: "success", data }`. Two exceptions currently return raw JSON:
- `GET /api/stats`
- `GET /api/analytics/velocity`

### Route organization
Routes are mounted by [index.js](/D:/ext/dsaflow/apps/api/src/routes/index.js). The old [api.js](/D:/ext/dsaflow/apps/api/src/routes/api.js) is now only a compatibility shim that re-exports the new route index.

Primary route files:
- [problems.routes.js](/D:/ext/dsaflow/apps/api/src/routes/problems.routes.js)
- [analytics.routes.js](/D:/ext/dsaflow/apps/api/src/routes/analytics.routes.js)
- [revisions.routes.js](/D:/ext/dsaflow/apps/api/src/routes/revisions.routes.js)
- [notes.routes.js](/D:/ext/dsaflow/apps/api/src/routes/notes.routes.js)
- [achievements.routes.js](/D:/ext/dsaflow/apps/api/src/routes/achievements.routes.js)
- [topics.routes.js](/D:/ext/dsaflow/apps/api/src/routes/topics.routes.js)
- [email.routes.js](/D:/ext/dsaflow/apps/api/src/routes/email.routes.js)
- [metadata.routes.js](/D:/ext/dsaflow/apps/api/src/routes/metadata.routes.js)
- [goals.routes.js](/D:/ext/dsaflow/apps/api/src/routes/goals.routes.js)
- [public.routes.js](/D:/ext/dsaflow/apps/api/src/routes/public.routes.js)
- [imports.routes.js](/D:/ext/dsaflow/apps/api/src/routes/imports.routes.js)

### Middleware
Global middleware order in [index.js](/D:/ext/dsaflow/apps/api/index.js):
1. `helmet()`
2. `cors(...)`
3. `morgan('dev')`
4. `express.json()`
5. global rate limiter applied to `/api`
6. mounted API routes
7. root health text response
8. global error handler

Auth middleware in [auth.js](/D:/ext/dsaflow/apps/api/src/middleware/auth.js):
- reads bearer token from `Authorization`
- calls `supabase.auth.getUser(token)`
- rejects unauthorized requests with 401
- attaches `req.user`
- attaches `req.supabase` as a token-scoped Supabase client

### Service and repository layers
Core services:
- `problem.service.js`
- `analytics.service.js`
- `revision.service.js`
- `analysis.service.js`
- `metadata.service.js`
- `note.service.js`
- `goal.service.js`
- `readiness.service.js`
- `public-profile.service.js`
- `importer.service.js`
- `streak.service.js`
- `cache.service.js`

Core repositories:
- `problem.repository.js`
- `stats.repository.js`
- `goal.repository.js`
- `public-profile.repository.js`
- `platform-profile.repository.js`
- `note.repository.js`
- `topic.repository.js`

This is not an ORM-driven design. The repositories are thin wrappers over Supabase query-builder calls.

### Validation
Validation is centralized in [schemas.js](/D:/ext/dsaflow/apps/api/src/validation/schemas.js) using Zod.

Validated payload types include:
- problem create
- bulk import
- problem update
- note create
- goal create/update
- public profile update
- platform import
- CSV import

Query parameters are validated more lightly through manual parsing helpers such as `parsePositiveInt`.

### Error handling
- route handlers wrap logic in `try/catch`
- validation failures return 400 with Zod issue details
- services attach `error.status` for domain-level failures like 403 and 404
- a global Express error handler returns sanitized messages in production

### Security
Implemented backend controls:
- Supabase JWT verification
- token-scoped request clients
- database row-level security
- production CORS allowlist support
- Helmet security headers
- rate limiting on `/api`
- separation between anon-key request access and service-role worker access

### Background jobs
The worker process is intentionally separate from the API. `initJobs()` in [index.js](/D:/ext/dsaflow/apps/api/src/jobs/index.js) only initializes jobs when `REDIS_URL` exists.

Implemented jobs:
- daily revision reminder at `08:00 UTC`
- weekly digest at `Monday 09:00 UTC`

Job behavior:
- both jobs use BullMQ and Redis
- both require service-role access for admin-style lookups
- email sending is performed through Resend when configured
- jobs degrade gracefully when email is not configured, but the dedicated worker exits if required job infrastructure is unavailable

### External integrations
- Supabase Auth
- Supabase Postgres
- Supabase Realtime publication configuration
- Google Gemini API
- Redis
- BullMQ
- Resend
- Codeforces public API
- LeetCode public GraphQL
- GeeksforGeeks public profile HTML parsing

### API endpoint inventory

#### Health
| Endpoint | Method | Auth | Request | Response | Business logic |
|---|---|---|---|---|---|
| `/api/health` | GET | No | None | `{ status: "ok" }` | lightweight liveness check |
| `/api/healthz` | GET | No | None | `{ status, timestamp, uptime }` | health plus runtime metadata |

#### Problems
| Endpoint | Method | Auth | Request | Response | Business logic |
|---|---|---|---|---|---|
| `/api/problems` | POST | Yes | problem payload with topic/problem/difficulty/language/platform/url/code/tags/optional solved time | problem row; `201` if new, `200` if duplicate identity already exists | validates, deduplicates, inserts or returns existing, upserts topics, rebuilds streak stats, invalidates cache, refreshes public profile snapshot |
| `/api/problems/bulk-import` | POST | Yes | `{ problems: ProblemInput[] }` | `{ imported, problems }` | bulk import with duplicate skipping and post-import stats/profile refresh |
| `/api/problems` | GET | Yes | query params `limit`, `cursor`, `search`, `topic`, `difficulty`, `platform`, `revision_status`, `sort_by`, `sort_order` | `{ items, next_cursor, has_next_page }` | filterable and sortable list, cursor-based for `solved_at`, cache-backed |
| `/api/problems/:id` | PATCH | Yes | partial problem fields | updated problem row | updates owned problem, invalidates caches, refreshes public profile |
| `/api/problems/:id` | DELETE | Yes | none | `{ deleted: true }` | deletes owned problem, rebuilds streak stats, invalidates caches, refreshes public profile |
| `/api/problems/:id/analyze` | POST | Yes | optional `{ code }` | analysis object | uses Gemini if configured, otherwise returns a deterministic fallback analysis |

#### Analytics and achievements
| Endpoint | Method | Auth | Request | Response | Business logic |
|---|---|---|---|---|---|
| `/api/stats` | GET | Yes | none | raw `{ solved, easy, medium, hard }` | difficulty stats summary |
| `/api/user/stats` | GET | Yes | none | `{ current_streak, longest_streak, last_solve_date }` | persisted user streak row |
| `/api/analytics/velocity` | GET | Yes | none | raw `{ solves_last_7_days, daily_velocity }` | 7-day velocity from view |
| `/api/analytics/activity` | GET | Yes | optional `days` | `[{ date, count }]` | daily solve counts from view or fallback reconstruction |
| `/api/analytics/platforms` | GET | Yes | none | `[{ platform, count }]` | platform breakdown from view or fallback |
| `/api/analytics/topics` | GET | Yes | none | topic mastery rows | topic breakdown from view or fallback |
| `/api/analytics/overview` | GET | Yes | none | overview KPIs | combines counts, streaks, revision due, topic/platform summary |
| `/api/analytics/insights` | GET | Yes | none | insight object | strongest/weakest topics, difficulty progression, suggestion heuristics |
| `/api/achievements` | GET | Yes | none | achievement list | milestone badges from solve count, hard solves, and streaks |

#### Revision and notes
| Endpoint | Method | Auth | Request | Response | Business logic |
|---|---|---|---|---|---|
| `/api/problems/:id/revise` | POST | Yes | `{ action?: "complete" \| "snooze", days?: number }` | updated problem row | increments revision count and schedules next interval, or snoozes for given days |
| `/api/revision-queue` | GET | Yes | none | `{ due_today, overdue, upcoming, counts }` | buckets revision items and returns queue slices plus counts |
| `/api/notes` | POST | Yes | `{ problem_id, note }` | created note row(s) | verifies ownership of parent problem and inserts note |
| `/api/problems/:id/notes` | GET | Yes | none | note list | verifies ownership and lists notes newest-first |

#### Metadata, topics, goals, public profile, imports, email
| Endpoint | Method | Auth | Request | Response | Business logic |
|---|---|---|---|---|---|
| `/api/topics` | GET | No | none | topic rows | public topic metadata |
| `/api/metadata/resolve` | POST | Yes | `url`, `file_name`, `topic_hint`, `path_hint`, `difficulty_hint`, `tags_hint` | resolved metadata | platform-aware metadata inference with fallback |
| `/api/goals` | GET | Yes | none | `{ goals, summary }` | returns goals with computed progress |
| `/api/goals` | POST | Yes | goal payload | created goal | validates and inserts |
| `/api/goals/:id` | PATCH | Yes | partial goal payload | updated goal | updates owned goal |
| `/api/goals/:id` | DELETE | Yes | none | `{ deleted: true }` | deletes owned goal |
| `/api/interview-readiness` | GET | Yes | none | readiness object | weighted readiness score and recommendations |
| `/api/public-profiles/me` | GET | Yes | none | profile snapshot | current user profile draft or saved snapshot |
| `/api/public-profiles/me` | PUT | Yes | editable profile fields | saved profile row | validates, upserts, recomputes snapshot, enforces slug uniqueness |
| `/api/public-profiles/:slug` | GET | No | none | public profile | reads `is_public=true` snapshot |
| `/api/public-profiles/:slug/badge.svg` | GET | No | none | SVG | public badge rendering with cache header |
| `/api/platform-profiles` | GET | Yes | none | platform profile list | connected import snapshots |
| `/api/imports/csv` | POST | Yes | CSV text or problem array | importer result | validates and bulk-imports parsed rows |
| `/api/imports/codeforces` | POST | Yes | `{ handle, limit? }` | importer result | imports unique accepted problems and stores platform snapshot |
| `/api/imports/leetcode` | POST | Yes | `{ handle, limit? }` | importer result | imports recent accepted public solves plus profile snapshot |
| `/api/imports/geeksforgeeks` | POST | Yes | `{ handle, limit? }` | importer result | stores public profile snapshot only |
| `/api/email/send-digest` | POST | Yes | none | success or service-not-configured message | triggers weekly digest generation for current user |

---

## 5. Database and Data Model

### Database choice
DSAFlow uses PostgreSQL through Supabase. This fits the current domain because the system has strongly relational entities, ownership rules, analytics queries, views, and JWT-aware database authorization through RLS.

There is no ORM. Database access is written directly with the Supabase query builder.

### Migration history
The schema is tracked in `supabase/migrations`.

Migration files present:
- `20260309000000_init_schema.sql`
- `20260309000001_add_platform_and_realtime.sql`
- `20260309000002_revision_system.sql`
- `20260309000003_topics_and_velocity.sql`
- `20260309000004_indexes_and_stats_view.sql`
- `20260310132313_add_url_and_code.sql`
- `20260310133631_create_velocity_view.sql`
- `20260311092000_placeholder.sql`
- `20260311093000_placeholder.sql`
- `20260311100000_z_final.sql`
- `20260311104000_manual_conversion.sql`
- `20260318120000_backend_hardening.sql`
- `20260321110000_problem_tags_and_metadata.sql`
- `20260322110000_goals_profiles_imports.sql`

Important evolution points:
- `problems.user_id` began as `TEXT`
- later migrations normalized it to `UUID` referencing `auth.users`
- RLS was added after the initial schema
- analytics moved partly from application code into SQL views
- goals, public profiles, and platform snapshots were added later

### Current core tables

#### `problems`
Purpose: canonical stored solve records.

Fields:
- `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
- `topic TEXT NOT NULL`
- `problem_name TEXT NOT NULL`
- `language TEXT NOT NULL`
- `difficulty TEXT`
- `platform TEXT`
- `user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE`
- `solved_at TIMESTAMPTZ DEFAULT now()`
- `problem_url TEXT`
- `code_snippet TEXT`
- `revision_count INTEGER DEFAULT 0`
- `next_revision_at TIMESTAMPTZ`
- `tags TEXT[] NOT NULL DEFAULT '{}'`

#### `notes`
Purpose: freeform note storage attached to a problem.

Fields:
- `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
- `problem_id UUID REFERENCES problems(id) ON DELETE CASCADE`
- `content TEXT NOT NULL`
- `created_at TIMESTAMPTZ DEFAULT now()`

#### `user_stats`
Purpose: persisted streak and last-solve aggregate.

Fields:
- `user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE`
- `current_streak INTEGER DEFAULT 0`
- `longest_streak INTEGER DEFAULT 0`
- `last_solve_date DATE`

#### `topics`
Purpose: topic catalog and seed metadata.

Fields:
- `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
- `name TEXT UNIQUE NOT NULL`
- `description TEXT`
- `icon_url TEXT`
- `created_at TIMESTAMPTZ DEFAULT now()`

#### `public_profiles`
Purpose: denormalized public-facing share snapshot.

Fields:
- `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
- `user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE`
- `slug TEXT NOT NULL UNIQUE`
- `display_name TEXT NOT NULL DEFAULT ''`
- `avatar_url TEXT`
- `headline TEXT`
- `bio TEXT`
- `is_public BOOLEAN NOT NULL DEFAULT false`
- `share_badge BOOLEAN NOT NULL DEFAULT true`
- `total_solved INTEGER NOT NULL DEFAULT 0`
- `current_streak INTEGER NOT NULL DEFAULT 0`
- `interview_readiness INTEGER NOT NULL DEFAULT 0`
- `platform_breakdown JSONB NOT NULL DEFAULT '[]'`
- `top_topics JSONB NOT NULL DEFAULT '[]'`
- `recent_solves JSONB NOT NULL DEFAULT '[]'`
- `achievements JSONB NOT NULL DEFAULT '[]'`
- `updated_at TIMESTAMPTZ NOT NULL DEFAULT now()`

#### `user_goals`
Purpose: user-defined study goals.

Fields:
- `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
- `user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE`
- `title TEXT NOT NULL`
- `metric TEXT NOT NULL`
- `period TEXT NOT NULL DEFAULT 'all_time'`
- `target_count INTEGER NOT NULL CHECK (target_count > 0)`
- `focus_topic TEXT`
- `focus_platform TEXT`
- `due_date DATE`
- `status TEXT NOT NULL DEFAULT 'active'`
- `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`
- `updated_at TIMESTAMPTZ NOT NULL DEFAULT now()`

#### `platform_profiles`
Purpose: coding-platform snapshot data and importer bookkeeping.

Fields:
- `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
- `user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE`
- `platform TEXT NOT NULL`
- `handle TEXT NOT NULL`
- `solved_count INTEGER NOT NULL DEFAULT 0`
- `imported_problem_count INTEGER NOT NULL DEFAULT 0`
- `contest_rating INTEGER`
- `rank_label TEXT`
- `language_stats JSONB NOT NULL DEFAULT '[]'`
- `top_tags JSONB NOT NULL DEFAULT '[]'`
- `badges JSONB NOT NULL DEFAULT '[]'`
- `metadata JSONB NOT NULL DEFAULT '{}'`
- `last_synced_at TIMESTAMPTZ NOT NULL DEFAULT now()`
- unique on `(user_id, platform, handle)`

### Relationships
- one user owns many problems
- one problem owns many notes
- one user has one `user_stats` row
- one user has zero or one `public_profiles` row
- one user has many `user_goals`
- one user has many `platform_profiles`

### Views
Analytics views present in SQL migrations:
- `user_difficulty_stats`
- `user_velocity`
- `user_platform_stats`
- `user_topic_stats`
- `user_daily_activity`

These views provide:
- difficulty split
- 7-day velocity
- platform breakdown
- topic solve counts and mastery
- day-by-day activity counts

### Indexes
Indexes visible in migrations:
- `idx_problems_user`
- `idx_revision_at`
- `idx_problems_solved_at`
- `idx_problems_user_topic`
- `idx_problems_user_platform`
- `idx_problems_identity_lookup`
- conditional unique dedup index `idx_problems_user_identity_unique`
- `idx_public_profiles_slug`
- `idx_goals_user_status`
- `idx_platform_profiles_user_platform`

### Row-Level Security
RLS is enabled on:
- `problems`
- `notes`
- `user_stats`
- `public_profiles`
- `user_goals`
- `platform_profiles`

Policies visible in migrations:
- users can manage their own problems
- users can manage notes only for their own problems
- users can manage their own stats
- users can manage their own public profile
- public can read only shared public profiles where `is_public = true`
- users can manage their own goals
- users can manage their own platform profiles

### Data models in code
The project does not use model classes. Data is represented as plain objects:
- Zod payloads on the backend
- TypeScript interfaces in the dashboard
- `PendingProblem`, `ApiProblem`, `SidebarProblem`, and related shapes in the extension
- denormalized public profile snapshots in `public-profile.service.js`

---

## 6. Authentication and User Management

### Auth provider
Supabase Auth is the only authentication provider in the codebase.

### Login methods
Implemented login providers:
- Google
- GitHub

### Dashboard auth flow
1. User opens `/login`.
2. [login/page.tsx](/D:/ext/dsaflow/apps/dashboard/src/app/login/page.tsx) mounts the Supabase Auth UI.
3. `redirectTo` is built from `NEXT_PUBLIC_SITE_URL` or the current origin.
4. Supabase completes OAuth.
5. The browser stores the Supabase session locally.
6. Dashboard pages read session state with `supabase.auth.getSession()`.
7. API requests attach `Authorization: Bearer <access_token>`.

### VS Code extension auth flow
1. Extension activates on `onStartupFinished`.
2. It checks VS Code `SecretStorage` for a token.
3. If none exists, it automatically opens the dashboard login URL in the browser.
4. The login page detects `source=vscode`, `scheme`, and `extId`.
5. After Supabase auth, the page redirects to `scheme://extId/auth?token=<access_token>`.
6. The extension receives the URI, extracts the token, and stores it in `SecretStorage`.
7. The extension refreshes sidebar/status state and retries queued offline work.

### Token handling
Dashboard:
- bearer token is read from Supabase session on demand
- token is injected into API requests by `apiFetch()`

Extension:
- bearer token is stored in `SecretStorage`
- if the API returns 401, the extension queues the event and reopens sign-in

Backend:
- token is validated with `supabase.auth.getUser(token)`
- a token-scoped Supabase client is created for request processing

### Authorization model
There is no custom role hierarchy. Effective roles are:
- authenticated end user using anon key plus JWT-scoped access
- background worker using service-role access
- public unauthenticated reader for shared public profiles and badge SVGs

Authorization boundaries:
- route middleware protects private endpoints
- database RLS enforces per-user ownership
- service-role access is limited to worker/admin-style paths

### User management features present
- social login
- extension sign-out
- profile metadata update through `supabase.auth.updateUser(...)`
- editable public profile data through API
- platform handle linkage through importer snapshots

### Security considerations
Strengths:
- centralized auth provider
- JWT validation plus DB-level RLS
- service-role isolation from normal request handling

Current limitations:
- extension offline queue stores unsynced code payloads in `globalState`, not secure secret storage
- no account deletion flow in inspected app code
- no explicit refresh-token UI in the extension beyond reopening auth on failure

---

## 7. Dependencies Breakdown

This section lists the direct dependencies declared in the package manifests currently present in the repo.

### Root workspace
The root [package.json](/D:/ext/dsaflow/package.json) defines workspaces and helper scripts only. It does not declare direct runtime or dev dependencies.

### API package dependencies

| Package | Scope | Core or optional | What it does | Where it is used | Why it is needed | Risks / tradeoffs |
|---|---|---|---|---|---|---|
| `@google/generative-ai` | Runtime | Optional | Gemini API client | `analysis.service.js` | AI code/problem analysis | upstream dependency, JSON parsing brittleness |
| `@supabase/supabase-js` | Runtime | Core | Supabase auth and DB client | `db/supabase.js`, middleware, repositories | authenticated Postgres access | vendor coupling |
| `bullmq` | Runtime | Optional but important | Redis-backed job queue | `jobs/*` | reminders and digests | requires Redis and a worker process |
| `cors` | Runtime | Core | CORS middleware | `index.js` | browser access across origins | misconfiguration can block or overexpose clients |
| `dotenv` | Runtime | Core in local/dev | env loader | API bootstrap and DB bootstrap | local configuration | limited prod secret-management value by itself |
| `express` | Runtime | Core | HTTP server and router | entire API | REST endpoint hosting | minimal structure by default |
| `express-rate-limit` | Runtime | Core security control | request throttling | `index.js` | coarse abuse protection | global policy may be too broad |
| `helmet` | Runtime | Core security control | security headers | `index.js` | safer HTTP defaults | only one layer of security |
| `ioredis` | Runtime | Optional | Redis client | `lib/cache.js`, BullMQ | cache and job transport | extra operational dependency |
| `jsonwebtoken` | Runtime | Currently optional/unused | JWT utility library | not referenced in inspected API source | likely leftover or future use | unused dependency surface |
| `morgan` | Runtime | Core baseline | request logging | `index.js` | request visibility | unstructured logs only |
| `resend` | Runtime | Optional | email delivery client | `jobs/*` | reminders and digests | external service dependency |
| `swagger-jsdoc` | Runtime | Optional | OpenAPI generation | `index.js` | `/api-docs` generation | limited without richer annotations |
| `swagger-ui-express` | Runtime | Optional | Swagger UI hosting | `index.js` | human-readable API docs | same limitation as above |
| `zod` | Runtime | Core | runtime validation | `validation/schemas.js`, routes | request validation | schemas are not shared across apps |

### Dashboard package dependencies

| Package | Scope | Core or optional | What it does | Where it is used | Why it is needed | Risks / tradeoffs |
|---|---|---|---|---|---|---|
| `@supabase/auth-ui-react` | Runtime | Core for current auth flow | prebuilt auth component | `login/page.tsx` | Google/GitHub login UI | less customizable than a custom auth screen |
| `@supabase/auth-ui-shared` | Runtime | Optional but coupled | auth-ui theme tokens | `login/page.tsx` | ThemeSupa styling | tied to Supabase auth UI |
| `@supabase/supabase-js` | Runtime | Core | browser auth/realtime client | `lib/supabase.ts`, auth/session/realtime code | session and realtime support | vendor coupling |
| `@tanstack/react-query` | Runtime | Core | server-state caching | `providers.tsx`, pages/components | query caching and invalidation | requires careful cache discipline |
| `framer-motion` | Runtime | Optional UX layer | animation library | page and components | polish and transitions | bundle cost |
| `lucide-react` | Runtime | Optional but heavily used | icon set | page and components | iconography | bundle weight; previously involved in stale chunk issue |
| `next` | Runtime | Core | React framework runtime | entire dashboard | routing and production runtime | mostly client-rendered app underuses SSR |
| `react` | Runtime | Core | UI library | entire dashboard | component model | client-heavy rendering costs |
| `react-dom` | Runtime | Core | DOM renderer | entire dashboard | browser rendering | standard React tradeoffs |
| `recharts` | Runtime | Core for analytics UI | charting library | analytics components | charts and breakdowns | accessibility and scaling limits |
| `@tailwindcss/postcss` | Dev | Dev core | Tailwind PostCSS plugin | build pipeline | CSS compilation | build-only |
| `@types/node` | Dev | Dev | Node typings | TS tooling | type safety | build-only |
| `@types/react` | Dev | Dev | React typings | TS tooling | type safety | build-only |
| `@types/react-dom` | Dev | Dev | React DOM typings | TS tooling | type safety | build-only |
| `eslint` | Dev | Dev | lint engine | lint script | static quality checks | separate lint stack from other packages |
| `eslint-config-next` | Dev | Dev | Next lint rules | lint config | framework defaults | framework coupling |
| `tailwindcss` | Dev | Dev core | utility CSS compiler | styling toolchain | Tailwind styling system | utility sprawl |
| `typescript` | Dev | Dev core | TS compiler | dashboard typing/build | safer refactors | no shared contracts package yet |

### VS Code extension package dependencies

| Package | Scope | Core or optional | What it does | Where it is used | Why it is needed | Risks / tradeoffs |
|---|---|---|---|---|---|---|
| `axios` | Runtime | Core | HTTP client | `extension.ts` | API communication | native `fetch` could have been enough |
| `@types/node` | Dev | Dev | Node typings | TS tooling | type safety | build-only |
| `@types/vscode` | Dev | Dev core | VS Code API typings | TS tooling | required for extension development | coupled to VS Code API version |
| `@typescript-eslint/eslint-plugin` | Dev | Dev | TS lint rules | lint config | static quality checks | build-only |
| `@typescript-eslint/parser` | Dev | Dev | ESLint TS parser | lint config | static quality checks | build-only |
| `@vscode/vsce` | Dev | Dev core for release | VSIX packaging/publish tooling | release scripts | Marketplace packaging | requires publisher and PAT setup |
| `esbuild` | Dev | Dev core | bundler/compiler | `esbuild.mjs` | fast extension compile | additional config surface |
| `eslint` | Dev | Dev | lint engine | lint script | static quality checks | separate lint/version stack |
| `typescript` | Dev | Dev core | TS compiler | typecheck/build | safer extension code | build-only |

### Dependency notes
- `jsonwebtoken` is declared but not referenced in the inspected API code.
- `StatsCards.tsx` exists in the dashboard component tree but is not imported by the main dashboard page.

---

## 8. Project Structure Explained

### Top-level tree

```text
dsaflow/
├─ .github/workflows/ci.yml
├─ apps/
│  ├─ api/
│  │  ├─ index.js
│  │  ├─ worker.js
│  │  ├─ Dockerfile
│  │  └─ src/
│  │     ├─ db/
│  │     ├─ emails/
│  │     ├─ jobs/
│  │     ├─ lib/
│  │     ├─ middleware/
│  │     ├─ repositories/
│  │     ├─ routes/
│  │     ├─ services/
│  │     └─ validation/
│  └─ dashboard/
│     ├─ Dockerfile
│     ├─ next.config.ts
│     └─ src/
│        ├─ app/
│        ├─ components/
│        └─ lib/
├─ packages/
│  └─ vscode-extension/
│     ├─ src/
│     │  ├─ extension.ts
│     │  └─ sidebar.ts
│     ├─ esbuild.mjs
│     └─ package.json
├─ supabase/migrations/
├─ Arrays/two_sum.py
├─ docker-compose.yml
├─ DEPLOYMENT_RELEASE_CHECKLIST.md
├─ README.md
├─ package.json
└─ TECHNICAL_DOCUMENTATION_REPORT.md
```

### Directory roles
- `.github`: CI workflow definitions
- `apps/api`: REST API and background worker package
- `apps/dashboard`: Next.js dashboard package
- `packages/vscode-extension`: extension package for Marketplace distribution
- `supabase/migrations`: versioned SQL schema history
- `Arrays`: sample DSA workspace content used for local extension testing
- root docs and config: deployment, README, workspace config

### API package
`apps/api/src` is organized by concern:
- `db`: Supabase client creation and auth/service-role separation
- `emails`: HTML email generation
- `jobs`: BullMQ job bootstrap and workers
- `lib`: cache helper, parsing helper, response envelopes
- `middleware`: auth middleware
- `repositories`: direct data-access helpers
- `routes`: route-level HTTP handlers
- `services`: business logic and orchestration
- `validation`: Zod schemas

### Dashboard package
`apps/dashboard/src` is organized into:
- `app`: Next.js routes and root providers
- `components`: reusable analytics panels, modals, and utility UI
- `lib`: auth token helper, Supabase browser client, API wrapper

### Extension package
`packages/vscode-extension/src` contains:
- `extension.ts`: activation, watchers, commands, sync queue, auth flow, status bar, webviews
- `sidebar.ts`: sidebar tree provider and snapshot rendering

### Key config files
- [package.json](/D:/ext/dsaflow/package.json): workspace definition and root helper scripts
- [ci.yml](/D:/ext/dsaflow/.github/workflows/ci.yml): CI checks for dashboard build and extension validation
- [docker-compose.yml](/D:/ext/dsaflow/docker-compose.yml): local orchestration for API, worker, and dashboard
- [next.config.ts](/D:/ext/dsaflow/apps/dashboard/next.config.ts): standalone build settings and runtime chunk hardening
- [DEPLOYMENT_RELEASE_CHECKLIST.md](/D:/ext/dsaflow/DEPLOYMENT_RELEASE_CHECKLIST.md): manual release flow

### Environment variables and where they are used

API:
- `PORT`: API listen port
- `NODE_ENV`: production behavior for errors, limits, and CORS
- `SUPABASE_URL`: base Supabase project URL
- `SUPABASE_ANON_KEY`: request-scoped data access
- `SUPABASE_SERVICE_ROLE_KEY`: worker/admin access
- `ALLOWED_ORIGINS`: production CORS allowlist
- `API_BASE_URL`: swagger server metadata
- `DASHBOARD_URL`: email links and extension auth assumptions
- `NEXT_PUBLIC_SITE_URL`: fallback public URL in some job paths
- `REDIS_URL`: enables cache and BullMQ jobs
- `RESEND_API_KEY`: enables email sending
- `FROM_EMAIL`: sender address
- `GEMINI_API_KEY`: enables AI analysis

Dashboard:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_API_URL`
- `NEXT_PUBLIC_SITE_URL`

Extension settings:
- `dsaflow.apiUrl`
- `dsaflow.dashboardUrl`
- `dsaflow.watchedGlob`
- `dsaflow.autoLogOnCreate`
- `dsaflow.promptOnSave`
- `dsaflow.promptForProblemUrl`
- `dsaflow.defaultDifficulty`
- `dsaflow.savePromptDebounceMs`
- `dsaflow.autoImportOnFirstRun`
- `dsaflow.showLearningCardAfterLog`

---

## 9. Data Flow and Execution Flow

### Dashboard user flow
1. User opens the dashboard.
2. Next.js serves the app shell through `layout.tsx`.
3. `SWBypass` unregisters service workers to avoid stale deploy artifacts.
4. `page.tsx` checks the current Supabase session.
5. If unauthenticated, the user is redirected to `/login`.
6. If authenticated, React Query runs multiple API requests in parallel.
7. `apiFetch()` reads the current access token and attaches it as a bearer token.
8. The API validates the token and creates a token-scoped Supabase client.
9. Services and repositories read views/tables and return JSON payloads.
10. React Query caches the payloads and the dashboard renders analytics panels.
11. Supabase realtime subscriptions invalidate query groups when `problems` rows change.

### Extension logging flow
1. VS Code finishes startup.
2. The extension activates.
3. It creates a log channel, status bar item, sidebar tree view, and file watchers.
4. It checks for a stored token in `SecretStorage`.
5. If no token exists, it opens the browser to the dashboard login page automatically.
6. After sign-in, the dashboard redirects back into VS Code with the access token.
7. The extension stores the token and refreshes its student snapshot.
8. The user creates or saves a candidate DSA file.
9. The extension filters unsupported languages and duplicate watcher events.
10. It reads the file contents and extracts:
    - problem name from the filename
    - topic from the path
    - language from the extension
    - URL from comments or text
    - difficulty and tag hints from the path
11. It calls `/api/metadata/resolve` when a token is available for enriched metadata.
12. It builds a normalized `PendingProblem` payload.
13. It submits the payload to `POST /api/problems`.
14. The API validates, deduplicates, inserts or returns an existing row, refreshes stats, invalidates cache, and refreshes the public profile snapshot.
15. The extension updates local session counters only when the solve was newly created.
16. The extension stores a local file index for later reopen actions.
17. The sidebar and status bar refresh to show solves, streak, revisions, sync state, insights, and milestones.
18. If submission fails, the extension stores the payload in `globalState` and retries later.

### Revision flow
1. User completes or snoozes a revision from the dashboard or extension sidebar.
2. Client calls `POST /api/problems/:id/revise`.
3. The API updates `revision_count` and `next_revision_at`.
4. Revision, overview, readiness, and related caches are invalidated.
5. Public profile snapshot is refreshed.
6. Dashboard or extension refreshes visible state.

### Public profile flow
1. Problem create, update, delete, import, or revision triggers `refreshPublicProfileSnapshot(...)`.
2. The service recomputes:
   - total solves
   - current streak
   - interview readiness
   - platform breakdown
   - top topics
   - recent solves
   - unlocked achievements
3. The snapshot is upserted into `public_profiles`.
4. Settings page lets the user edit slug, display name, bio, and visibility.
5. Public readers consume the snapshot through `/api/public-profiles/:slug` and `/api/public-profiles/:slug/badge.svg`.

### Importer flow
1. User opens settings and enters a handle or CSV text.
2. Dashboard sends an importer request to the API.
3. Importer service fetches upstream public data or parses CSV.
4. Rows are normalized to `problemSchema`.
5. Duplicate identities are removed within the import batch.
6. `bulkImportProblems(...)` skips already-stored problems and inserts the rest.
7. Imported problems update `problems`, `topics`, `user_stats`, caches, and `public_profiles`.
8. `platform_profiles` stores the source-account snapshot and import metadata.

---

## 10. Deployment and Infrastructure

### Build process

#### API
- no transpilation step
- `npm run start --workspace=apps/api` runs `node index.js`
- `npm run worker --workspace=apps/api` runs the separate background worker

The API Dockerfile:
- uses Node 20 Alpine
- installs dependencies inside the API package
- copies the app into the container
- starts with `node index.js`

#### Dashboard
- `prebuild` removes `.next`
- `next build`
- `next start`

The forced clean exists because the dashboard previously hit runtime failures from stale/missing Next server chunks such as `lucide-react.js` and `@swc.js`. The current build process hardens around that by cleaning first.

The dashboard Next config uses:
- `output: "standalone"`
- `bundlePagesRouterDependencies: true`

The dashboard Dockerfile:
- uses Node 20 Alpine
- injects `NEXT_PUBLIC_*` build args
- builds the app
- copies runtime artifacts
- starts with `npm start`

### Local orchestration
`docker-compose.yml` defines:
- `api`
- `worker`
- `dashboard`

Important assumptions:
- environment variables are passed from the host
- `dashboard` depends on `api`
- Redis is referenced but not provisioned in the compose file
- Supabase is external, not included in compose

### Hosting model implied by the codebase
- dashboard is expected to run well on a Vercel-style Next.js host
- API and worker are expected to run as separate long-lived Node services
- Supabase provides auth and Postgres
- Redis backs cache and BullMQ jobs
- Resend handles email delivery

These assumptions are visible in:
- extension default URLs
- dashboard metadata base URL
- deployment checklist wording

### CI/CD
GitHub Actions in [ci.yml](/D:/ext/dsaflow/.github/workflows/ci.yml):
- runs on push and pull request to `main`
- uses Node 18 and 20
- installs dependencies
- runs extension check
- builds the dashboard

Current CI gaps:
- no API unit/integration tests
- no migration smoke tests
- no browser e2e tests
- no extension install smoke test

### Monitoring and logging
Current observability:
- API request logs through Morgan
- API and worker console logging
- extension `LogOutputChannel`

Missing:
- centralized logging
- metrics
- tracing
- error reporting service
- alerting

---

## 11. Security Analysis

### Implemented protections
- Supabase Auth for identity
- bearer token verification on protected API routes
- token-scoped Supabase clients for user requests
- service-role client reserved for worker/admin-style paths
- row-level security on user-owned tables
- production CORS allowlist support
- Helmet security headers
- API rate limiting
- VS Code `SecretStorage` for extension auth token
- XML escaping in public badge rendering

### Data protection measures
- private API routes require auth
- notes are authorized through ownership of the parent problem
- public profile reads are gated by `is_public`
- dashboard gets access tokens from the Supabase session rather than hardcoding them
- service-role access is separated from normal request handling

### Security risks and missing safeguards
- the extension offline queue stores full problem payloads, including code snippets, in `globalState`, which is less secure than `SecretStorage`
- importers rely on public upstream APIs and HTML that can change without warning
- `GET /api/topics` is intentionally public, which is acceptable but still public attack surface
- there is no explicit audit log for destructive actions
- there is no fine-grained per-route or per-user throttling strategy beyond the global limiter
- there is no dependency scanning or secret scanning in the visible CI workflow
- there is no explicit account deletion flow in the inspected app code

### Good security design decisions already present
- authorization is enforced both in API code and at the database layer
- service-role access is isolated to background/admin contexts
- CORS is strict in production when `ALLOWED_ORIGINS` is configured
- missing Redis or email configuration degrades features rather than crashing request handling
- SVG badge output is escaped before rendering

---

## 12. Performance Considerations

### Current optimizations
- Redis cache is optional and no-ops safely when unavailable
- API caches:
  - stats
  - velocity
  - overview
  - activity
  - topic stats
  - platform stats
  - achievements
  - insights
  - revision queue
  - problems list
- dashboard uses React Query with a 60-second `staleTime`
- heavy dashboard components are dynamically imported with `ssr: false`
- `ProblemsList` uses cursor-based pagination for `solved_at`
- analytics use SQL views where available
- public profile reads use a denormalized snapshot table
- extension watcher events are deduplicated for 15 seconds
- save-prompt flow is debounced
- extension uses an offline queue to avoid data loss

### Remaining bottlenecks
- several services still fall back to `fetchAllProblems(...)`
- achievements are computed from full user history
- insights are computed from full user history
- interview readiness is computed from full user history
- goal progress is computed from goals plus full problem history
- revision queue still buckets in application code after loading all problems
- public profile snapshot is recomputed after many write operations
- dashboard initial load fans out into many API requests
- extension sidebar refresh calls several endpoints instead of a single compact summary endpoint

### Frontend runtime tradeoffs
- the dashboard is mostly client-rendered, so it does not fully leverage server rendering
- Framer Motion and the chart stack add bundle and paint cost
- `SWBypass` solves stale-cache correctness issues but prevents any future service-worker caching strategy

### Database considerations
Good:
- views cover difficulty, velocity, platform, topic, and daily activity
- indexes support common user/date/topic/platform/revision queries
- overview counts rely on DB count queries rather than full in-memory scans

Still heavy:
- full-history analytics fallbacks remain in services
- snapshot recomputation can become expensive as histories grow

---

## 13. Improvements and Recommendations

### Architecture
- introduce a shared contracts/types package so API, dashboard, and extension stop duplicating data shapes
- move remaining heavy derived reads into SQL views, materialized views, or aggregate tables
- consider a dedicated extension-summary endpoint for sidebar/status bar refreshes
- consider making public profile recomputation asynchronous or incremental if write volume grows

### Scalability
- move revision bucketing, readiness scoring inputs, and goal progress metrics closer to the database
- expand cursor pagination support or restrict sorting modes to cursor-friendly fields
- separate importer-heavy workloads from normal API traffic if usage grows

### Security
- reduce or encrypt queued extension payload storage, especially code snippets
- add audit logging for delete, revise, importer, and public-profile visibility changes
- remove unused dependencies such as `jsonwebtoken` unless intentionally retained
- add dependency scanning and secret scanning to CI

### Performance
- replace remaining full-history fallbacks with database-native aggregates
- consider a dashboard bootstrap endpoint if initial fan-out becomes a bottleneck
- reconsider the all-service-worker-unregister strategy in `SWBypass` once deployment caching is stable
- narrow React Query invalidation further or use optimistic local updates for frequent mutations

### Code quality
- add automated API tests, dashboard component tests, and extension smoke tests
- fix documentation drift in the root README, which still describes some already-implemented features as future work
- review root `supabase:*` scripts in [package.json](/D:/ext/dsaflow/package.json); they assume `cd dsaflow`, which appears intended for execution from a parent directory rather than the repo root
- standardize API response envelopes so all endpoints behave consistently
- align service-side dedup logic with normalized DB uniqueness rules

### Product roadmap grounded in current architecture
- add server-side revision history instead of only storing latest revision counters
- add active coding time tracking if richer learning analytics are a priority
- add import-job history/status tracking
- consider server-rendered public profiles for better link sharing and crawlability

---

## Closing Technical Characterization

DSAFlow is a multi-surface product with:
- a modular Express backend
- Supabase-backed auth and RLS
- SQL-backed analytics views
- a separate worker process
- a feature-rich Next.js dashboard
- a sophisticated VS Code client with automatic auth, offline queuing, metadata enrichment, workspace import, sidebar UX, and learning-card support

Its strongest qualities today are:
- tight editor-to-dashboard product cohesion
- sensible route/service/repository separation in the backend
- database-enforced ownership rules
- denormalized public profile snapshots for fast public reads
- extension UX that minimizes authentication friction

Its main long-term pressure points are:
- remaining full-history computations in services
- limited automated testing
- missing shared type/contracts package
- limited observability
- fragility of public importer dependencies
- security tradeoff of storing unsynced code payloads in extension global state

The best mental model for the system is:
- `editor event -> authenticated API write -> DB + stats/profile refresh -> dashboard invalidation`
- `settings action -> importer/profile/goal mutation -> snapshot refresh -> analytics refresh`
- `worker schedule -> service-role DB read -> email composition -> Resend delivery`

That is the architecture and execution model encoded in the repository in its current state.
