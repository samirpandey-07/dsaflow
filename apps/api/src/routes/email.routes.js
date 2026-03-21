const express = require('express');
const { verifyAuth } = require('../middleware/auth');
const { ok, fail } = require('../lib/http');
const { runDigestForUser } = require('../jobs/weeklyDigest');

const router = express.Router();

router.post('/email/send-digest', verifyAuth, async (req, res) => {
    try {
        const result = await runDigestForUser(req.user.id, {
            user: req.user,
            client: req.supabase,
        });

        if (!result.ok) {
            return fail(res, 503, result.message || 'Email service not configured. Please set RESEND_API_KEY in your .env file.');
        }

        return ok(res, { message: 'Weekly digest email sent! Check your inbox.' });
    } catch (error) {
        return fail(res, error.status || 500, error.message);
    }
});

module.exports = router;
