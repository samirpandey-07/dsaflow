require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase credentials missing! Please check your .env file.');
}

// Global anonymous client (for checking auth tokens, fetching public data)
const supabase = createClient(supabaseUrl, supabaseKey);

// 🔐 NEW: Request-scoped authenticated client for RLS
const createAuthClient = (token) => {
    return createClient(supabaseUrl, supabaseKey, {
        global: {
            headers: {
                Authorization: `Bearer ${token}`
            }
        }
    });
};

module.exports = { supabase, createAuthClient, isMock: false };
