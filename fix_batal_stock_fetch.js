
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

async function run() {
  console.log('Fetching BATAL sales items...');
  const itemsRes = await fetch(`${url}/rest/v1/sales_items?status=eq.BATAL&select=id,product_code,qty,unit_multiplier,order_type,sales_orders(invoice_number)`, {
    headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
  });
  const items = await itemsRes.json();

  if (!Array.isArray(items)) {
    console.error('Error fetching items:', items);
    return;
  }

  console.log(`Found ${items.length} BATAL items.`);

  let fixCount = 0;

  for (const item of items) {
    // Check if mutation already exists for this item
    const mutRes = await fetch(`${url}/rest/v1/stock_mutations?reference_id=eq.${item.id}&mutation_type=in.(REVERT_OUT_POLOS,REVERT_OUT_SABLON)&select=id`, {
      headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
    });
    const existingMutations = await mutRes.json();
      
    if (existingMutations && existingMutations.length > 0) {
      console.log(`Skipping item ${item.id}, already has revert mutations:`, existingMutations);
      continue;
    }

    const isPolos = !item.order_type || item.order_type.toUpperCase() === 'POLOS' || !['SABLON', 'PRINTING'].includes(item.order_type.toUpperCase());
    const actualQty = Number(item.qty) * Number(item.unit_multiplier || 1);
    
    console.log(`Reverting ${actualQty} pcs for item ${item.id} (${item.product_code})`);

    const mutation = {
      product_code: item.product_code,
      mutation_type: isPolos ? 'REVERT_OUT_POLOS' : 'REVERT_OUT_SABLON',
      reference_id: item.id,
      reference_number: item.sales_orders?.invoice_number || 'N/A',
      qty_tersedia_change: actualQty,
      qty_fisik_change: isPolos ? actualQty : 0,
      notes: `Fix Pembatalan Lama: ${item.sales_orders?.invoice_number}`
    };

    const insertRes = await fetch(`${url}/rest/v1/stock_mutations`, {
      method: 'POST',
      headers: { 'apikey': key, 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json', 'Prefer': 'return=representation' },
      body: JSON.stringify(mutation)
    });

    if (!insertRes.ok) {
      console.error('Failed to insert mutation:', await insertRes.text());
    } else {
      fixCount++;
    }
  }

  console.log(`Fixed ${fixCount} items.`);
}

run();
