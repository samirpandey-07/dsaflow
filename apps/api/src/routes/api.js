const express = require('express');
const router = express.Router();
const { supabase, createAuthClient } = require('../db/supabase');
const { z } = require('zod');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const cache = require('../lib/cache');

// Initialize Intelligent Analysis (optional — falls back to mock if key missing)
const analysisAI = process.env.GEMINI_API_KEY
    ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
    : null;

// Validation Schemas
const problemSchema = z.object({
    topic: z.string().min(1, 'Topic is required'),
    problem: z.string().min(1, 'Problem name is required'),
    difficulty: z.enum(['Easy', 'Medium', 'Hard']).optional(),
    language: z.string().optional(),
    platform: z.enum(['LeetCode', 'GeeksforGeeks', 'Codeforces', 'HackerRank', 'Other']).optional().default('Other'),
    problem_url: z.string().url().optional().or(z.literal('')),
    code_snippet: z.string().optional()
});

const verifyAuth = async (req, res, next) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        const isDevelopment = process.env.NODE_ENV !== 'production';

        if (token) {
            console.log(`[Auth Debug] Incoming token: ${token.substring(0, 15)}...${token.slice(-10)}`);
            const { data: { user }, error } = await supabase.auth.getUser(token);
            if (user && !error) {
                req.user = user;
                req.supabase = createAuthClient(token);
                return next();
            }
            if (error) {
                console.error('[Auth Debug] Supabase rejection reason:', error.message, error.name, error.status);
            }
        } else {
            console.warn('[Auth Debug] No token provided in header');
        }
        throw new Error('Unauthorized');
    } catch (error) {
        res.status(401).json({ status: 'error', message: 'Unauthorized', details: error.message });
    }
};

/**
 * @swagger
 * /api/problems:
 *   post:
 *     summary: Log a solved problem
 *     tags: [Problems]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               topic:
 *                 type: string
 *               problem:
 *                 type: string
 *               difficulty:
 *                 type: string
 *                 enum: [Easy, Medium, Hard]
 *               language:
 *                 type: string
 *               platform:
 *                 type: string
 *                 enum: [LeetCode, GeeksforGeeks, Codeforces, HackerRank, Other]
 *               problem_url:
 *                 type: string
 *               code_snippet:
 *                 type: string
 *     responses:
 *       201:
 *         description: Successfully logged problem
 *       400:
 *         description: Validation error
 */
router.post('/problems', verifyAuth, async (req, res) => {
    try {
        const validatedData = problemSchema.parse(req.body);
        const userId = req.user.id;

        const { data: problemData, error: problemError } = await req.supabase
            .from('problems')
            .insert([{
                user_id: userId,
                problem_name: validatedData.problem,
                topic: validatedData.topic,
                difficulty: validatedData.difficulty,
                language: validatedData.language,
                platform: validatedData.platform,
                problem_url: validatedData.problem_url || null,
                code_snippet: validatedData.code_snippet || null,
                revision_count: 0,
                next_revision_at: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString() // Tomorrow
            }])
            .select()
            .single();

        if (problemError) throw problemError;

        // Ensure topic exists in topics table for global autocomplete / tracking
        await req.supabase
            .from('topics')
            .upsert([{ name: validatedData.topic }], { onConflict: 'name' });

        // Update User Stats (Streaks)
        const { data: statsRow } = await req.supabase
            .from('user_stats')
            .select('last_solve_date, current_streak, longest_streak')
            .eq('user_id', userId)
            .single();

        const today = new Date().toISOString().split('T')[0];

        if (!statsRow) {
            await req.supabase.from('user_stats').insert([{
                user_id: userId,
                current_streak: 1,
                longest_streak: 1,
                last_solve_date: today
            }]);
        } else {
            const lastSolve = statsRow.last_solve_date;

            // Calculate date difference in days safely
            const rToday = new Date(today);
            const rLast = new Date(lastSolve);
            const rDiff = (rToday.getTime() - rLast.getTime()) / (1000 * 60 * 60 * 24);

            let newStreak = statsRow.current_streak;
            let newLongest = statsRow.longest_streak;

            if (rDiff === 1) {
                // Next day solve = increment streak
                newStreak += 1;
                newLongest = Math.max(newStreak, newLongest);
            } else if (rDiff > 1) {
                // Streak broken
                newStreak = 1;
            }

            if (rDiff > 0) {
                await req.supabase
                    .from('user_stats')
                    .update({
                        current_streak: newStreak,
                        longest_streak: newLongest,
                        last_solve_date: today
                    })
                    .eq('user_id', userId);
            }
        }

        // Invalidate cached stats so the next request reflects the new solve
        await cache.del(`stats:${userId}`);
        await cache.del(`velocity:${userId}`);

        res.status(201).json({ status: 'success', data: problemData });
    } catch (error) {
        console.error('Error logging problem:', error);
        res.status(500).json({ status: 'error', message: error.message });
    }
});

/**
 * @swagger
 * /api/problems/{id}/revise:
 *   post:
 *     summary: Mark a problem as revised and schedule next review
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Problem revision scheduled
 */
router.post('/problems/:id/revise', verifyAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        // Get current revision count
        const { data: problem, error: getError } = await req.supabase
            .from('problems')
            .select('revision_count')
            .eq('id', id)
            .eq('user_id', userId)
            .single();

        if (getError || !problem) return res.status(404).json({ status: 'error', message: 'Problem not found' });

        const newCount = (problem.revision_count || 0) + 1;

        // Spaced Repetition Logic: 1, 3, 7, 14, 30 days
        const intervals = [1, 3, 7, 14, 30];
        const daysToAdd = intervals[Math.min(newCount, intervals.length - 1)];
        const nextDate = new Date(Date.now() + daysToAdd * 24 * 60 * 60 * 1000).toISOString();

        const { data, error } = await req.supabase
            .from('problems')
            .update({
                revision_count: newCount,
                next_revision_at: nextDate
            })
            .eq('id', id)
            .select();

        if (error) throw error;
        res.status(200).json({ status: 'success', data });
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
});

/**
 * @swagger
 * /api/revision-queue:
 *   get:
 *     summary: Get problems due for revision
 *     responses:
 *       200:
 *         description: List of problems to revise
 */
router.get('/revision-queue', verifyAuth, async (req, res) => {
    try {
        const userId = req.user.id;
        const { data, error } = await req.supabase
            .from('problems')
            .select('*')
            .eq('user_id', userId)
            .lte('next_revision_at', new Date().toISOString())
            .order('next_revision_at', { ascending: true });

        if (error) throw error;
        res.status(200).json(data);
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
});

/**
 * @swagger
 * /api/user/stats:
 *   get:
 *     summary: Get user solve statistics and streaks
 *     responses:
 *       200:
 *         description: User statistics
 */
router.get('/user/stats', verifyAuth, async (req, res) => {
    try {
        const { data, error } = await req.supabase
            .from('user_stats')
            .select('*')
            .eq('user_id', req.user.id)
            .single();

        if (error && error.code !== 'PGRST116') throw error;
        res.status(200).json(data || { current_streak: 0, longest_streak: 0 });
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
});

/**
 * @swagger
 * /api/stats:
 *   get:
 *     summary: Get overall problem stats
 *     responses:
 *       200:
 *         description: Successfully retrieved stats
 */
router.get('/stats', verifyAuth, async (req, res) => {
    const userId = req.user.id;
    const cacheKey = `stats:${userId}`;
    try {
        // Check Redis cache first
        const cached = await cache.get(cacheKey);
        if (cached) return res.status(200).json(cached);

        // Query the SQL view scoped to this user
        const { data, error } = await req.supabase
            .from('user_difficulty_stats')
            .select('*')
            .eq('user_id', userId)
            .single();

        if (error && error.code !== 'PGRST116') throw error;

        const stats = {
            solved: data?.total_solved || 0,
            easy: data?.easy_count || 0,
            medium: data?.medium_count || 0,
            hard: data?.hard_count || 0,
        };

        await cache.set(cacheKey, stats, cache.DEFAULTS.stats);
        res.status(200).json(stats);
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
});

/**
 * @swagger
 * /api/problems:
 *   get:
 *     summary: Get all logged problems with cursor pagination
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *         description: Number of items to return
 *       - in: query
 *         name: cursor
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Cursor (solved_at timestamp) for pagination
 *     responses:
 *       200:
 *         description: Successfully retrieved problems
 */
router.get('/problems', verifyAuth, async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 50;
        const cursor = req.query.cursor; // expected to be an ISO timestamp

        let query = req.supabase
            .from('problems')
            .select('id, problem_name, topic, difficulty, language, platform, problem_url, code_snippet, solved_at, revision_count, next_revision_at')
            .eq('user_id', req.user.id)
            .order('solved_at', { ascending: false })
            .limit(limit + 1); // fetch one extra to determine if there's a next page

        if (cursor) {
            query = query.lt('solved_at', cursor);
        }

        const { data, error } = await query;

        if (error) throw error;

        const hasNextPage = data.length > limit;
        const results = hasNextPage ? data.slice(0, limit) : data;
        const nextCursor = hasNextPage ? results[results.length - 1].solved_at : null;

        res.status(200).json({
            data: results,
            next_cursor: nextCursor,
            has_next_page: hasNextPage
        });
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
});

const noteSchema = z.object({
    problem_id: z.string().uuid('Invalid problem ID'),
    note: z.string().min(1, 'Note content cannot be empty')
});

/**
 * @swagger
 * /api/notes:
 *   post:
 *     summary: Add a note to a problem
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               problem_id:
 *                 type: string
 *               note:
 *                 type: string
 *     responses:
 *       201:
 *         description: Note added successfully
 */
router.post('/notes', verifyAuth, async (req, res) => {
    try {
        const validatedData = noteSchema.parse(req.body);
        const { problem_id, note } = validatedData;

        // Ensure user actually owns this problem before letting them attach a note
        const { data: problemCheck, error: checkError } = await req.supabase
            .from('problems')
            .select('id')
            .eq('id', problem_id)
            .eq('user_id', req.user.id)
            .single();

        if (checkError || !problemCheck) {
            return res.status(403).json({ status: 'error', message: 'Not authorized to add notes to this problem' });
        }

        const { data, error } = await req.supabase
            .from('notes')
            .insert([
                { problem_id, content: note }
            ]);

        if (error) throw error;

        res.status(201).json({ status: 'success', data });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ status: 'error', message: 'Validation failed', errors: error.errors });
        }
        res.status(500).json({ status: 'error', message: error.message });
    }
});

/**
 * @swagger
 * /api/analytics/velocity:
 *   get:
 *     summary: Get user solve velocity (last 7 days)
 *     responses:
 *       200:
 *         description: Solve velocity data
 */
router.get('/analytics/velocity', verifyAuth, async (req, res) => {
    const userId = req.user.id;
    const cacheKey = `velocity:${userId}`;
    try {
        const cached = await cache.get(cacheKey);
        if (cached) return res.status(200).json(cached);

        const { data, error } = await req.supabase
            .from('user_velocity')
            .select('*')
            .eq('user_id', userId)
            .single();

        if (error && error.code !== 'PGRST116') throw error;
        const result = data || { solves_last_7_days: 0, daily_velocity: 0 };
        await cache.set(cacheKey, result, cache.DEFAULTS.velocity);
        res.status(200).json(result);
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
});

/**
 * @swagger
 * /api/topics:
 *   get:
 *     summary: Get all topics with mastery data
 *     responses:
 *       200:
 *         description: List of topics
 */
router.get('/topics', async (req, res) => {
    try {
        const { data, error } = await supabase.from('topics').select('*');
        if (error) throw error;
        res.status(200).json(data);
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
});

/**
 * @swagger
 * /api/problems/{id}/analyze:
 *   post:
 *     summary: Get AI-powered code analysis for a problem
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: AI analysis results
 */
// Notes retrieval endpoint for the Notes Viewer UI
router.get('/problems/:id/notes', verifyAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        // Ownership check
        const { data: problemCheck } = await req.supabase
            .from('problems').select('id').eq('id', id).eq('user_id', userId).single();
        if (!problemCheck) return res.status(403).json({ status: 'error', message: 'Not authorized' });

        const { data, error } = await req.supabase
            .from('notes')
            .select('id, content, created_at')
            .eq('problem_id', id)
            .order('created_at', { ascending: false });

        if (error) throw error;
        res.status(200).json(data || []);
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
});

router.post('/problems/:id/analyze', verifyAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        const { code } = req.body; // Optional: actual code content from the user

        // Fetch the problem record for context
        const { data: problem, error: fetchError } = await req.supabase
            .from('problems')
            .select('problem_name, topic, difficulty, language')
            .eq('id', id)
            .eq('user_id', userId)
            .single();

        if (fetchError || !problem) {
            return res.status(404).json({ status: 'error', message: 'Problem not found' });
        }

        let analysis;

        if (analysisAI) {
            // Intelligent technical review with optional code content
            const model = analysisAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
            const codeSection = code
                ? `\n\nCode Solution:\n\`\`\`${problem.language.toLowerCase()}\n${code}\n\`\`\``
                : '';

            const prompt = `You are an expert DSA coach. Analyze the following problem and provide a concise technical review.\n\nProblem: ${problem.problem_name}\nTopic: ${problem.topic}\nDifficulty: ${problem.difficulty}\nLanguage: ${problem.language}${codeSection}\n\nProvide a JSON response with exactly these fields:\n- time_complexity (string)\n- space_complexity (string)\n- bottlenecks (string, one sentence)\n- recommendations (string, one actionable tip)\n- edge_cases (array of 3 strings)\n\nRespond ONLY with valid JSON.`;

            const result = await model.generateContent(prompt);
            const text = result.response.text().replace(/\`\`\`json|\`\`\`/g, '').trim();
            analysis = JSON.parse(text);
        } else {
            analysis = {
                time_complexity: 'O(N log N)',
                space_complexity: 'O(N)',
                bottlenecks: `The typical bottleneck for ${problem.topic} problems is repeated traversal — look for early-exit conditions.`,
                recommendations: `For ${problem.difficulty} ${problem.topic} problems, consider if a hash map or monotonic stack can reduce time complexity.`,
                edge_cases: ['Empty input', 'Single element', 'All identical elements']
            };
        }

        res.status(200).json({ status: 'success', analysis });
    } catch (error) {
        console.error('Analysis error:', error);
        res.status(500).json({ status: 'error', message: 'Analysis failed. ' + error.message });
    }
});

/**
 * @swagger
 * /api/email/send-digest:
 *   post:
 *     summary: Manually trigger the weekly digest email for the current user
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Digest email sent successfully
 *       503:
 *         description: RESEND_API_KEY not configured
 */
router.post('/email/send-digest', verifyAuth, async (req, res) => {
    try {
        const { runDigestForUser } = require('../jobs/weeklyDigest');
        // Pass req.user to bypass admin permission check for manual trigger
        const result = await runDigestForUser(req.user.id, req.user);
        if (!result.ok) {
            return res.status(503).json({
                status: 'error',
                message: result.message || 'Email service not configured. Please set RESEND_API_KEY in your .env file.'
            });
        }
        res.status(200).json({ status: 'success', message: 'Weekly digest email sent! Check your inbox.' });
    } catch (error) {
        console.error('Digest trigger error:', error);
        res.status(500).json({ status: 'error', message: error.message });
    }
});


module.exports = router;

