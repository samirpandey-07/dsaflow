const express = require('express');
const { z } = require('zod');
const { verifyAuth } = require('../middleware/auth');
const { ok, fail } = require('../lib/http');
const { goalSchema, goalUpdateSchema } = require('../validation/schemas');
const goalService = require('../services/goal.service');
const readinessService = require('../services/readiness.service');

const router = express.Router();

router.get('/goals', verifyAuth, async (req, res) => {
    try {
        const data = await goalService.listGoals(req.supabase, req.user.id);
        return ok(res, data);
    } catch (error) {
        return fail(res, error.status || 500, error.message);
    }
});

router.post('/goals', verifyAuth, async (req, res) => {
    try {
        const payload = goalSchema.parse(req.body);
        const data = await goalService.createGoal(req.supabase, req.user.id, payload);
        return ok(res, data, 201);
    } catch (error) {
        if (error instanceof z.ZodError) {
            return fail(res, 400, 'Validation failed', error.issues);
        }
        return fail(res, error.status || 500, error.message);
    }
});

router.patch('/goals/:id', verifyAuth, async (req, res) => {
    try {
        const payload = goalUpdateSchema.parse(req.body);
        const data = await goalService.updateGoal(req.supabase, req.user.id, req.params.id, payload);
        return ok(res, data);
    } catch (error) {
        if (error instanceof z.ZodError) {
            return fail(res, 400, 'Validation failed', error.issues);
        }
        return fail(res, error.status || 500, error.message);
    }
});

router.delete('/goals/:id', verifyAuth, async (req, res) => {
    try {
        const data = await goalService.deleteGoal(req.supabase, req.user.id, req.params.id);
        return ok(res, data);
    } catch (error) {
        return fail(res, error.status || 500, error.message);
    }
});

router.get('/interview-readiness', verifyAuth, async (req, res) => {
    try {
        const data = await readinessService.getInterviewReadiness(req.supabase, req.user.id);
        return ok(res, data);
    } catch (error) {
        return fail(res, error.status || 500, error.message);
    }
});

module.exports = router;
