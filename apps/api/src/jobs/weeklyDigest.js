const { Worker, Queue } = require('bullmq');
const { getServiceClient } = require('../db/supabase');
const { buildDigestEmail } = require('../emails/weeklyDigest');

const QUEUE_NAME = 'weekly-digest';

function getResend() {
    if (!process.env.RESEND_API_KEY || process.env.RESEND_API_KEY === 'REPLACE_WITH_YOUR_RESEND_API_KEY') {
        return null;
    }

    const { Resend } = require('resend');
    return new Resend(process.env.RESEND_API_KEY);
}

async function fetchDigestData(client, userId) {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString();

    const [thisWeekProblemsResult, lastWeekProblemsResult, allProblemsResult, statsRowResult, overdueResult] = await Promise.all([
        client
            .from('problems')
            .select('problem_name, topic, difficulty, problem_url, solved_at')
            .eq('user_id', userId)
            .gte('solved_at', sevenDaysAgo)
            .order('solved_at', { ascending: false }),
        client
            .from('problems')
            .select('id')
            .eq('user_id', userId)
            .gte('solved_at', fourteenDaysAgo)
            .lt('solved_at', sevenDaysAgo),
        client
            .from('problems')
            .select('difficulty')
            .eq('user_id', userId),
        client
            .from('user_stats')
            .select('current_streak')
            .eq('user_id', userId)
            .single(),
        client
            .from('problems')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', userId)
            .lte('next_revision_at', now.toISOString()),
    ]);

    if (thisWeekProblemsResult.error) throw thisWeekProblemsResult.error;
    if (lastWeekProblemsResult.error) throw lastWeekProblemsResult.error;
    if (allProblemsResult.error) throw allProblemsResult.error;
    if (statsRowResult.error && statsRowResult.error.code !== 'PGRST116') throw statsRowResult.error;
    if (overdueResult.error) throw overdueResult.error;

    return {
        thisWeekProblems: thisWeekProblemsResult.data || [],
        lastWeekProblems: lastWeekProblemsResult.data || [],
        allProblems: allProblemsResult.data || [],
        currentStreak: statsRowResult.data?.current_streak || 0,
        overdueRevisions: overdueResult.count || 0,
    };
}

async function sendDigestForUser(userId, resend, options = {}) {
    const serviceClient = getServiceClient();
    const client = options.client || serviceClient;
    let user = options.user || null;

    if (!client) {
        console.warn('[WeeklyDigest] No authenticated data client available for digest generation.');
        return false;
    }

    if (!user) {
        if (!serviceClient) {
            console.warn('[WeeklyDigest] Background digest requires SUPABASE_SERVICE_ROLE_KEY to load user emails.');
            return false;
        }

        const { data: adminData, error: authError } = await serviceClient.auth.admin.getUserById(userId);
        if (authError || !adminData?.user?.email) {
            console.warn(`[WeeklyDigest] Could not get email for user ${userId}: ${authError?.message || 'No email found'}`);
            return false;
        }

        user = adminData.user;
    }

    if (!user?.email) {
        return false;
    }

    const digestData = await fetchDigestData(client, userId);
    const diffCounts = { Easy: 0, Medium: 0, Hard: 0 };
    for (const problem of digestData.allProblems) {
        if (diffCounts[problem.difficulty] !== undefined) {
            diffCounts[problem.difficulty] += 1;
        }
    }

    const topicMap = {};
    for (const problem of digestData.thisWeekProblems) {
        topicMap[problem.topic] = (topicMap[problem.topic] || 0) + 1;
    }

    const topTopics = Object.entries(topicMap)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([name, count]) => ({ name, count }));

    const userName = user.user_metadata?.full_name || user.email.split('@')[0];
    const { subject, html } = buildDigestEmail({
        userName,
        currentStreak: digestData.currentStreak,
        solvedThisWeek: digestData.thisWeekProblems.length,
        solvedLastWeek: digestData.lastWeekProblems.length,
        easyCount: diffCounts.Easy,
        mediumCount: diffCounts.Medium,
        hardCount: diffCounts.Hard,
        topTopics,
        recentProblems: digestData.thisWeekProblems.slice(0, 5),
        overdueRevisions: digestData.overdueRevisions,
    });

    const { data: sendResult, error: sendError } = await resend.emails.send({
        from: process.env.FROM_EMAIL || 'onboarding@resend.dev',
        to: user.email,
        subject,
        html,
    });

    if (sendError) {
        console.error(`[WeeklyDigest] Failed to send email to ${user.email}:`, sendError.message);
        return false;
    }

    console.log(`[WeeklyDigest] Sent to ${user.email} (id: ${sendResult?.id || 'n/a'})`);
    return true;
}

async function runDigestForUser(userId, options = {}) {
    const resend = getResend();
    if (!resend) {
        return { ok: false, message: 'RESEND_API_KEY not configured' };
    }

    const success = await sendDigestForUser(userId, resend, options);
    return { ok: success, message: success ? 'Email sent!' : 'Failed to send email. Check logs.' };
}

function initWeeklyDigest() {
    const serviceClient = getServiceClient();
    if (!serviceClient) {
        console.warn('[WeeklyDigest] SUPABASE_SERVICE_ROLE_KEY is required for background digests.');
        return;
    }

    const connection = { url: process.env.REDIS_URL };
    const resend = getResend();

    if (!resend) {
        console.log('[WeeklyDigest] RESEND_API_KEY not set; weekly emails disabled.');
        return;
    }

    const queue = new Queue(QUEUE_NAME, { connection });
    queue.add('send-weekly-digest', {}, {
        jobId: 'send-weekly-digest',
        repeat: { cron: '0 9 * * 1' },
        removeOnComplete: true,
    }).catch((error) => {
        console.warn('[WeeklyDigest] Could not register repeatable job:', error.message);
    });

    const worker = new Worker(QUEUE_NAME, async () => {
        console.log(`[WeeklyDigest] Starting weekly digest run at ${new Date().toISOString()}`);

        const { data: users, error } = await serviceClient
            .from('user_stats')
            .select('user_id');

        if (error) {
            console.error('[WeeklyDigest] Could not fetch users:', error.message);
            return;
        }

        for (const row of users || []) {
            try {
                await sendDigestForUser(row.user_id, resend);
            } catch (workerError) {
                console.error(`[WeeklyDigest] Error for user ${row.user_id}:`, workerError.message);
            }
        }

        console.log('[WeeklyDigest] Weekly digest run complete.');
    }, { connection });

    worker.on('completed', () => console.log('[WeeklyDigest] Batch complete.'));
    worker.on('failed', (_job, err) => console.error('[WeeklyDigest] Job failed:', err.message));

    console.log('[Jobs] Weekly digest scheduler started (cron: Monday 09:00 UTC).');
}

module.exports = { initWeeklyDigest, runDigestForUser };
