const express = require('express');
const { verifyAuth } = require('../middleware/auth');
const { ok, fail } = require('../lib/http');
const { parsePositiveInt } = require('../lib/parsing');
const analyticsService = require('../services/analytics.service');

const router = express.Router();

router.get('/stats', verifyAuth, async (req, res) => {
    try {
        const data = await analyticsService.getStats(req.supabase, req.user.id);
        return res.status(200).json(data);
    } catch (error) {
        return fail(res, error.status || 500, error.message);
    }
});

router.get('/user/stats', verifyAuth, async (req, res) => {
    try {
        const data = await analyticsService.getUserStats(req.supabase, req.user.id);
        return ok(res, data);
    } catch (error) {
        return fail(res, error.status || 500, error.message);
    }
});

router.get('/analytics/velocity', verifyAuth, async (req, res) => {
    try {
        const data = await analyticsService.getVelocity(req.supabase, req.user.id);
        return res.status(200).json(data);
    } catch (error) {
        return fail(res, error.status || 500, error.message);
    }
});

router.get('/analytics/activity', verifyAuth, async (req, res) => {
    try {
        const days = Math.min(parsePositiveInt(req.query.days, 84), 365);
        const data = await analyticsService.getActivity(req.supabase, req.user.id, days);
        return ok(res, data);
    } catch (error) {
        return fail(res, error.status || 500, error.message);
    }
});

router.get('/analytics/platforms', verifyAuth, async (req, res) => {
    try {
        const data = await analyticsService.getPlatforms(req.supabase, req.user.id);
        return ok(res, data);
    } catch (error) {
        return fail(res, error.status || 500, error.message);
    }
});

router.get('/analytics/topics', verifyAuth, async (req, res) => {
    try {
        const data = await analyticsService.getTopics(req.supabase, req.user.id);
        return ok(res, data);
    } catch (error) {
        return fail(res, error.status || 500, error.message);
    }
});

router.get('/analytics/overview', verifyAuth, async (req, res) => {
    try {
        const data = await analyticsService.getOverview(req.supabase, req.user.id);
        return ok(res, data);
    } catch (error) {
        return fail(res, error.status || 500, error.message);
    }
});

router.get('/analytics/insights', verifyAuth, async (req, res) => {
    try {
        const data = await analyticsService.getInsights(req.supabase, req.user.id);
        return ok(res, data);
    } catch (error) {
        return fail(res, error.status || 500, error.message);
    }
});

module.exports = router;
