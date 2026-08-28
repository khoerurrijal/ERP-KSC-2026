import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createHash } from 'crypto';
import { normalizePhone } from '@/utils/phone';


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

    const normalizedInputPhone = normalizePhone(finalWaNumber);
    const requestFingerprint = createHash('sha256').update(JSON.stringify({
      phone: normalizedInputPhone,
      brandName: String(brandName).trim().toLowerCase(),
      items,
      designService: Boolean(designService),
      grandTotal: Number(grandTotal || 0)
    })).digest('hex');

    const { data: duplicateRequest } = await supabase
      .from('customer_order_requests')
      .select('id, request_number')
      .eq('request_fingerprint', requestFingerprint)
      .is('sales_order_id', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (duplicateRequest) {
      return NextResponse.json({ success: true, data: { request_number: duplicateRequest.request_number } });
    }

    // 1. Process Customer (Lookup by WA phone first, then fall back to brand name but verify WA)
    let customerId;
    const { data: customers } = await supabase
      .from('customers')
      .select('customer_code, phone')
      .or(`phone.eq.${normalizedInputPhone},phone.eq.${finalWaNumber}`);

    const existingCustomer = customers?.find(c => normalizePhone(c.phone) === normalizedInputPhone);

    if (existingCustomer && existingCustomer.customer_code) {
      customerId = existingCustomer.customer_code;
    } else {
      const newCustomerCode = 'CUST-WEB-' + Math.floor(Math.random() * 100000);
      const { data: newCustomer, error: custError } = await supabase
        .from('customers')
        .insert([{ 
          name: brandName, 
          phone: normalizedInputPhone, // Save in normalized canonical format
          customer_code: newCustomerCode,
          type: 'Reguler' // Default retail customer type
        }])
        .select()
        .single();
      
      if (custError) throw custError;
      customerId = newCustomerCode;
    }

    // Hanya simpan request. Sales Order, item, invoice, stok, dan transaksi
    // baru dibuat setelah Admin membuka form Sales Order lalu mengonfirmasi.
    const requestNumber = `REQ-WEB-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`;
    const notes = [
      `Order via Web Calculator.`,
      `Subtotal customer: Rp ${subtotal}`,
      `Total customer: Rp ${grandTotal}`,
      designService ? 'Jasa Desain Logo: Rp 50.000' : ''
    ].filter(Boolean).join('\n');
    const { data: request, error: requestError } = await supabase
      .from('customer_order_requests')
      .insert([{
        request_number: requestNumber,
        customer_code: customerId,
        brand_name: brandName,
        whatsapp_number: normalizedInputPhone,
        request_fingerprint: requestFingerprint,
        payload: { items, designService: Boolean(designService), subtotal, grandTotal, notes }
      }])
      .select('id, request_number')
      .single();

    if (requestError) throw requestError;

    return NextResponse.json({ 
      success: true, 
      data: {
        brand_name: brandName,
        request_number: request.request_number
      }
    });

  } catch (error) {
    console.error('Error creating public order:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

}
