-- 🚀 DSAFLOW DEFINITIVE SCHEMA FIX 🚀
-- Copy and paste this ENTIRE file into your Supabase SQL Editor and hit "Run"

-- 1. Aggressively drop dependent views to prevent "cannot alter column" errors
DROP VIEW IF EXISTS user_difficulty_stats CASCADE;
DROP VIEW IF EXISTS user_platform_stats CASCADE;
DROP VIEW IF EXISTS user_velocity CASCADE;

-- 2. Drop all policies that might conflict
DROP POLICY IF EXISTS "Users can fully manage their own problems" ON problems;
DROP POLICY IF EXISTS "Users can fully manage their own stats" ON user_stats;
DROP POLICY IF EXISTS "Users can fully manage notes for their problems" ON notes;

-- 3. SAFELY CONVERT user_id TO UUID
-- First, rename the old column
ALTER TABLE problems RENAME COLUMN user_id TO user_id_old;

-- Create the new UUID column WITHOUT the foreign key constraint initially
ALTER TABLE problems ADD COLUMN user_id UUID;

-- Aggressively delete rows that don't have a valid UUID format in the old column
-- (This prevents the '00000000-...' default cast error)
DELETE FROM problems WHERE user_id_old !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

-- Migrate the valid UUID data
UPDATE problems SET user_id = user_id_old::UUID;

-- Prune any orphaned problems that don't belong to a valid auth.user
-- (This prevents the specific ERROR 23503 foreign key violation)
DELETE FROM problems WHERE user_id NOT IN (SELECT id FROM auth.users);

-- Now it is safe to apply the foreign key constraint
ALTER TABLE problems ADD CONSTRAINT problems_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Drop the old broken column
ALTER TABLE problems DROP COLUMN user_id_old;

-- 4. RECREATE USER STATS WITH UUID
DROP TABLE IF EXISTS user_stats CASCADE;
CREATE TABLE user_stats (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    current_streak INTEGER DEFAULT 0,
    longest_streak INTEGER DEFAULT 0,
    last_solve_date DATE
);

-- 5. ENSURE REQUIRED COLUMNS EXIST
ALTER TABLE problems ADD COLUMN IF NOT EXISTS problem_url TEXT;
ALTER TABLE problems ADD COLUMN IF NOT EXISTS code_snippet TEXT;
ALTER TABLE problems ADD COLUMN IF NOT EXISTS platform TEXT DEFAULT 'Other';
ALTER TABLE problems ADD COLUMN IF NOT EXISTS revision_count INTEGER DEFAULT 0;
ALTER TABLE problems ADD COLUMN IF NOT EXISTS next_revision_at TIMESTAMPTZ DEFAULT now();

-- 6. ENABLE RLS (Critically Important!)
ALTER TABLE problems ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;

-- 7. RE-APPLY SECURE POLICIES
CREATE POLICY "Users can fully manage their own problems" 
ON problems FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can fully manage their own stats" 
ON user_stats FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can fully manage notes for their problems" 
ON notes FOR ALL USING (
  EXISTS (SELECT 1 FROM problems WHERE id = notes.problem_id AND user_id = auth.uid())
);

-- 8. RESTORE DASHBOARD VIEWS
CREATE OR REPLACE VIEW user_difficulty_stats AS
SELECT 
    user_id,
    COUNT(id) as total_solved,
    SUM(CASE WHEN difficulty = 'Easy' THEN 1 ELSE 0 END) as easy_count,
    SUM(CASE WHEN difficulty = 'Medium' THEN 1 ELSE 0 END) as medium_count,
    SUM(CASE WHEN difficulty = 'Hard' THEN 1 ELSE 0 END) as hard_count
FROM problems
GROUP BY user_id;

CREATE OR REPLACE VIEW user_platform_stats AS
SELECT 
    user_id,
    platform,
    COUNT(*) AS solve_count
FROM problems
WHERE platform IS NOT NULL
GROUP BY user_id, platform;

CREATE OR REPLACE VIEW user_velocity AS
SELECT 
    user_id,
    COUNT(id) as solves_last_7_days,
    COUNT(id) / 7.0 as daily_velocity
FROM problems
WHERE solved_at >= NOW() - INTERVAL '7 days'
GROUP BY user_id;

-- 9. ADD PERFORMANCE INDEXES
CREATE INDEX IF NOT EXISTS idx_user_solved ON problems(user_id, solved_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_revision ON problems(user_id, next_revision_at);
CREATE INDEX IF NOT EXISTS idx_user_topic ON problems(user_id, topic);
