import crypto from 'crypto';

const DOKU_CLIENT_ID = process.env.DOKU_CLIENT_ID;
const DOKU_SECRET_KEY = process.env.DOKU_SECRET_KEY;
// Gunakan https://api.doku.com untuk production, https://api-sandbox.doku.com untuk sandbox
const DOKU_BASE_URL = process.env.DOKU_ENV === 'production' 
  ? 'https://api.doku.com' 
  : 'https://api-sandbox.doku.com';

/**
 * Generate DOKU HMAC Signature
 */
export function generateDokuSignature(requestId, timestamp, requestTarget, body) {
  const digest = crypto
    .createHash('sha256')
    .update(JSON.stringify(body))
    .digest('base64');

  const componentSignature = `Client-Id:${DOKU_CLIENT_ID}\nRequest-Id:${requestId}\nRequest-Timestamp:${timestamp}\nRequest-Target:${requestTarget}\nDigest:${digest}`;

  const hmac = crypto.createHmac('sha256', DOKU_SECRET_KEY);
  hmac.update(componentSignature);
  return 'HMACSHA256=' + hmac.digest('base64');
}

/**
 * Generate Payment Link (Checkout)
 */
export async function createDokuCheckoutUrl(order, specificAmount = null) {
  if (!DOKU_CLIENT_ID || !DOKU_SECRET_KEY) {
    throw new Error('DOKU credentials are not set in environment variables.');
  }

  const requestId = crypto.randomUUID();
  const timestamp = new Date().toISOString().split('.')[0] + 'Z'; 
  const targetPath = '/checkout/v1/payment';

  const sisa = Number(order.total_amount) - Number(order.dp_amount || 0);
  const payAmount = specificAmount ? Number(specificAmount) : sisa;
  
  if (payAmount <= 0) {
    throw new Error('Tidak ada tagihan tersisa untuk dibayar.');
  }

  const invoiceNumber = order.invoice_number || order.id;
  const uniqueId = invoiceNumber + '-' + Date.now(); // Ensure unique invoice ID for multiple attempts

  const payload = {
    order: {
      amount: payAmount,
      invoice_number: uniqueId,
      currency: "IDR",
      callback_url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/track/${order.id}`
    },
    payment: {
      payment_due_date: 60 * 24 // 24 hours
    },
    customer: {
      name: order.customers?.name || "Customer",
      email: order.customers?.email || "customer@kingsablon.com",
      phone: order.customers?.phone || "081234567890"
    }
  };

  const signature = generateDokuSignature(requestId, timestamp, targetPath, payload);

  const response = await fetch(`${DOKU_BASE_URL}${targetPath}`, {
    method: 'POST',
    headers: {
      'Client-Id': DOKU_CLIENT_ID,
      'Request-Id': requestId,
      'Request-Timestamp': timestamp,
      'Signature': signature,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  const data = await response.json();
  
  if (!response.ok) {
    console.error('DOKU API Error:', data);
    throw new Error(data.error?.message || 'Failed to create DOKU checkout');
  }

  return {
    checkout_url: data.response.payment.url,
    invoice_id: uniqueId
  };
}
