require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const readline = require('readline');
const path = require('path');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const dir = 'C:\\Users\\asus\\Documents\\KING SABLON CUP MASTER ERP\\produkmaster';

async function parseCsv(filename) {
  const filePath = path.join(dir, filename);
  if (!fs.existsSync(filePath)) return null;

  const fileStream = fs.createReadStream(filePath);
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

  let rowCount = 0;
  let headers = [];
  const rows = [];

  for await (const line of rl) {
    if (rowCount === 0) {
      headers = line.split(',').map(h => h.trim());
    } else {
      const values = line.split(',').map(v => v.trim());
      if (values.join('').length > 0) { // skip empty lines
        const obj = {};
        headers.forEach((h, i) => obj[h] = values[i] || '');
        rows.push(obj);
      }
    }
    rowCount++;
  }
  return rows;
}

async function syncMatrix() {
  console.log('Syncing Sablon Matrix...');
  const rows = await parseCsv('matrix_sablon(matrix_sablon).csv');
  if (!rows) return;

  const records = rows.map(r => ({
    category: r.category,
    min_1: parseFloat(r.min_1) || 0,
    min_10: parseFloat(r.min_10) || 0,
    min_100: parseFloat(r.min_100) || 0,
    min_500: parseFloat(r.min_500) || 0,
    min_1000: parseFloat(r.min_1000) || 0,
    min_5000: parseFloat(r.min_5000) || 0,
    min_10000: parseFloat(r.min_10000) || 0,
    status: 'AKTIF'
  }));

  const { error } = await supabase.from('sablon_matrix').upsert(records, { onConflict: 'category' });
  if (error) console.error('Error matrix:', error.message);
  else console.log(`Matrix Sablon synced: ${records.length} records.`);
}

async function syncAddons() {
  console.log('Syncing Addons...');
  const rows = await parseCsv('addons(addons).csv');
  if (!rows) return;

  let counter = 1;
  const records = rows.map(r => {
    let code = r.addon_code;
    if (!code) {
      code = `ADD-${String(counter).padStart(3, '0')}`;
      counter++;
    }
    return {
      product_code: code,
      name: r.addon_name,
      category: 'ADDON',
      workshop_code: 'GLOBAL', // default
      hpp_murni: 0,
      base_price: parseFloat(r.harga_satuan) || 0, // Since it's direct price
      price_polos: parseFloat(r.harga_satuan) || 0,
      unit: 'PCS'
    };
  });

  const { error } = await supabase.from('products').upsert(records, { onConflict: 'product_code' });
  if (error) console.error('Error addons:', error.message);
  else console.log(`Addons synced: ${records.length} records.`);
}

async function syncProductRows() {
  console.log('Syncing Product Rows...');
  const rows = await parseCsv('products_rows(products_rows).csv');
  if (!rows) return;

  let successCount = 0;
  for (const r of rows) {
    if (!r.product_code) continue;

    const hpp = parseFloat(r.HPP_murni) || 0;
    const ws = (r.workshop_code || '').toUpperCase();
    
    let markup = 0;
    if (ws === 'GUDANG') markup = 0.05;
    else if (ws === 'GLOBAL') markup = 0.10;

    const basePrice = Math.round(hpp + (hpp * markup));
    const pricePolos = Math.round(basePrice * 1.15);

    const { error } = await supabase
      .from('products')
      .update({
        category: r.category || 'LAIN-LAIN',
        workshop_code: ws,
        hpp_murni: hpp,
        base_price: basePrice,
        price_polos: pricePolos
      })
      .eq('product_code', r.product_code);

    if (error) console.error(`Error updating ${r.product_code}:`, error.message);
    else successCount++;
  }
  console.log(`Product Rows synced: ${successCount} updated.`);
}

async function syncSatuan() {
  console.log('Syncing Satuan Produk...');
  const rows = await parseCsv('satuan_produk(satuan_produk).csv');
  if (!rows) return;

  const records = rows.map(r => ({
    product_code: r.product_code,
    unit_name: r.product_name || 'PACK',
    multiplier: parseFloat(r.multiplier) || 1
  })).filter(r => r.product_code);

  if (records.length === 0) return;

  // Clear existing satuan for these products to avoid duplicates
  const productCodes = [...new Set(records.map(r => r.product_code))];
  
  // We have to delete in chunks if there are too many
  const chunkSize = 100;
  for (let i = 0; i < productCodes.length; i += chunkSize) {
    const chunk = productCodes.slice(i, i + chunkSize);
    await supabase.from('product_units').delete().in('product_code', chunk);
  }

  const { error } = await supabase.from('product_units').insert(records);
  if (error) console.error('Error satuan:', error.message);
  else console.log(`Satuan Produk synced: ${records.length} records.`);
}

async function runAll() {
  await syncMatrix();
  await syncProductRows();
  await syncAddons();
  await syncSatuan();
  console.log('Done.');
}

runAll();
