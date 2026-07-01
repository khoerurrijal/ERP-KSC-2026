const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const sql = `
    CREATE TABLE IF NOT EXISTS wa_global_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
    ALTER TABLE wa_global_settings DISABLE ROW LEVEL SECURITY;
    INSERT INTO wa_global_settings (key, value) VALUES ('GLOBAL_BOT_ACTIVE', 'false')
    ON CONFLICT (key) DO UPDATE SET value = 'false';
  `;
  const { data, error } = await supabase.rpc('exec_sql', { sql });
  console.log('Result:', data, error);
}

run();
