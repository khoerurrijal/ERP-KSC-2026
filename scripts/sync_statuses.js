require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function run() {
  const { data: items } = await supabase.from('sales_items').select('id').neq('status', 'SELESAI');
  console.log(`Found ${items.length} active items to re-sync`);

  // Instead of rewriting the complex logic, we can just fetch the logic from actions.js.
  // Wait, we can't easily require actions.js in node without babel/next.
  // Let's just reset everything that is "SIAP PROSES" back to "BARU MASUK", and "PROSES" back to "SIAP PROSES" ONLY IF they have NO production logs and they don't meet the rules.
  // Actually, to make it 100% safe, let's just reset everything to BARU MASUK (if they have no logs), and the user can just resave the SO to trigger the server action. 
  // No, better yet: let's fetch all items and re-apply the logic right here in node!
  
  for (const item of items) {
    const { data: fullItem } = await supabase.from('sales_items').select('*, sales_orders(payment_status, status, marketplace_receipt, customers(name))').eq('id', item.id).single();
    if (!fullItem || !fullItem.sales_orders) continue;

    const so = fullItem.sales_orders;
    const isLunas = so.payment_status === 'LUNAS';
    const isPaid = so.payment_status === 'LUNAS' || so.payment_status === 'DP';
    
    const customerName = so.customers?.name?.toLowerCase() || '';
    const isMarketplace = (so.marketplace_receipt && so.marketplace_receipt.trim() !== '') || 
                          customerName.includes('shopee') || 
                          customerName.includes('tokopedia') || 
                          customerName.includes('tiktok') || 
                          customerName.includes('lazada');
                          
    const canProceed = isPaid || isMarketplace;
    const { data: logs } = await supabase.from('production_logs').select('qty_processed').eq('job_id', fullItem.id);
    const qtyProcessed = (logs || []).reduce((sum, log) => sum + (log.qty_processed || 0), 0);
    
    const targetQty = fullItem.qty * (fullItem.unit_multiplier || 1);
    
    let newStatus = fullItem.status || 'BARU MASUK';
    const oldStatus = newStatus;

    if (fullItem.order_type?.toUpperCase() === 'POLOS') {
      if (!canProceed) newStatus = 'BARU MASUK';
      else if (newStatus !== 'DIKIRIM' && newStatus !== 'SUDAH DIAMBIL' && newStatus !== 'SELESAI') newStatus = 'SIAP KIRIM';
    } else {
      if (qtyProcessed > 0 && qtyProcessed < targetQty) newStatus = 'PROSES';
      if (qtyProcessed >= targetQty) {
        if (newStatus !== 'DIKIRIM' && newStatus !== 'SUDAH DIAMBIL' && newStatus !== 'SELESAI') newStatus = 'SIAP KIRIM';
      } else if (qtyProcessed === 0) {
        const hasNoLogs = !logs || logs.length === 0;
        const isOldDataFinished = hasNoLogs && ['SUDAH JADI', 'SIAP KIRIM', 'DIKIRIM', 'SUDAH DIAMBIL', 'SELESAI'].includes(oldStatus);
        if (!isOldDataFinished) {
          if (!canProceed) newStatus = 'BARU MASUK';
          else newStatus = 'SIAP PROSES';
        }
      }
    }

    if ((newStatus === 'DIKIRIM' || newStatus === 'SUDAH DIAMBIL') && isLunas) newStatus = 'SELESAI';

    if (newStatus !== oldStatus) {
      console.log(`Updating item ${fullItem.id} from ${oldStatus} to ${newStatus}`);
      await supabase.from('sales_items').update({ status: newStatus }).eq('id', fullItem.id);
    }
  }
  console.log('Done!');
}
run();
