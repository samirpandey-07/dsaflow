const express = require('express');
const { verifyAuth } = require('../middleware/auth');
const { ok, fail } = require('../lib/http');
const analyticsService = require('../services/analytics.service');

const router = express.Router();

router.get('/achievements', verifyAuth, async (req, res) => {
    try {
        const data = await analyticsService.getAchievements(req.supabase, req.user.id);
        return ok(res, data);
    } catch (error) {
        return fail(res, error.status || 500, error.message);
    }
});

module.exports = router;
