const express = require('express');
const { z } = require('zod');
const { verifyAuth } = require('../middleware/auth');
const { ok, fail } = require('../lib/http');
const { parsePositiveInt } = require('../lib/parsing');
const { problemSchema, bulkImportSchema, problemUpdateSchema } = require('../validation/schemas');
const problemService = require('../services/problem.service');
const analysisService = require('../services/analysis.service');

const router = express.Router();

router.post('/problems', verifyAuth, async (req, res) => {
    try {
        const validatedData = problemSchema.parse(req.body);
        const result = await problemService.createProblem(req.supabase, req.user.id, validatedData);
        res.set('X-DSAFlow-Created', result.created ? 'true' : 'false');
        return ok(res, result.problem, result.created ? 201 : 200);
    } catch (error) {
        if (error instanceof z.ZodError) {
            return fail(res, 400, 'Validation failed', error.issues);
        }
        return fail(res, error.status || 500, error.message);
    }
});

router.post('/problems/bulk-import', verifyAuth, async (req, res) => {
    try {
        const validatedData = bulkImportSchema.parse(req.body);
        const result = await problemService.bulkImportProblems(req.supabase, req.user.id, validatedData.problems);
        return ok(res, result, 201);
    } catch (error) {
        if (error instanceof z.ZodError) {
            return fail(res, 400, 'Validation failed', error.issues);
        }
        return fail(res, error.status || 500, error.message);
    }
});

router.get('/problems', verifyAuth, async (req, res) => {
    try {
        const options = {
            limit: Math.min(parsePositiveInt(req.query.limit, 20), 100),
            cursor: req.query.cursor,
            search: req.query.search?.trim(),
            topic: req.query.topic?.trim(),
            difficulty: req.query.difficulty?.trim(),
            platform: req.query.platform?.trim(),
            revisionStatus: req.query.revision_status?.trim(),
            sortBy: ['solved_at', 'problem_name', 'difficulty', 'topic', 'platform'].includes(req.query.sort_by)
                ? req.query.sort_by
                : 'solved_at',
            ascending: req.query.sort_order === 'asc',
        };

        const data = await problemService.listProblems(req.supabase, req.user.id, options);
        return ok(res, data);
    } catch (error) {
        return fail(res, error.status || 500, error.message);
    }
});

router.patch('/problems/:id', verifyAuth, async (req, res) => {
    try {
        const validatedData = problemUpdateSchema.parse(req.body);
        const data = await problemService.updateProblem(req.supabase, req.user.id, req.params.id, validatedData);
        return ok(res, data);
    } catch (error) {
        if (error instanceof z.ZodError) {
            return fail(res, 400, 'Validation failed', error.issues);
        }
        return fail(res, error.status || 500, error.message);
    }
});

router.delete('/problems/:id', verifyAuth, async (req, res) => {
    try {
        const data = await problemService.deleteProblem(req.supabase, req.user.id, req.params.id);
        return ok(res, data);
    } catch (error) {
        return fail(res, error.status || 500, error.message);
    }
});

router.post('/problems/:id/analyze', verifyAuth, async (req, res) => {
    try {
        const data = await analysisService.analyzeProblem(req.supabase, req.user.id, req.params.id, req.body?.code);
        return ok(res, data);
    } catch (error) {
        return fail(res, error.status || 500, error.status ? error.message : 'Analysis failed', error.status ? undefined : error.message);
    }
});

module.exports = router;
