require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function inspect() {
    const { data: cols, error: colError } = await supabase.rpc('get_table_columns', { table_name: 'problems' });

    // If RPC isn't available, try a direct query to information_schema (might fail with anon key)
    if (colError) {
        console.log('RPC failed, trying raw query...');
        const { data, error } = await supabase.from('problems').select('*').limit(1);
        if (error) {
            console.error('Error fetching one row:', error.message);
        } else {
            console.log('Sample row keys:', Object.keys(data[0] || {}));
        }
    } else {
        console.log('Columns:', cols);
    }

    const { data: views, error: viewError } = await supabase.from('pg_views').select('viewname').eq('schemaname', 'public');
    if (viewError) {
        console.log('Could not list views (likely RLS/Permissions)');
    } else {
        console.log('Views:', views.map(v => v.viewname));
    }
}
inspect();
