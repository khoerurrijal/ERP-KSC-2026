const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const tables = [
    'system_settings', 'production_logs', 'payrolls', 'payroll_items', 
    'raw_materials', 'stock_transactions', 'stock_transaction_items', 
    'production_jobs', 'marketplace_accounts', 'marketplace_orders', 
    'marketplace_order_items', 'accounts', 'cash_transactions', 'sablon_matrix'
  ];

  for (const table of tables) {
    const { error } = await supabase.rpc('exec_sql', { sql: `ALTER TABLE ${table} DISABLE ROW LEVEL SECURITY;` });
    if (error) {
      console.log(`Failed for ${table}:`, error.message);
    } else {
      console.log(`Disabled RLS on ${table}`);
    }
  }
}

run();
