require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function testUpsert() {
  const { data: firstSo } = await supabase.from('sales_orders').select('id').limit(1).single();
  if (!firstSo) return console.log('No SO found');

  const { data: firstProduct } = await supabase.from('products').select('product_code').limit(1).single();

  const preparedItems = [
    {
      so_id: firstSo.id,
      order_type: 'POLOS',
      product_code: firstProduct.product_code,
      mockup_url: '',
      qty: 1000,
      unit: 'PCS',
      unit_multiplier: 1,
      unit_price: 560,
      total_price: 560000,
      hpp_price: 300,
      beli_gudang: 0,
      beli_global: 0,
      royalty_fee: 0
    }
  ];

  const { data, error } = await supabase.from('sales_items').upsert(preparedItems);
  console.log('Error:', error);
}

testUpsert();
