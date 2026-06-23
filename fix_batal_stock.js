
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function run() {
  console.log('Fetching BATAL sales items...');
  const { data: items, error } = await supabase
    .from('sales_items')
    .select('id, product_code, qty, unit_multiplier, order_type, sales_orders(invoice_number)')
    .eq('status', 'BATAL');

  if (error) {
    console.error('Error fetching items:', error);
    return;
  }

  console.log(`Found ${items.length} BATAL items.`);

  let fixCount = 0;

  for (const item of items) {
    // Check if mutation already exists for this item
    const { data: existingMutations } = await supabase
      .from('stock_mutations')
      .select('id')
      .eq('reference_id', item.id)
      .in('mutation_type', ['REVERT_OUT_POLOS', 'REVERT_OUT_SABLON']);
      
    if (existingMutations && existingMutations.length > 0) {
      // console.log(`Item ${item.id} already reverted.`);
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

    const { error: insertError } = await supabase.from('stock_mutations').insert(mutation);
    if (insertError) {
      console.error('Failed to insert mutation:', insertError);
    } else {
      fixCount++;
    }
  }

  console.log(`Fixed ${fixCount} items.`);
}

run();
