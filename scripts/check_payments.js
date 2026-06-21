require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function run() {
  console.log('Fetching sales orders and transactions...');
  const { data: orders } = await supabase.from('sales_orders').select('id, invoice_number, total_amount, dp_amount, payment_status');
  const { data: txs } = await supabase.from('transactions').select('so_id, amount_in').eq('reference', 'PENJUALAN').not('so_id', 'is', null);

  const txSumBySo = {};
  for (const tx of txs) {
    if (!txSumBySo[tx.so_id]) txSumBySo[tx.so_id] = 0;
    txSumBySo[tx.so_id] += Number(tx.amount_in || 0);
  }

  let updated = 0;

  for (const order of orders) {
    const actualPaid = txSumBySo[order.id] || 0;
    const currentPaid = Number(order.dp_amount || 0);
    const total = Number(order.total_amount || 0);
    
    // Determine correct status
    let correctStatus = 'BELUM LUNAS';
    if (actualPaid >= total && total > 0) correctStatus = 'LUNAS';
    else if (actualPaid > 0) correctStatus = 'DP';
    else if (actualPaid === 0 && currentPaid > 0) {
      // In case they didn't use transactions but entered dp_amount directly?
      // Let's trust currentPaid if actualPaid is 0 but currentPaid > 0
      if (currentPaid >= total) correctStatus = 'LUNAS';
      else correctStatus = 'DP';
    }

    const finalPaid = Math.max(actualPaid, currentPaid);

    if (finalPaid !== currentPaid || correctStatus !== order.payment_status) {
      console.log(`Mismatch on ${order.invoice_number}: DB dp_amount=${currentPaid}, DB status=${order.payment_status}. Correct Paid=${finalPaid}, Correct Status=${correctStatus}`);
      await supabase.from('sales_orders').update({
        dp_amount: finalPaid,
        payment_status: correctStatus
      }).eq('id', order.id);
      updated++;
    }
  }

  console.log(`Synced ${updated} sales orders based on transactions & dp_amount rules.`);
}

run();
