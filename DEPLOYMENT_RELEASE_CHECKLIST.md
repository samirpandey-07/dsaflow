# DSAFlow Deployment And Release Checklist

## 1. Supabase
- Run `npx supabase db push` from the repo root after linking the project.
- Confirm these migrations are applied:
  - `20260318120000_backend_hardening.sql`
  - `20260321110000_problem_tags_and_metadata.sql`
  - `20260322110000_goals_profiles_imports.sql`
- Verify RLS is enabled on:
  - `problems`
  - `notes`
  - `user_stats`
  - `public_profiles`
  - `user_goals`
  - `platform_profiles`
- Create OAuth providers in Supabase Auth:
  - Google
  - GitHub
- Set the dashboard URL in Supabase Auth redirect allow-list.

## 2. API
- Configure `apps/api/.env` from `apps/api/.env.example`.
- Required production values:
  - `NODE_ENV=production`
  - `SUPABASE_URL`
  - `SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `ALLOWED_ORIGINS`
  - `API_BASE_URL`
  - `DASHBOARD_URL`
- Recommended optional values:
  - `REDIS_URL`
  - `RESEND_API_KEY`
  - `FROM_EMAIL`
  - `GEMINI_API_KEY`
- Start stateless API:
  - `npm run start --workspace=apps/api`
- Smoke test:
  - `GET /api/healthz`
  - auth-protected `GET /api/analytics/overview`
  - `POST /api/imports/codeforces`
  - `PUT /api/public-profiles/me`
  - `GET /api/public-profiles/:slug`
  - `GET /api/public-profiles/:slug/badge.svg`

## 3. Worker
- Deploy the worker as a separate process from the API.
- Reuse `apps/api/.env` and ensure these values exist:
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `REDIS_URL`
  - `RESEND_API_KEY`
- Start worker:
  - `npm run worker --workspace=apps/api`
- Confirm logs show:
  - revision reminders initialized
  - weekly digest initialized

## 4. Dashboard
- Configure `apps/dashboard/.env.local` from `apps/dashboard/.env.local.example`.
- Required values:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `NEXT_PUBLIC_API_URL`
  - `NEXT_PUBLIC_SITE_URL`
- Build and verify:
  - `npm run build --workspace=apps/dashboard`
- Smoke test flows:
  - login with Google/GitHub
  - dashboard loads overview + heatmap
  - settings page saves public profile
  - badge markdown renders correctly
  - public profile page opens at `/u/:slug`

## 5. VS Code Extension
- Confirm `packages/vscode-extension/package.json` has the real Marketplace publisher.
- Confirm production settings defaults:
  - `dsaflow.apiUrl`
  - `dsaflow.dashboardUrl`
- Verify:
  - `npm run check --workspace=packages/vscode-extension`
  - `npm run package --workspace=packages/vscode-extension`
- Install the generated `.vsix` locally and smoke test:
  - auto-auth redirect on first activation
  - auto logging of a new DSA file
  - sidebar updates
  - retry pending sync
  - revision actions from the sidebar

## 6. End-To-End Smoke Test
- Install extension in a clean VS Code profile.
- Sign in through the automatic browser flow.
- Solve and save one problem.
- Confirm:
  - problem appears in dashboard
  - activity heatmap updates
  - readiness score changes
  - goal progress updates
  - public profile summary updates
- Run one platform import:
  - Codeforces full sync
  - LeetCode recent sync
  - GFG snapshot sync
  - CSV backfill

## 7. Release Ops
- Tag the release in git.
- Publish dashboard and API environment changes first.
- Roll out the worker before enabling email reminders publicly.
- Publish the VS Code extension only after the API and dashboard are live.
- Keep rollback ready:
  - last stable API image
  - last stable dashboard deployment
  - previous extension `.vsix`
