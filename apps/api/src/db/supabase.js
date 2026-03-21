require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase credentials missing! Please check your .env file.');
}

function createBaseClient(key, extraOptions = {}) {
    return createClient(supabaseUrl, key, {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
        },
        ...extraOptions,
    });
}

const supabase = createBaseClient(supabaseAnonKey);

const serviceSupabase = supabaseServiceRoleKey
    ? createBaseClient(supabaseServiceRoleKey)
    : null;

function createAuthClient(token) {
    return createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
        },
        global: {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        },
    });
}

function getServiceClient() {
    return serviceSupabase;
}

module.exports = {
    supabase,
    createAuthClient,
    getServiceClient,
};
