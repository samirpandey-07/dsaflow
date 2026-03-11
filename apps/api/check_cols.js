require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY || supabaseKey);

async function checkCols() {
    const { data, error } = await supabase.rpc('get_table_columns', { table_name: 'problems' });
    if (error) {
        console.error('Error fetching columns via RPC:', error.message);
        // Fallback
        const { data: cols } = await supabase.from('problems').select('*').limit(1);
        console.log('Columns present:', Object.keys(cols[0] || {}));
    } else {
        console.log('Columns:', data);
    }
}
checkCols();
