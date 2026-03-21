/**
 * apps/api/src/jobs/index.js
 *
 * Job scheduler entry point.
 * Import and call this from index.js to activate background jobs.
 * All jobs no-op gracefully when REDIS_URL is not set.
 */
const { initRevisionReminder } = require('./revisionReminder');
const { initWeeklyDigest } = require('./weeklyDigest');

function initJobs() {
    if (!process.env.REDIS_URL) {
        console.log('[Jobs] Skipping background jobs (REDIS_URL not configured).');
        return false;
    }
    try {
        initRevisionReminder();
        initWeeklyDigest();
        console.log('[Jobs] All background jobs initialized.');
        return true;
    } catch (e) {
        console.error('[Jobs] Failed to initialize jobs (non-fatal):', e.message);
        return false;
    }
}

module.exports = { initJobs };
