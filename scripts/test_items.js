require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function checkData() {
  const { data, error } = await supabase
    .from('sales_items')
    .select(`
      id,
      sales_orders!inner(invoice_number, date, payment_status, customers(name)),
      products(name)
    `)
    .order('created_at', { ascending: false })
    .limit(5);
    
  console.log('Error:', error);
  console.log('Data count:', data?.length);
  if (data?.length) {
    console.log('First item:', JSON.stringify(data[0], null, 2));
  }
}

checkData();
