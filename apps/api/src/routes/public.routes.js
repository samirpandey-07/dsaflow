const express = require('express');
const { z } = require('zod');
const { verifyAuth } = require('../middleware/auth');
const { ok, fail } = require('../lib/http');
const { publicProfileSchema } = require('../validation/schemas');
const publicProfileService = require('../services/public-profile.service');

const router = express.Router();

router.get('/public-profiles/me', verifyAuth, async (req, res) => {
    try {
        const data = await publicProfileService.getMyProfile(req.supabase, req.user.id, req.user);
        return ok(res, data);
    } catch (error) {
        return fail(res, error.status || 500, error.message);
    }
});

router.put('/public-profiles/me', verifyAuth, async (req, res) => {
    try {
        const payload = publicProfileSchema.parse(req.body);
        const data = await publicProfileService.updateMyProfile(req.supabase, req.user.id, req.user, payload);
        return ok(res, data);
    } catch (error) {
        if (error instanceof z.ZodError) {
            return fail(res, 400, 'Validation failed', error.issues);
        }
        return fail(res, error.status || 500, error.message);
    }
});

router.get('/public-profiles/:slug', async (req, res) => {
    try {
        const data = await publicProfileService.getPublicProfile(req.params.slug);
        return ok(res, data);
    } catch (error) {
        return fail(res, error.status || 500, error.message);
    }
});

router.get('/public-profiles/:slug/badge.svg', async (req, res) => {
    try {
        const data = await publicProfileService.getPublicProfile(req.params.slug);
        const svg = publicProfileService.renderBadgeSvg(data);
        res.setHeader('Content-Type', 'image/svg+xml');
        res.setHeader('Cache-Control', 'public, max-age=300');
        return res.status(200).send(svg);
    } catch (error) {
        return fail(res, error.status || 500, error.message);
    }
});

module.exports = router;
