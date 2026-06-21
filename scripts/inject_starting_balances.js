
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function run() {
  console.log('1. Menghitung saldo saat ini...');
  const { data: transactions } = await supabase.from('transactions').select('*');
  
  const summary = { gudang: 0, global: 0, tabungan: 0 };

  transactions.forEach(t => {
    const amountIn = Number(t.amount_in || 0);
    const amountOut = Number(t.amount_out || 0);
    const ws = (t.workshop_code || '').toUpperCase();

    if (ws === 'GUDANG') summary.gudang += (amountIn - amountOut);
    else if (ws === 'GLOBAL') summary.global += (amountIn - amountOut);
    else if (ws === 'TABUNGAN' || (t.description || '').toLowerCase().includes('tabungan')) summary.tabungan += (amountIn - amountOut);
  });

  const monthsInHistory = new Set(transactions.map(t => t.date?.substring(0, 7)).filter(Boolean));
  const numberOfMonthsPassed = monthsInHistory.size;
  summary.tabungan += (2000000 * numberOfMonthsPassed);

  console.log('Saldo Saat Ini di Database:');
  console.log('GUDANG  : ', summary.gudang);
  console.log('GLOBAL  : ', summary.global);
  console.log('TABUNGAN: ', summary.tabungan);

  const TARGET_GUDANG = 63666021;
  const TARGET_GLOBAL = 4701201;
  const TARGET_TABUNGAN = 11358829;

  const diffGudang = TARGET_GUDANG - summary.gudang;
  const diffGlobal = TARGET_GLOBAL - summary.global;
  const diffTabungan = TARGET_TABUNGAN - summary.tabungan;

  console.log('\n2. Menghitung selisih (Saldo Awal yang harus disuntikkan):');
  console.log('GUDANG  : ', diffGudang);
  console.log('GLOBAL  : ', diffGlobal);
  console.log('TABUNGAN: ', diffTabungan);

  // Buat transaksi suntikan
  const injects = [];
  const injectDate = '2024-12-31'; // Taruh di masa lalu sebelum transaksi pertama

  if (diffGudang !== 0) {
    injects.push({
      date: injectDate,
      reference: 'SALDO_AWAL',
      description: 'Saldo Awal Sistem',
      payment_method: 'Virtual',
      amount_in: diffGudang > 0 ? diffGudang : 0,
      amount_out: diffGudang < 0 ? Math.abs(diffGudang) : 0,
      workshop_code: 'GUDANG'
    });
  }

  if (diffGlobal !== 0) {
    injects.push({
      date: injectDate,
      reference: 'SALDO_AWAL',
      description: 'Saldo Awal Sistem',
      payment_method: 'Virtual',
      amount_in: diffGlobal > 0 ? diffGlobal : 0,
      amount_out: diffGlobal < 0 ? Math.abs(diffGlobal) : 0,
      workshop_code: 'GLOBAL'
    });
  }

  if (diffTabungan !== 0) {
    injects.push({
      date: injectDate,
      reference: 'SALDO_AWAL',
      description: 'Saldo Awal Sistem',
      payment_method: 'Virtual',
      amount_in: diffTabungan > 0 ? diffTabungan : 0,
      amount_out: diffTabungan < 0 ? Math.abs(diffTabungan) : 0,
      workshop_code: 'TABUNGAN'
    });
  }

  if (injects.length > 0) {
    console.log('\n3. Mengeksekusi suntikan ke database...');
    const { error } = await supabase.from('transactions').insert(injects);
    if (error) {
      console.error('Gagal menyuntikkan saldo awal:', error);
    } else {
      console.log('Berhasil menyuntikkan saldo awal!');
    }
  } else {
    console.log('Saldo sudah balance, tidak perlu suntikan.');
  }
}
run();
