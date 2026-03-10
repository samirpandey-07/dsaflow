/**
 * apps/api/src/jobs/revisionReminder.js
 *
 * BullMQ background job: Daily revision reminder.
 * Queries for users with overdue revision items and sends an email via Resend.
 * Only starts if REDIS_URL is configured.
 */
const { Worker, Queue } = require('bullmq');
const { supabase } = require('../db/supabase');

const QUEUE_NAME = 'daily-revision-reminder';

function getResend() {
    if (!process.env.RESEND_API_KEY || process.env.RESEND_API_KEY === 'REPLACE_WITH_YOUR_RESEND_API_KEY') return null;
    const { Resend } = require('resend');
    return new Resend(process.env.RESEND_API_KEY);
}

function initRevisionReminder() {
    const connection = { url: process.env.REDIS_URL };

    const queue = new Queue(QUEUE_NAME, { connection });

    // Schedule: run every day at 08:00 UTC
    queue.add('daily-check', {}, {
        repeat: { cron: '0 8 * * *' },
        removeOnComplete: true,
    });

    const worker = new Worker(QUEUE_NAME, async () => {
        console.log(`[RevisionReminder] Running daily check at ${new Date().toISOString()}`);

        const { data: overdue, error } = await supabase
            .from('problems')
            .select('user_id, problem_name, next_revision_at')
            .lte('next_revision_at', new Date().toISOString());

        if (error) {
            console.error('[RevisionReminder] DB error:', error.message);
            return;
        }

        // Group overdue problems by user
        const byUser = {};
        (overdue || []).forEach((p) => {
            if (!byUser[p.user_id]) byUser[p.user_id] = [];
            byUser[p.user_id].push(p.problem_name);
        });

        const resend = getResend();

        for (const [userId, problems] of Object.entries(byUser)) {
            const count = problems.length;
            const preview = problems.slice(0, 3).join(', ') + (count > 3 ? '...' : '');

            if (!resend) {
                // Fallback: just log
                console.log(`[RevisionReminder] User ${userId} has ${count} problem(s) to revise: ${preview}`);
                continue;
            }

            // Fetch user email
            const { data: { user } } = await supabase.auth.admin.getUserById(userId);
            if (!user?.email) continue;

            const userName = user.user_metadata?.full_name || user.email.split('@')[0];

            const html = `
<!DOCTYPE html><html><body style="font-family:sans-serif;background:#09090b;color:#d4d4d8;padding:24px;">
  <div style="max-width:500px;margin:0 auto;background:#18181b;border:1px solid #27272a;border-radius:16px;padding:28px;">
    <h2 style="color:#fb923c;margin:0 0 8px;">⏰ Revision Time, ${userName}!</h2>
    <p style="color:#a1a1aa;margin:0 0 16px;">You have <strong style="color:#fff;">${count} problem${count > 1 ? 's' : ''}</strong> waiting for review.</p>
    <div style="background:#0f172a;border-radius:10px;padding:14px;">
      <p style="margin:0;color:#94a3b8;font-size:13px;">📝 ${preview}</p>
    </div>
    <a href="http://localhost:3000" style="display:inline-block;margin-top:20px;background:#7c3aed;color:#fff;text-decoration:none;padding:12px 24px;border-radius:10px;font-weight:700;">Open Dashboard →</a>
  </div>
</body></html>`;

            const { error: sendError } = await resend.emails.send({
                from: process.env.FROM_EMAIL || 'onboarding@resend.dev',
                to: user.email,
                subject: `⏰ DSAFlow: ${count} problem${count > 1 ? 's' : ''} due for revision`,
                html,
            });

            if (sendError) {
                console.error(`[RevisionReminder] Failed to email ${user.email}:`, sendError.message);
            } else {
                console.log(`[RevisionReminder] ✅ Reminder sent to ${user.email}`);
            }
        }
    }, { connection });

    worker.on('completed', () => console.log('[RevisionReminder] Daily check complete.'));
    worker.on('failed', (job, err) => console.error('[RevisionReminder] Job failed:', err.message));

    console.log('[Jobs] Revision reminder scheduler started (cron: 08:00 UTC daily).');
}

module.exports = { initRevisionReminder };
