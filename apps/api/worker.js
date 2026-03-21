require('dotenv').config();

const { initJobs } = require('./src/jobs');

console.log('[Worker] Starting DSAFlow background worker...');
if (!initJobs()) {
    console.error('[Worker] Background jobs could not be initialized. Check REDIS_URL and SUPABASE_SERVICE_ROLE_KEY.');
    process.exit(1);
}
