import { NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { createAdminClient } from '@/utils/supabase/admin';
import { normalizePhone } from '@/utils/phone';

export async function POST(req) {
  try {
    const supabase = createAdminClient();
    const body = await req.json();
    const { brandName, whatsappNumber, waNumber, items, designService, subtotal, grandTotal } = body;
    
    const finalWaNumber = whatsappNumber || waNumber;

    if (!brandName || !finalWaNumber || !items || items.length === 0) {
      return NextResponse.json({ success: false, error: 'Incomplete data' }, { status: 400 });
    }

    const normalizedBrandName = String(brandName).trim();
    const normalizedPhoneInput = String(finalWaNumber).trim();
    const hasValidItems = items.every(item => (
      item &&
      String(item.productId || '').trim() &&
      String(item.orderType || '').trim() &&
      Number.isFinite(Number(item.qty)) && Number(item.qty) > 0 &&
      Number.isFinite(Number(item.unitPrice)) && Number(item.unitPrice) >= 0
    ));
    if (
      normalizedBrandName.length > 200 ||
      normalizedPhoneInput.length > 40 ||
      items.length > 50 ||
      !hasValidItems ||
      !/^\+?[0-9][0-9\s().-]{5,39}$/.test(normalizedPhoneInput)
    ) {
      return NextResponse.json({ success: false, error: 'Format data pesanan tidak valid.' }, { status: 400 });
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

    // Guest hanya membuat antrean review. Customer, Sales Order, item, stok,
    // invoice, dan transaksi dibuat setelah Admin mengonfirmasi request.
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
        customer_code: null,
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
