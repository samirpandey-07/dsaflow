const express = require('express');
const { supabase } = require('../db/supabase');
const { ok, fail } = require('../lib/http');

const router = express.Router();

router.get('/topics', async (_req, res) => {
    try {
        const { data, error } = await supabase.from('topics').select('*');
        if (error) {
            throw error;
        }
        return ok(res, data || []);
    } catch (error) {
        return fail(res, error.status || 500, error.message);
    }
});

module.exports = router;
