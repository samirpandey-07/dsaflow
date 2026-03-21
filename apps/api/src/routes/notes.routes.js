const express = require('express');
const { z } = require('zod');
const { verifyAuth } = require('../middleware/auth');
const { ok, fail } = require('../lib/http');
const { noteSchema } = require('../validation/schemas');
const noteService = require('../services/note.service');

const router = express.Router();

router.post('/notes', verifyAuth, async (req, res) => {
    try {
        console.log(`[API] POST /notes - User: ${req.user.id}, Problem: ${req.body.problem_id}`);
        const validatedData = noteSchema.parse(req.body);
        const data = await noteService.createNote(req.supabase, req.user.id, validatedData.problem_id, validatedData.note);
        return ok(res, data, 201);
    } catch (error) {
        console.error(`[API Error] POST /notes:`, {
            message: error.message,
            stack: error.stack,
            status: error.status,
            ...error
        });
        if (error instanceof z.ZodError) {
            return fail(res, 400, 'Validation failed', error.issues);
        }
        return fail(res, error.status || 500, error.message || 'Internal Server Error');
    }
});

router.get('/problems/:id/notes', verifyAuth, async (req, res) => {
    try {
        console.log(`[API] GET /problems/${req.params.id}/notes - User: ${req.user.id}`);
        const data = await noteService.listNotes(req.supabase, req.user.id, req.params.id);
        return ok(res, data);
    } catch (error) {
        console.error(`[API Error] GET /problems/${req.params.id}/notes:`, {
            message: error.message,
            stack: error.stack,
            status: error.status,
            ...error
        });
        return fail(res, error.status || 500, error.message || 'Internal Server Error');
    }
});

module.exports = router;
