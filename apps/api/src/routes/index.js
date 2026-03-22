const express = require('express');
const problemRoutes = require('./problems.routes');
const analyticsRoutes = require('./analytics.routes');
const revisionRoutes = require('./revisions.routes');
const noteRoutes = require('./notes.routes');
const achievementRoutes = require('./achievements.routes');
const topicRoutes = require('./topics.routes');
const emailRoutes = require('./email.routes');
const metadataRoutes = require('./metadata.routes');
const goalRoutes = require('./goals.routes');
const publicRoutes = require('./public.routes');
const importRoutes = require('./imports.routes');

const router = express.Router();

router.use(problemRoutes);
router.use(analyticsRoutes);
router.use(revisionRoutes);
router.use(noteRoutes);
router.use(achievementRoutes);
router.use(topicRoutes);
router.use(emailRoutes);
router.use(metadataRoutes);
router.use(goalRoutes);
router.use(publicRoutes);
router.use(importRoutes);

router.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
});

router.get('/healthz', (_req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
    });
});

module.exports = router;
