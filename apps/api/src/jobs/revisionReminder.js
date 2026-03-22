const { Worker, Queue } = require('bullmq');
const { getServiceClient } = require('../db/supabase');

const QUEUE_NAME = 'daily-revision-reminder';

function getResend() {
    if (!process.env.RESEND_API_KEY || process.env.RESEND_API_KEY === 'REPLACE_WITH_YOUR_RESEND_API_KEY') {
        return null;
    }

    const { Resend } = require('resend');
    return new Resend(process.env.RESEND_API_KEY);
}

function getDashboardUrl() {
    return process.env.DASHBOARD_URL || process.env.NEXT_PUBLIC_SITE_URL || 'https://dsaflow-dashboard.vercel.app';
}

function initRevisionReminder() {
    const serviceClient = getServiceClient();
    if (!serviceClient) {
        console.warn('[RevisionReminder] SUPABASE_SERVICE_ROLE_KEY is required for background reminders.');
        return;
    }

    const connection = { url: process.env.REDIS_URL };
    const queue = new Queue(QUEUE_NAME, { connection });

    queue.add('daily-check', {}, {
        jobId: 'daily-check',
        repeat: { cron: '0 8 * * *' },
        removeOnComplete: true,
    }).catch((error) => {
        console.warn('[RevisionReminder] Could not register repeatable job:', error.message);
    });

    const worker = new Worker(QUEUE_NAME, async () => {
        console.log(`[RevisionReminder] Running daily check at ${new Date().toISOString()}`);

        const { data: overdue, error } = await serviceClient
            .from('problems')
            .select('user_id, problem_name, next_revision_at')
            .lte('next_revision_at', new Date().toISOString());

        if (error) {
            console.error('[RevisionReminder] DB error:', error.message);
            return;
        }

        const byUser = {};
        for (const problem of overdue || []) {
            if (!byUser[problem.user_id]) {
                byUser[problem.user_id] = [];
            }
            byUser[problem.user_id].push(problem.problem_name);
        }

        const resend = getResend();

        for (const [userId, problems] of Object.entries(byUser)) {
            const count = problems.length;
            const preview = problems.slice(0, 3).join(', ') + (count > 3 ? '...' : '');

            if (!resend) {
                console.log(`[RevisionReminder] User ${userId} has ${count} problem(s) to revise: ${preview}`);
                continue;
            }

            const { data: adminData, error: userError } = await serviceClient.auth.admin.getUserById(userId);
            if (userError || !adminData?.user?.email) {
                console.warn(`[RevisionReminder] Could not get email for ${userId}: ${userError?.message || 'Missing email'}`);
                continue;
            }

            const user = adminData.user;
            const userName = user.user_metadata?.full_name || user.email.split('@')[0];
            const html = `
<!DOCTYPE html><html><body style="font-family:sans-serif;background:#09090b;color:#d4d4d8;padding:24px;">
  <div style="max-width:500px;margin:0 auto;background:#18181b;border:1px solid #27272a;border-radius:16px;padding:28px;">
    <h2 style="color:#fb923c;margin:0 0 8px;">Revision time, ${userName}!</h2>
    <p style="color:#a1a1aa;margin:0 0 16px;">You have <strong style="color:#fff;">${count} problem${count > 1 ? 's' : ''}</strong> waiting for review.</p>
    <div style="background:#0f172a;border-radius:10px;padding:14px;">
      <p style="margin:0;color:#94a3b8;font-size:13px;">${preview}</p>
    </div>
    <a href="${getDashboardUrl()}" style="display:inline-block;margin-top:20px;background:#0ea5e9;color:#fff;text-decoration:none;padding:12px 24px;border-radius:10px;font-weight:700;">Open dashboard</a>
  </div>
</body></html>`;

            const { error: sendError } = await resend.emails.send({
                from: process.env.FROM_EMAIL || 'onboarding@resend.dev',
                to: user.email,
                subject: `DSAFlow: ${count} problem${count > 1 ? 's' : ''} due for revision`,
                html,
            });

            if (sendError) {
                console.error(`[RevisionReminder] Failed to email ${user.email}:`, sendError.message);
            } else {
                console.log(`[RevisionReminder] Reminder sent to ${user.email}`);
            }
        }
    }, { connection });

    worker.on('completed', () => console.log('[RevisionReminder] Daily check complete.'));
    worker.on('failed', (_job, err) => console.error('[RevisionReminder] Job failed:', err.message));

    console.log('[Jobs] Revision reminder scheduler started (cron: 08:00 UTC daily).');
}

module.exports = { initRevisionReminder };
