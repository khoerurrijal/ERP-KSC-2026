import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

export async function POST(req) {
  try {
    const body = await req.json();
    const { brandName, whatsappNumber, productId, productName, qty, fastTrack, designService, twoColor, pricePerItem, subtotal, grandTotal } = body;

    if (!brandName || !whatsappNumber || !productId || !qty) {
      return NextResponse.json({ success: false, error: 'Incomplete data' }, { status: 400 });
    }

    // 1. Process Customer
    let customerId;
    const { data: existingCustomer } = await supabase
      .from('customers')
      .select('id')
      .eq('name', brandName)
      .limit(1)
      .single();

    if (existingCustomer) {
      customerId = existingCustomer.id;
    } else {
      const { data: newCustomer, error: custError } = await supabase
        .from('customers')
        .insert([{ 
          name: brandName, 
          phone: whatsappNumber,
          customer_code: 'CUST-WEB-' + Math.floor(Math.random() * 100000)
        }])
        .select()
        .single();
      
      if (custError) throw custError;
      customerId = newCustomer.id;
    }

    // 2. Generate Invoice Number & Unique Code
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const invoiceNumber = `INV-WEB-${randomSuffix}`;
    const uniqueCode = Math.floor(Math.random() * 900) + 100; // 100-999
    
    const finalGrandTotal = parseInt(grandTotal) + uniqueCode;

    // 3. Create Sales Order
    let notes = `Order via Web Calculator.\nUnik: Rp ${uniqueCode}\nSubtotal: Rp ${subtotal}\n`;
    if (fastTrack) notes += `- Fast Track (+Rp 100.000)\n`;
    if (designService) notes += `- Jasa Desain (+Rp 50.000)\n`;
    if (twoColor) notes += `- Sablon 2 Warna\n`;

    const { data: order, error: orderError } = await supabase
      .from('sales_orders')
      .insert([{
        invoice_number: invoiceNumber,
        customer_code: customerId, // The ERP uses the UUID as customer_code reference
        date: new Date().toISOString().split('T')[0],
        status: 'DRAFT',
        payment_status: 'BELUM LUNAS',
        payment_method: 'TRANSFER',
        dp_amount: 0,
        total_amount: finalGrandTotal,
        notes: notes
      }])
      .select()
      .single();

    if (orderError) throw orderError;

    // 4. Create Sales Items
    const { error: itemError } = await supabase
      .from('sales_items')
      .insert([{
        so_id: order.id,
        order_type: 'Sablon',
        product_code: productId,
        qty: parseInt(qty),
        unit: 'PCS',
        unit_multiplier: 1,
        unit_price: parseFloat(pricePerItem),
        total_price: finalGrandTotal
      }]);

    if (itemError) throw itemError;

    // Return success
    return NextResponse.json({ 
      success: true, 
      invoice: invoiceNumber, 
      grandTotal: finalGrandTotal,
      uniqueCode: uniqueCode 
    });

  } catch (error) {
    console.error('Error creating public order:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
