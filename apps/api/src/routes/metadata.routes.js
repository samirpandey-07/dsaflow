const express = require('express');
const { verifyAuth } = require('../middleware/auth');
const { ok, fail } = require('../lib/http');
const { resolveProblemMetadata } = require('../services/metadata.service');

const router = express.Router();

router.post('/metadata/resolve', verifyAuth, async (req, res) => {
    try {
        const data = await resolveProblemMetadata({
            url: req.body?.url || '',
            fileName: req.body?.file_name || '',
            topicHint: req.body?.topic_hint || '',
            pathHint: req.body?.path_hint || '',
            difficultyHint: req.body?.difficulty_hint || '',
            tagsHint: Array.isArray(req.body?.tags_hint) ? req.body.tags_hint : [],
        });

        return ok(res, data);
    } catch (error) {
        return fail(res, error.status || 500, error.message);
    }
});

module.exports = router;
