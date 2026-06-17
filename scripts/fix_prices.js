require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function run() {
  const { data: products } = await supabase.from('products').select('*');
  let count = 0;

  for (const p of products) {
    if (p.hpp_murni > 0 && p.price_polos === 0) {
      const workshop = (p.workshop_code || '').toUpperCase();
      const multiplier = workshop === 'GLOBAL' ? 1.10 : 1.05;
      const basePrice = p.hpp_murni * multiplier;
      const pricePolos = basePrice * 1.15;

      await supabase.from('products').update({
        base_price: basePrice,
        price_polos: pricePolos
      }).eq('product_code', p.product_code);
      count++;
    }
  }
  console.log(`Updated ${count} empty prices.`);
}

run();
