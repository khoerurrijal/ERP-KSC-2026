
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function run() {
  const { data: transactions } = await supabase.from('transactions').select('*');
  
  const summary = {
    king: 0,
    gudang: 0,
    global: 0,
    tabungan: 0
  };
  
  const physical = {
    BCA: 0,
    Mandiri: 0,
    Cash: 0,
    Virtual: 0
  };

  transactions.forEach(t => {
    const amountIn = Number(t.amount_in || 0);
    const amountOut = Number(t.amount_out || 0);
    const method = (t.payment_method || '').toUpperCase();
    const ws = (t.workshop_code || '').toUpperCase();

    if (ws === 'GUDANG') summary.gudang += (amountIn - amountOut);
    else if (ws === 'GLOBAL') summary.global += (amountIn - amountOut);
    else if (ws === 'TABUNGAN' || (t.description || '').toLowerCase().includes('tabungan')) summary.tabungan += (amountIn - amountOut);
    else if (ws === 'KING') {
       // King is only for current month, but let's sum all to see total flow
       summary.king += (amountIn - amountOut);
    }

    if (method.includes('BCA')) physical.BCA += (amountIn - amountOut);
    else if (method.includes('MANDIRI')) physical.Mandiri += (amountIn - amountOut);
    else if (method.includes('CASH')) physical.Cash += (amountIn - amountOut);
    else physical.Virtual += (amountIn - amountOut);
  });

  const monthsInHistory = new Set(transactions.map(t => t.date?.substring(0, 7)).filter(Boolean));
  const numberOfMonthsPassed = monthsInHistory.size;

  summary.tabungan += (2000000 * numberOfMonthsPassed);

  console.log('--- CURRENT DATABASE BALANCES ---');
  console.log('GUDANG  : Rp ', summary.gudang.toLocaleString('id-ID'));
  console.log('GLOBAL  : Rp ', summary.global.toLocaleString('id-ID'));
  console.log('TABUNGAN: Rp ', summary.tabungan.toLocaleString('id-ID'));
  console.log('-------------------------------');
  console.log('BCA     : Rp ', physical.BCA.toLocaleString('id-ID'));
  console.log('MANDIRI : Rp ', physical.Mandiri.toLocaleString('id-ID'));
  console.log('CASH    : Rp ', physical.Cash.toLocaleString('id-ID'));
  console.log('VIRTUAL : Rp ', physical.Virtual.toLocaleString('id-ID'));
}
run();
