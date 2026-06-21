require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function run() {
  const { data: items } = await supabase.from('sales_items').select('id, status, order_type, qty, unit_multiplier, sales_orders(payment_status)');
  let updated = 0;
  for (const item of items) {
    let newStatus = item.status;
    const isPaid = item.sales_orders?.payment_status === 'LUNAS' || item.sales_orders?.payment_status === 'DP';
    
    if (item.order_type?.toUpperCase() === 'POLOS') {
      if (!isPaid) newStatus = 'BARU MASUK';
      else if (newStatus !== 'DIKIRIM' && newStatus !== 'SUDAH DIAMBIL' && newStatus !== 'SELESAI') newStatus = 'SIAP KIRIM';
    } else {
      const { data: logs } = await supabase.from('production_logs').select('qty_processed').eq('job_id', item.id);
      const qtyProcessed = (logs || []).reduce((sum, log) => sum + (log.qty_processed || 0), 0);
      const targetQty = item.qty * (item.unit_multiplier || 1);
      
      if (qtyProcessed > 0 && qtyProcessed < targetQty) newStatus = 'PROSES';
      else if (qtyProcessed >= targetQty) {
        if (newStatus !== 'DIKIRIM' && newStatus !== 'SUDAH DIAMBIL' && newStatus !== 'SELESAI') newStatus = 'SIAP KIRIM';
      } else if (qtyProcessed === 0) {
        const hasNoLogs = !logs || logs.length === 0;
        const isOldDataFinished = hasNoLogs && ['SUDAH JADI', 'SIAP KIRIM', 'DIKIRIM', 'SUDAH DIAMBIL', 'SELESAI'].includes(item.status);
        if (!isOldDataFinished) {
          if (!isPaid) newStatus = 'BARU MASUK';
          else newStatus = 'SIAP PROSES';
        }
      }
    }
    
    if (newStatus !== item.status) {
      await supabase.from('sales_items').update({ status: newStatus }).eq('id', item.id);
      updated++;
    }
  }
  console.log('Fixed', updated, 'items');
}
run();
