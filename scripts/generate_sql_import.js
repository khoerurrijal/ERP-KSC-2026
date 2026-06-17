const fs = require('fs');
const readline = require('readline');
const path = require('path');

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
    if (line.trim() === '') continue;

    // Proper CSV line parser handling quotes
    const values = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') {
        if (inQuotes && line[i+1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (c === ',' && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += c;
      }
    }
    values.push(current.trim());

    if (rowCount === 0) {
      headers = values;
    } else {
      if (values.join('').length > 0) {
        const obj = {};
        headers.forEach((h, i) => obj[h] = values[i] || '');
        rows.push(obj);
      }
    }
    rowCount++;
  }
  return rows;
}

function escapeSql(str) {
  if (str === null || str === undefined || str === '') return 'NULL';
  return "'" + str.replace(/'/g, "''") + "'";
}

async function run() {
  let sql = `-- AUTO GENERATED SYNC SCRIPT\n\n`;

  // 1. Matrix Sablon
  const matrix = await parseCsv('matrix_sablon(matrix_sablon).csv');
  if (matrix) {
    sql += `-- Matrix Sablon\n`;
    sql += `TRUNCATE TABLE sablon_matrix;\n`;
    for (const r of matrix) {
      const c = escapeSql(r.category);
      const m1 = parseFloat(r.min_1) || 0;
      const m10 = parseFloat(r.min_10) || 0;
      const m100 = parseFloat(r.min_100) || 0;
      const m500 = parseFloat(r.min_500) || 0;
      const m1000 = parseFloat(r.min_1000) || 0;
      const m5000 = parseFloat(r.min_5000) || 0;
      const m10000 = parseFloat(r.min_10000) || 0;
      sql += `INSERT INTO sablon_matrix (category, min_1, min_10, min_100, min_500, min_1000, min_5000, min_10000, status) VALUES (${c}, ${m1}, ${m10}, ${m100}, ${m500}, ${m1000}, ${m5000}, ${m10000}, 'AKTIF');\n`;
    }
    sql += `\n`;
  }

  // 2. Addons
  const addons = await parseCsv('addons(addons).csv');
  if (addons) {
    sql += `-- Addons\n`;
    let counter = 1;
    for (const r of addons) {
      let code = r.addon_code;
      if (!code) {
        code = `ADD-${String(counter).padStart(3, '0')}`;
        counter++;
      }
      const price = parseFloat(r.harga_satuan) || 0;
      sql += `INSERT INTO products (product_code, name, category, workshop_code, hpp_murni, base_price, price_polos, unit) VALUES (${escapeSql(code)}, ${escapeSql(r.addon_name)}, 'ADDON', 'GLOBAL', 0, ${price}, ${price}, 'PCS') ON CONFLICT (product_code) DO UPDATE SET name = EXCLUDED.name, base_price = EXCLUDED.base_price, price_polos = EXCLUDED.price_polos;\n`;
    }
    sql += `\n`;
  }

  // 3. Products Rows
  const prods = await parseCsv('products_rows(products_rows).csv');
  if (prods) {
    sql += `-- Products Update\n`;
    for (const r of prods) {
      if (!r.product_code) continue;
      const hpp = parseFloat(r.HPP_murni) || 0;
      let ws = (r.workshop_code || '').trim().toUpperCase();
      let markup = 0;
      if (ws === 'GUDANG') markup = 0.05;
      else if (ws === 'GLOBAL') markup = 0.10;
      
      const wsSql = ws === '' ? 'NULL' : escapeSql(ws);
      const basePrice = Math.round(hpp + (hpp * markup));
      const pricePolos = Math.round(basePrice * 1.15);
      
      sql += `UPDATE products SET category = ${escapeSql(r.category || 'LAIN-LAIN')}, workshop_code = ${wsSql}, hpp_murni = ${hpp}, base_price = ${basePrice}, price_polos = ${pricePolos} WHERE product_code = ${escapeSql(r.product_code)};\n`;
    }
    sql += `\n`;
  }

  // 4. Satuan Produk
  const satuan = await parseCsv('satuan_produk(satuan_produk).csv');
  if (satuan) {
    sql += `-- Satuan Produk\n`;
    const codes = [...new Set(satuan.map(s => escapeSql(s.product_code)))];
    if (codes.length > 0) {
      sql += `DELETE FROM product_units WHERE product_code IN (${codes.join(',')});\n`;
      for (const r of satuan) {
        if (!r.product_code) continue;
        const mult = parseFloat(r.multiplier) || 1;
        sql += `INSERT INTO product_units (product_code, unit_name, multiplier) VALUES (${escapeSql(r.product_code)}, ${escapeSql(r.product_name || 'PACK')}, ${mult});\n`;
      }
    }
  }

  fs.writeFileSync('C:\\Users\\asus\\Documents\\KING SABLON CUP MASTER ERP\\database\\30_import_data.sql', sql);
  console.log('SQL File generated at database/30_import_data.sql');
}

run();
