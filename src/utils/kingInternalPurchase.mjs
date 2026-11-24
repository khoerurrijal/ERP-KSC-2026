export const KING_INTERNAL_PURCHASE_MARKER = '[PEMBELIAN_INTERNAL_KING]'

const normalizeRelation = value => Array.isArray(value) ? value[0] : value

export function isKingInternalCustomerType(type) {
  return String(type || '').trim().toUpperCase() === 'KING'
}

export function isKingInternalOrder(order) {
  const customer = normalizeRelation(order?.customers)
  return isKingInternalCustomerType(customer?.type)
    || String(order?.notes || '').includes(KING_INTERNAL_PURCHASE_MARKER)
}

export function stripKingInternalPurchaseMarker(notes) {
  return String(notes || '').replace(KING_INTERNAL_PURCHASE_MARKER, '').trim()
}
