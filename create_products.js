const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

async function run() {
  const products = [
    { product_code: 'SRV-FAST-TRACK', name: 'Biaya Layanan Fast Track', category: 'JASA', unit: 'Layanan', base_price: 100000, price_polos: 100000, is_active: true },
    { product_code: 'SRV-2-WARNA', name: 'Jasa Sablon 2 Warna', category: 'JASA', unit: 'Pcs', base_price: 250, price_polos: 250, is_active: true }
  ];

  const res = await fetch(`${url}/rest/v1/products`, {
    method: 'POST',
    headers: {
      'apikey': key,
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json',
      'Prefer': 'resolution=merge-duplicates'
    },
    body: JSON.stringify(products)
  });

  if (res.ok) {
    console.log("Products created!");
  } else {
    console.log("Error:", await res.text());
  }
}
run();
