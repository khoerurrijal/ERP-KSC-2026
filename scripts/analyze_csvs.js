const fs = require('fs');
const readline = require('readline');
const path = require('path');

const dir = 'C:\\Users\\asus\\Documents\\KING SABLON CUP MASTER ERP\\produkmaster';

const files = [
  'matrix_sablon(matrix_sablon).csv',
  'addons(addons).csv',
  'satuan_produk(satuan_produk).csv',
  'products_rows(products_rows).csv'
];

async function analyzeCsv(filename) {
  const filePath = path.join(dir, filename);
  if (!fs.existsSync(filePath)) {
    console.log(`File not found: ${filename}`);
    return;
  }

  console.log(`\n--- Analyzing ${filename} ---`);
  
  const fileStream = fs.createReadStream(filePath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  let rowCount = 0;
  let headers = [];

  for await (const line of rl) {
    if (rowCount === 0) {
      headers = line.split(',').map(h => h.trim());
      console.log('Headers:', headers);
    } else if (rowCount <= 3) {
      const row = line.split(',').map(v => v.trim());
      console.log(`Row ${rowCount}:`, row);
    }
    rowCount++;
  }
  console.log(`Total rows (including header): ${rowCount}`);
}

async function run() {
  for (const file of files) {
    await analyzeCsv(file);
  }
}

run();
