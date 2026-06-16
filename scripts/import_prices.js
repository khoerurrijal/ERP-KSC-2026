require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const csvPath = 'products rows(Sheet1).csv';
const csvData = fs.readFileSync(csvPath, 'utf-8');

const lines = csvData.split('\n');
const headers = lines[0].split(',');

async function run() {
  let successCount = 0;
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    // basic CSV split considering potential quotes (though simple split works for this file structure)
    const cols = line.split(',');
    
    const product_code = cols[0];
    if (!product_code) continue;

    const hpp_murni = cols[4] ? parseFloat(cols[4]) : 0;
    const price_polos = cols[5] ? parseFloat(cols[5]) : 0;
    const price_polos_pack_roll = cols[6] ? parseFloat(cols[6]) : 0;

    // We don't overwrite workshop_code if it exists, or maybe we do? Let's just update the prices.
    const { error } = await supabase
      .from('products')
      .update({
        hpp_murni: isNaN(hpp_murni) ? 0 : hpp_murni,
        price_polos: isNaN(price_polos) ? 0 : price_polos,
        price_polos_pack_roll: isNaN(price_polos_pack_roll) ? 0 : price_polos_pack_roll
      })
      .eq('product_code', product_code);

    if (error) {
      console.error(`Error updating ${product_code}:`, error.message);
    } else {
      successCount++;
      console.log(`Updated ${product_code} -> HPP: ${hpp_murni}, Price: ${price_polos}`);
    }
  }
  
  console.log(`Done! Successfully updated ${successCount} products.`);
}

run();
