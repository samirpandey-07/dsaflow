const express = require('express');
const { z } = require('zod');
const { verifyAuth } = require('../middleware/auth');
const { ok, fail } = require('../lib/http');
const { csvImportSchema, platformImportSchema } = require('../validation/schemas');
const importerService = require('../services/importer.service');

const router = express.Router();

router.get('/platform-profiles', verifyAuth, async (req, res) => {
    try {
        const data = await importerService.listConnectedProfiles(req.supabase, req.user.id);
        return ok(res, data);
    } catch (error) {
        return fail(res, error.status || 500, error.message);
    }
});

router.post('/imports/csv', verifyAuth, async (req, res) => {
    try {
        const payload = csvImportSchema.parse(req.body);
        const data = await importerService.importCsv(req.supabase, req.user.id, payload);
        return ok(res, data, 201);
    } catch (error) {
        if (error instanceof z.ZodError) {
            return fail(res, 400, 'Validation failed', error.issues);
        }
        return fail(res, error.status || 500, error.message);
    }
});

router.post('/imports/codeforces', verifyAuth, async (req, res) => {
    try {
        const payload = platformImportSchema.parse(req.body);
        const data = await importerService.importCodeforces(req.supabase, req.user.id, payload);
        return ok(res, data, 201);
    } catch (error) {
        if (error instanceof z.ZodError) {
            return fail(res, 400, 'Validation failed', error.issues);
        }
        return fail(res, error.status || 500, error.message);
    }
});

router.post('/imports/leetcode', verifyAuth, async (req, res) => {
    try {
        const payload = platformImportSchema.parse(req.body);
        const data = await importerService.importLeetCode(req.supabase, req.user.id, payload);
        return ok(res, data, 201);
    } catch (error) {
        if (error instanceof z.ZodError) {
            return fail(res, 400, 'Validation failed', error.issues);
        }
        return fail(res, error.status || 500, error.message);
    }
});

router.post('/imports/geeksforgeeks', verifyAuth, async (req, res) => {
    try {
        const payload = platformImportSchema.parse(req.body);
        const data = await importerService.importGeeksforGeeks(req.supabase, req.user.id, payload);
        return ok(res, data, 201);
    } catch (error) {
        if (error instanceof z.ZodError) {
            return fail(res, 400, 'Validation failed', error.issues);
        }
        return fail(res, error.status || 500, error.message);
    }
});

module.exports = router;
