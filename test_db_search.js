require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function run() {
  const { data, error } = await supabase
    .from('sales_orders')
    .select(`
      invoice_number, 
      customers!inner (name)
    `)
    .ilike('customers.name', '%nangkring%')
    .limit(10);
  console.log('Sample Sales Orders:', data);
  if (error) console.error('Error:', error);
}
run();
