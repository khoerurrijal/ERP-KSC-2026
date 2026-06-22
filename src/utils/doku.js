import crypto from 'crypto';

/**
 * Generate DOKU HMAC Signature
 */
export function generateDokuSignature(requestId, timestamp, requestTarget, body) {
  const dokuClientId = process.env.DOKU_CLIENT_ID;
  const dokuSecretKey = process.env.DOKU_SECRET_KEY;
  
  const digest = crypto
    .createHash('sha256')
    .update(JSON.stringify(body))
    .digest('base64');

  const componentSignature = `Client-Id:${dokuClientId}\nRequest-Id:${requestId}\nRequest-Timestamp:${timestamp}\nRequest-Target:${requestTarget}\nDigest:${digest}`;

  const hmac = crypto.createHmac('sha256', dokuSecretKey);
  hmac.update(componentSignature);
  return 'HMACSHA256=' + hmac.digest('base64');
}

/**
 * Generate Payment Link (Checkout)
 */
export async function createDokuCheckoutUrl(order, specificAmount = null) {
  const dokuClientId = process.env.DOKU_CLIENT_ID;
  const dokuSecretKey = process.env.DOKU_SECRET_KEY;
  const dokuBaseUrl = process.env.DOKU_ENV === 'production' 
    ? 'https://api.doku.com' 
    : 'https://api-sandbox.doku.com';

  if (!dokuClientId || !dokuSecretKey) {
    throw new Error(`DOKU credentials missing. DOKU_CLIENT_ID: ${!!dokuClientId}, DOKU_SECRET_KEY: ${!!dokuSecretKey}, DOKU_ENV: ${process.env.DOKU_ENV || 'undefined'}`);
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

  const response = await fetch(`${dokuBaseUrl}${targetPath}`, {
    method: 'POST',
    headers: {
      'Client-Id': dokuClientId,
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
