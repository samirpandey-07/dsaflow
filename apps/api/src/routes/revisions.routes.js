const express = require('express');
const { verifyAuth } = require('../middleware/auth');
const { ok, fail } = require('../lib/http');
const { parsePositiveInt } = require('../lib/parsing');
const revisionService = require('../services/revision.service');

const router = express.Router();

router.post('/problems/:id/revise', verifyAuth, async (req, res) => {
    try {
        const action = req.body?.action || 'complete';
        const days = parsePositiveInt(req.body?.days, 2);
        const data = await revisionService.reviseProblem(req.supabase, req.user.id, req.params.id, action, days);
        return ok(res, data);
    } catch (error) {
        return fail(res, error.status || 500, error.message);
    }
});

router.get('/revision-queue', verifyAuth, async (req, res) => {
    try {
        const data = await revisionService.getRevisionQueue(req.supabase, req.user.id);
        return ok(res, data);
    } catch (error) {
        return fail(res, error.status || 500, error.message);
    }
});

module.exports = router;
