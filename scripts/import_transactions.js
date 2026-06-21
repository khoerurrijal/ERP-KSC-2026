const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

// Fungsi sederhana untuk parse CSV yang mendukung double quotes
function parseCSV(text) {
  let p = '', row = [''], ret = [row], i = 0, r = 0, s = !0, l;
  for (l of text) {
    if ('"' === l) {
      if (s && l === p) row[i] += l;
      s = !s;
    } else if (',' === l && s) l = row[++i] = '';
    else if ('\n' === l && s) {
      if ('\r' === p) row[i] = row[i].slice(0, -1);
      row = ret[++r] = [l = '']; i = 0;
    } else row[i] += l;
    p = l;
  }
  return ret;
}

async function run() {
  console.log('1. Memulai proses import...');
  
  // Baca CSV
  const csvText = fs.readFileSync('file csv baru/transactions(trx).csv', 'utf-8');
  const rows = parseCSV(csvText);
  const dataRows = rows.slice(1).filter(r => r.length > 1 && r[0].trim() !== '');

  console.log(`Ditemukan ${dataRows.length} baris transaksi di CSV.`);

  // Ambil mapping invoice_number -> UUID
  console.log('2. Mengambil referensi Sales Orders dari database...');
  const { data: salesOrders, error: soError } = await supabase.from('sales_orders').select('id, invoice_number');
  if (soError) {
    console.error('Gagal ambil data SO:', soError);
    return;
  }
  const soMap = {};
  for (const so of salesOrders) {
    if (so.invoice_number) {
      soMap[so.invoice_number] = so.id;
    }
  }

  // Hapus semua transaksi lama
  console.log('3. Menghapus bersih tabel transactions lama...');
  const { error: delError } = await supabase.from('transactions').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  if (delError) {
    console.error('Gagal menghapus transaksi lama:', delError);
    return;
  }

  console.log('4. Memproses dan memasukkan data baru...');
  const batchSize = 100;
  let currentBatch = [];
  let successCount = 0;

  for (const row of dataRows) {
    const rawDate = (row[0] || '').trim();
    const reference = (row[1] || '').trim();
    const description = (row[2] || '').trim();
    const payment_method = (row[3] || '').trim();
    const amount_in = Math.abs(parseFloat(row[4]) || 0);
    const amount_out = Math.abs(parseFloat(row[5]) || 0);
    const workshop_code = (row[6] || '').trim();
    const so_id_raw = (row[7] || '').trim();

    // Format Date from M/D/YYYY to YYYY-MM-DD
    let formattedDate = rawDate;
    if (rawDate.includes('/')) {
      const parts = rawDate.split('/');
      if (parts.length === 3) {
        const month = parts[0].padStart(2, '0');
        const day = parts[1].padStart(2, '0');
        const year = parts[2];
        formattedDate = `${year}-${month}-${day}`;
      }
    }

    // Resolve SO ID
    let finalSoId = null;
    if (so_id_raw.startsWith('INV-')) {
      finalSoId = soMap[so_id_raw] || null;
    }

    currentBatch.push({
      date: formattedDate || new Date().toISOString().split('T')[0],
      reference: reference || null,
      description: description || null,
      payment_method: payment_method || null,
      amount_in: amount_in,
      amount_out: amount_out,
      workshop_code: workshop_code || 'GLOBAL',
      so_id: finalSoId
    });

    if (currentBatch.length >= batchSize) {
      const { error: insError } = await supabase.from('transactions').insert(currentBatch);
      if (insError) {
        console.error('Gagal insert batch:', insError);
      } else {
        successCount += currentBatch.length;
        process.stdout.write(`\rBerhasil insert ${successCount} baris...`);
      }
      currentBatch = [];
    }
  }

  // Insert sisa
  if (currentBatch.length > 0) {
    const { error: insError } = await supabase.from('transactions').insert(currentBatch);
    if (insError) {
      console.error('\nGagal insert batch terakhir:', insError);
    } else {
      successCount += currentBatch.length;
      process.stdout.write(`\rBerhasil insert ${successCount} baris...`);
    }
  }

  console.log(`\n\n🎉 SELESAI! Berhasil meng-import ${successCount} transaksi ke dalam database!`);
}

run();
