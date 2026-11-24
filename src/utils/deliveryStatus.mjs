const normalize = value => String(value || '').trim().toUpperCase()

const DELIVERED_STATUSES = new Set(['DIKIRIM', 'TERKIRIM', 'SUDAH DIAMBIL'])
const PAID_STATUSES = new Set(['LUNAS', 'SETTLED_EXTERNAL'])

export function isFullyPaidForDelivery(paymentStatus) {
  return PAID_STATUSES.has(normalize(paymentStatus))
}

export function shouldCompleteDelivery(deliveryStatus, paymentStatus) {
  return DELIVERED_STATUSES.has(normalize(deliveryStatus)) && isFullyPaidForDelivery(paymentStatus)
}
