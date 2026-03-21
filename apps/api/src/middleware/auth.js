const { supabase, createAuthClient } = require('../db/supabase');
const { fail } = require('../lib/http');

async function verifyAuth(req, res, next) {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
            return fail(res, 401, 'Unauthorized');
        }

        const { data: { user }, error } = await supabase.auth.getUser(token);
        if (error || !user) {
            return fail(res, 401, 'Unauthorized', error?.message);
        }

        req.user = user;
        req.supabase = createAuthClient(token);
        return next();
    } catch (error) {
        return fail(res, 401, 'Unauthorized', error.message);
    }
}

module.exports = { verifyAuth };
