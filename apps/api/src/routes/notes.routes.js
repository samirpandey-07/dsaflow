const express = require('express');
const { z } = require('zod');
const { verifyAuth } = require('../middleware/auth');
const { ok, fail } = require('../lib/http');
const { noteSchema } = require('../validation/schemas');
const noteService = require('../services/note.service');

const router = express.Router();

router.post('/notes', verifyAuth, async (req, res) => {
    try {
        const validatedData = noteSchema.parse(req.body);
        const data = await noteService.createNote(req.supabase, req.user.id, validatedData.problem_id, validatedData.note);
        return ok(res, data, 201);
    } catch (error) {
        if (error instanceof z.ZodError) {
            return fail(res, 400, 'Validation failed', error.issues);
        }
        return fail(res, error.status || 500, error.message);
    }
});

router.get('/problems/:id/notes', verifyAuth, async (req, res) => {
    try {
        const data = await noteService.listNotes(req.supabase, req.user.id, req.params.id);
        return ok(res, data);
    } catch (error) {
        return fail(res, error.status || 500, error.message);
    }
});

module.exports = router;
