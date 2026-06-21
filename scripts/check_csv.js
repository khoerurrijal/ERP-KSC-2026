require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function run() {
  const content = fs.readFileSync('transactions_rows.csv', 'utf-8');
  const lines = content.split('\n');
  const headers = lines[0].split(',').map(h => h.trim());
  
  const soIdIndex = headers.indexOf('so_id');
  if (soIdIndex === -1) {
    console.log('Error: Column so_id not found in CSV.');
    return;
  }

  const invoicesInCsv = new Set();
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    // Basic CSV splitting (this might fail if there are commas inside quotes, but we'll try)
    const row = line.split(','); 
    let so_id_val = row[soIdIndex]?.trim();
    if (so_id_val && so_id_val.startsWith('INV-')) {
      invoicesInCsv.add(so_id_val);
    }
  }

  console.log(`Found ${invoicesInCsv.size} unique INV-xxxx codes in the CSV.`);

  // Query DB
  const { data: orders } = await supabase.from('sales_orders').select('id, invoice_number');
  const dbInvoices = {};
  for (const o of orders) {
    dbInvoices[o.invoice_number] = o.id;
  }

  let matchCount = 0;
  let missingInDb = [];

  for (const inv of invoicesInCsv) {
    if (dbInvoices[inv]) {
      matchCount++;
    } else {
      missingInDb.push(inv);
    }
  }

  console.log(`Matched ${matchCount} invoices with the database.`);
  if (missingInDb.length > 0) {
    console.log(`Missing ${missingInDb.length} invoices in DB (e.g., ${missingInDb.slice(0,5).join(', ')}).`);
  } else {
    console.log('All invoices from CSV exist in the DB!');
  }
}

run();
