require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

// To test this we will just fetch all users from auth table using service key, 
// then create a mock auth client for that user and fetch problems to test RLS.
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || supabaseKey;
const adminClient = createClient(supabaseUrl, serviceKey);

async function testRLS() {
    // 1. Get first user in DB
    const { data: problems, error: pErr } = await adminClient.from('problems').select('user_id').limit(1);

    let userId = null;
    if (problems && problems.length > 0) {
        userId = problems[0].user_id;
        console.log("Found problem owned by:", userId);
    } else {
        const { data: users } = await adminClient.auth.admin.listUsers({ perPage: 1 });
        if (users?.users?.length > 0) {
            userId = users.users[0].id;
            console.log("Using first auth user:", userId);
        }
    }

    if (!userId) {
        console.log("No valid user found to test RLS.");
        return;
    }

    console.log("--- Testing user_difficulty_stats view ---");
    const { data: stats, error: sErr } = await adminClient.from('user_difficulty_stats').select('*');
    if (sErr) console.error("Stats Error:", sErr);
    else console.log("Stats Data (Admin view):", JSON.stringify(stats, null, 2));

    console.log("--- Testing user_velocity view ---");
    const { data: vel, error: vErr } = await adminClient.from('user_velocity').select('*');
    if (vErr) console.error("Velocity Error:", vErr);
    else console.log("Velocity Data (Admin view):", JSON.stringify(vel, null, 2));

    console.log("--- Testing direct problems table ---");
    const { data: allProbs, error: allErr } = await adminClient.from('problems').select('*');
    if (allErr) console.error("Problems Error:", allErr);
    else console.log(`Total Problems in DB: ${allProbs?.length}`);
}

testRLS();
