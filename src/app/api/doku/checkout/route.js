import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createDokuCheckoutUrl } from '@/utils/doku';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
// Use service role key if available for updates, otherwise anon key if RLS allows it.
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

export async function POST(req) {
  try {
    const { orderId, amount } = await req.json();

    if (!orderId) {
      return NextResponse.json({ success: false, error: 'Order ID is required' }, { status: 400 });
    }

    // Fetch order from database
    const { data: order, error: fetchError } = await supabase
      .from('sales_orders')
      .select('*, customers:customer_code(name, phone)')
      .eq('id', orderId)
      .single();

    if (fetchError || !order) {
      return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 });
    }

    // Generate DOKU Checkout URL
    const dokuData = await createDokuCheckoutUrl(order, amount);

    // Save DOKU data to sales_orders
    const { error: updateError } = await supabase
      .from('sales_orders')
      .update({
        payment_url: dokuData.checkout_url,
        doku_invoice_id: dokuData.invoice_id
      })
      .eq('id', orderId);

    if (updateError) {
      console.error('Error updating order with DOKU info:', updateError);
      return NextResponse.json({ success: false, error: 'Failed to save payment URL: ' + updateError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      payment_url: dokuData.checkout_url
    });

  } catch (error) {
    console.error('Error generating DOKU checkout:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
