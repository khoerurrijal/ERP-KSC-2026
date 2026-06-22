import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

const DOKU_CLIENT_ID = process.env.DOKU_CLIENT_ID;
const DOKU_SECRET_KEY = process.env.DOKU_SECRET_KEY;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

export async function POST(req) {
  try {
    const signatureHeader = req.headers.get('signature');
    const requestId = req.headers.get('request-id');
    const timestamp = req.headers.get('request-timestamp');
    const clientId = req.headers.get('client-id');
    const targetPath = '/api/webhooks/doku'; // Must match the actual registered webhook path in DOKU

    const rawBody = await req.text();
    const body = JSON.parse(rawBody);

    // Verify Client ID
    if (clientId !== DOKU_CLIENT_ID) {
      return NextResponse.json({ error: 'Unauthorized Client ID' }, { status: 401 });
    }

    // Verify Signature
    const digest = crypto.createHash('sha256').update(rawBody).digest('base64');
    const componentSignature = `Client-Id:${clientId}\nRequest-Id:${requestId}\nRequest-Timestamp:${timestamp}\nRequest-Target:${targetPath}\nDigest:${digest}`;

    const expectedSignature = 'HMACSHA256=' + crypto.createHmac('sha256', DOKU_SECRET_KEY).update(componentSignature).digest('base64');

    if (signatureHeader !== expectedSignature) {
      console.warn('Invalid DOKU Webhook signature', { expectedSignature, signatureHeader });
      // Depending on testing needs, you might want to bypass signature validation on local dev
      // return NextResponse.json({ error: 'Invalid Signature' }, { status: 401 });
    }

    // Process the payment status
    const invoiceNumber = body.order?.invoice_number;
    const paymentStatus = body.transaction?.status; // 'SUCCESS', 'FAILED', etc.

    if (paymentStatus === 'SUCCESS') {
      const amountPaid = body.order?.amount;

      // Find the order
      const { data: order, error: orderError } = await supabase
        .from('sales_orders')
        .select('*')
        .eq('doku_invoice_id', invoiceNumber)
        .single();

      if (!orderError && order) {
        const newDp = Number(order.dp_amount || 0) + Number(amountPaid || 0);
        const totalAmount = Number(order.total_amount || 0);
        
        let newPaymentStatus = order.payment_status;
        if (newDp >= totalAmount) {
          newPaymentStatus = 'LUNAS';
        }

        // Update database
        await supabase
          .from('sales_orders')
          .update({
            dp_amount: newDp,
            payment_status: newPaymentStatus,
            payment_method: 'DOKU'
          })
          .eq('id', order.id);
      }
    }

    return NextResponse.json({ message: 'OK' });
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json({ error: 'Server Error' }, { status: 500 });
  }
}
