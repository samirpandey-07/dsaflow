/**
 * apps/api/src/jobs/weeklyDigest.js
 *
 * BullMQ background job: Weekly DSA summary email via Resend.
 * Runs every Monday at 09:00 UTC.
 * Only starts if both REDIS_URL and RESEND_API_KEY are configured.
 */
const { Worker, Queue } = require('bullmq');
const { supabase } = require('../db/supabase');
const { buildDigestEmail } = require('../emails/weeklyDigest');

const QUEUE_NAME = 'weekly-digest';

// Helper: initialize Resend lazily so missing key is graceful
function getResend() {
    if (!process.env.RESEND_API_KEY || process.env.RESEND_API_KEY === 'REPLACE_WITH_YOUR_RESEND_API_KEY') {
        return null;
    }
    const { Resend } = require('resend');
    return new Resend(process.env.RESEND_API_KEY);
}

/**
 * Collect stats for a single user and fire off the digest email.
 */
/**
 * Collect stats for a single user and fire off the digest email.
 * @param {string} userId
 * @param {Object} resend
 * @param {Object} userOverride - Optional user object from auth session
 */
async function sendDigestForUser(userId, resend, userOverride = null) {
    let user = userOverride;

    if (!user) {
        // Only try admin access if no override provided (crucial for background jobs)
        const { data: adminData, error: authErr } = await supabase.auth.admin.getUserById(userId);
        if (authErr || !adminData?.user?.email) {
            console.warn(`[WeeklyDigest] Could not get email for user ${userId}: ${authErr?.message || 'No email found'}. Background cron requires SUPABASE_SERVICE_ROLE_KEY.`);
            return false;
        }
        user = adminData.user;
    }

    if (!user?.email) return false;

    const userName = user.user_metadata?.full_name || user.email.split('@')[0];
    const now = new Date();
    const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();
    const fourteenDaysAgo = new Date(now - 14 * 24 * 60 * 60 * 1000).toISOString();

    // ... (rest of data fetching logic stays same)
    // 2. Fetch this week's problems
    const { data: thisWeekProblems } = await supabase
        .from('problems')
        .select('problem_name, topic, difficulty, problem_url, solved_at')
        .eq('user_id', userId)
        .gte('solved_at', sevenDaysAgo)
        .order('solved_at', { ascending: false });

    // 3. Fetch last week's problems (for comparison)
    const { data: lastWeekProblems } = await supabase
        .from('problems')
        .select('id')
        .eq('user_id', userId)
        .gte('solved_at', fourteenDaysAgo)
        .lt('solved_at', sevenDaysAgo);

    // 4. Fetch all-time totals
    const { data: allProblems } = await supabase
        .from('problems')
        .select('difficulty')
        .eq('user_id', userId);

    // 5. Fetch streak
    const { data: statsRow } = await supabase
        .from('user_stats')
        .select('current_streak')
        .eq('user_id', userId)
        .single();

    // 6. Count overdue revisions
    const { count: overdueCount } = await supabase
        .from('problems')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .lte('next_revision_at', now.toISOString());

    // Process difficulty totals (all-time)
    const diffCounts = { Easy: 0, Medium: 0, Hard: 0 };
    (allProblems || []).forEach(p => { if (diffCounts[p.difficulty] !== undefined) diffCounts[p.difficulty]++; });

    // Top topics this week
    const topicMap = {};
    (thisWeekProblems || []).forEach(p => {
        topicMap[p.topic] = (topicMap[p.topic] || 0) + 1;
    });
    const topTopics = Object.entries(topicMap)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([name, count]) => ({ name, count }));

    const emailData = {
        userName,
        currentStreak: statsRow?.current_streak || 0,
        solvedThisWeek: (thisWeekProblems || []).length,
        solvedLastWeek: (lastWeekProblems || []).length,
        easyCount: diffCounts.Easy,
        mediumCount: diffCounts.Medium,
        hardCount: diffCounts.Hard,
        topTopics,
        recentProblems: (thisWeekProblems || []).slice(0, 5),
        overdueRevisions: overdueCount || 0,
    };

    const { subject, html } = buildDigestEmail(emailData);

    const { data: sendResult, error: sendError } = await resend.emails.send({
        from: process.env.FROM_EMAIL || 'onboarding@resend.dev',
        to: user.email,
        subject,
        html,
    });

    if (sendError) {
        console.error(`[WeeklyDigest] Failed to send email to ${user.email}:`, sendError.message);
        return false;
    } else {
        console.log(`[WeeklyDigest] ✅ Sent to ${user.email} (id: ${sendResult?.id})`);
        return true;
    }
}

/**
 * Manually trigger a digest for a specific user (for testing / API endpoint).
 * @param {string} userId
 * @param {Object} userOverride - Pass the user info from the session
 */
async function runDigestForUser(userId, userOverride = null) {
    const resend = getResend();
    if (!resend) {
        return { ok: false, message: 'RESEND_API_KEY not configured' };
    }
    const success = await sendDigestForUser(userId, resend, userOverride);
    return { ok: success, message: success ? 'Email sent!' : 'Failed to send email. Check logs.' };
}


/**
 * Initialize the weekly digest BullMQ queue.
 * Called from jobs/index.js only when REDIS_URL is set.
 */
function initWeeklyDigest() {
    const connection = { url: process.env.REDIS_URL };
    const resend = getResend();

    if (!resend) {
        console.log('[WeeklyDigest] RESEND_API_KEY not set — weekly emails disabled.');
        return;
    }

    const queue = new Queue(QUEUE_NAME, { connection });

    // Schedule: every Monday at 09:00 UTC
    queue.add('send-weekly-digest', {}, {
        repeat: { cron: '0 9 * * 1' },
        removeOnComplete: true,
    });

    const worker = new Worker(QUEUE_NAME, async () => {
        console.log(`[WeeklyDigest] Starting weekly digest run at ${new Date().toISOString()}`);

        // Fetch all unique user IDs from problems table
        const { data: users, error } = await supabase
            .from('user_stats')
            .select('user_id');

        if (error) {
            console.error('[WeeklyDigest] Could not fetch users:', error.message);
            return;
        }

        for (const row of (users || [])) {
            try {
                await sendDigestForUser(row.user_id, resend);
            } catch (e) {
                console.error(`[WeeklyDigest] Error for user ${row.user_id}:`, e.message);
            }
        }

        console.log('[WeeklyDigest] Weekly digest run complete.');
    }, { connection });

    worker.on('completed', () => console.log('[WeeklyDigest] Batch complete.'));
    worker.on('failed', (job, err) => console.error('[WeeklyDigest] Job failed:', err.message));

    console.log('[Jobs] Weekly digest scheduler started (cron: Monday 09:00 UTC).');
}

module.exports = { initWeeklyDigest, runDigestForUser };
