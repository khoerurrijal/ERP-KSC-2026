import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

export async function POST(req) {
  try {
    const body = await req.json();
    console.log("PUBLIC ORDER PAYLOAD:", body);
    const { brandName, whatsappNumber, waNumber, items, designService, subtotal, grandTotal } = body;
    
    const finalWaNumber = whatsappNumber || waNumber;

    if (!brandName || !finalWaNumber || !items || items.length === 0) {
      console.log("Incomplete data details:", { brandName, finalWaNumber, items });
      return NextResponse.json({ success: false, error: 'Incomplete data' }, { status: 400 });
    }

    // 1. Process Customer
    let customerId;
    const { data: existingCustomer } = await supabase
      .from('customers')
      .select('customer_code')
      .eq('name', brandName)
      .limit(1)
      .single();

    if (existingCustomer && existingCustomer.customer_code) {
      customerId = existingCustomer.customer_code;
    } else {
      const newCustomerCode = 'CUST-WEB-' + Math.floor(Math.random() * 100000);
      const { data: newCustomer, error: custError } = await supabase
        .from('customers')
        .insert([{ 
          name: brandName, 
          phone: finalWaNumber,
          customer_code: newCustomerCode
        }])
        .select()
        .single();
      
      if (custError) throw custError;
      customerId = newCustomerCode;
    }

    // 2. Generate Invoice Number & Unique Code
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const invoiceNumber = `INV-WEB-${randomSuffix}`;
    const uniqueCode = Math.floor(Math.random() * 900) + 100; // 100-999
    
    const finalGrandTotal = parseInt(grandTotal) + uniqueCode;

    // 3. Create Sales Order
    let notes = `Order via Web Calculator.\nUnik: Rp ${uniqueCode}\nSubtotal: Rp ${subtotal}\n`;
    const totalFastTrack = items.filter(i => i.isFastTrack).length;
    if (totalFastTrack > 0) notes += `- Fast Track (${totalFastTrack} item) (+Rp ${totalFastTrack * 100000})\n`;
    if (designService) notes += `- Jasa Desain (+Rp 50.000)\n`;

    const { data: order, error: orderError } = await supabase
      .from('sales_orders')
      .insert([{
        invoice_number: invoiceNumber,
        customer_code: customerId, // The ERP uses the customer_code as string reference
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
    const soItems = [];
    for (const item of items) {
      let itemNotes = '';
      if (item.isFastTrack) itemNotes += '🔥 Fast Track\n';
      if (item.isTwoColor) itemNotes += '🎨 2 Warna\n';
      if (item.printingColors) itemNotes += `🎨 ${item.printingColors}\n`;
      
      soItems.push({
        so_id: order.id,
        order_type: item.orderType,
        product_code: item.productId,
        qty: parseInt(item.qty),
        unit: 'PCS',
        unit_multiplier: 1,
        unit_price: parseFloat(item.unitPrice),
        total_price: parseFloat(item.unitPrice) * parseInt(item.qty),
        notes: itemNotes.trim()
      });

      if (item.isFastTrack) {
        soItems.push({
          so_id: order.id,
          order_type: 'POLOS',
          product_code: 'SRV-FAST-TRACK',
          qty: 1, // Fixed 1 service per fast-track item checked
          unit: 'Layanan',
          unit_multiplier: 1,
          unit_price: 100000,
          total_price: 100000,
          notes: `Fast Track untuk ${item.productName || item.productId}`
        });
      }

      if (item.isTwoColor) {
        soItems.push({
          so_id: order.id,
          order_type: 'SABLON',
          product_code: 'SRV-2-WARNA',
          qty: parseInt(item.qty),
          unit: 'Pcs',
          unit_multiplier: 1,
          unit_price: 250,
          total_price: 250 * parseInt(item.qty),
          notes: `Untuk ${item.productName} - Warna Ke-2`
        });
      }
    }

    const { error: itemError } = await supabase
      .from('sales_items')
      .insert(soItems);

    if (itemError) throw itemError;

    // Return success
    return NextResponse.json({ 
      success: true, 
      data: {
        brand_name: brandName,
        invoice_number: invoiceNumber,
        grand_total: finalGrandTotal,
        uniqueCode: uniqueCode 
      }
    });

  } catch (error) {
    console.error('Error creating public order:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
