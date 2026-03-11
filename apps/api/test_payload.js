require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function testFetch() {
    // 1. Log in with the user's known account via Auth API to get a real JWT
    // Since we don't have their password here, we will just use the Supabase Service
    // role to bypass and print out the RAW DATABASE rows instead of hitting the API,
    // to see if the database actually has data for them right now.

    const adminClient = createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY || supabaseKey);
    const { data: users } = await adminClient.auth.admin.listUsers();

    if (!users || users.users.length === 0) {
        console.log("No authenticated users found in Supabase Auth.");
        return;
    }

    const userId = users.users[0].id;
    console.log("Checking DB directly for User ID:", userId);

    // Get problems
    const { data: problems } = await adminClient.from('problems').select('*').eq('user_id', userId);
    console.log(`User has ${problems?.length || 0} problems.`);

    // Get stats
    const { data: stats } = await adminClient.from('user_difficulty_stats').select('*').eq('user_id', userId);
    console.log(`User difficulty stats:`, stats);
}

testFetch();
