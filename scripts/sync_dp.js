require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function run() {
  const { data: orders } = await supabase.from('sales_orders').select('id, payment_status, dp_amount, total_amount, invoice_number');
  
  let updated = 0;
  for (const order of orders) {
    if (order.payment_status === 'LUNAS' && (!order.dp_amount || order.dp_amount === 0)) {
      // It is marked LUNAS but dp_amount is 0. 
      // Update dp_amount to equal total_amount.
      console.log(`Syncing ${order.invoice_number} - Total: ${order.total_amount}`);
      await supabase.from('sales_orders').update({ dp_amount: order.total_amount }).eq('id', order.id);
      updated++;
    }
  }
  
  console.log(`Fixed ${updated} sales orders where dp_amount was 0 but status was LUNAS.`);
}

run();
