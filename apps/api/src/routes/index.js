const express = require('express');
const problemRoutes = require('./problems.routes');
const analyticsRoutes = require('./analytics.routes');
const revisionRoutes = require('./revisions.routes');
const noteRoutes = require('./notes.routes');
const achievementRoutes = require('./achievements.routes');
const topicRoutes = require('./topics.routes');
const emailRoutes = require('./email.routes');

const router = express.Router();

router.use(problemRoutes);
router.use(analyticsRoutes);
router.use(revisionRoutes);
router.use(noteRoutes);
router.use(achievementRoutes);
router.use(topicRoutes);
router.use(emailRoutes);

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
