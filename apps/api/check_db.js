require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY || supabaseKey);

async function checkData() {
    const { data, error } = await supabase.from('problems').select('*').limit(5);
    if (error) {
        console.error('Error fetching problems:', error.message);
    } else {
        console.log(`Found ${data.length} problems in the database.`);
        if (data.length > 0) {
            console.log(data.map(p => ({ problem: p.problem_name, user_id: p.user_id })));
        } else {
            console.log("Database 'problems' table is empty!");
        }
    }
}
checkData();
