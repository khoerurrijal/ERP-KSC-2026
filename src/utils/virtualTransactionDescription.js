export function formatVirtualProductDescription(direction, products) {
  const quantities = new Map()

  for (const product of products || []) {
    const name = String(product?.name || product?.product_code || 'Produk').trim()
    const unit = String(product?.unit || 'PCS').trim()
    const quantity = Number(product?.qty)
    if (!Number.isFinite(quantity) || quantity <= 0) continue

    const key = `${name.toLocaleLowerCase()}\u0000${unit.toLocaleLowerCase()}`
    const current = quantities.get(key)
    quantities.set(key, {
      name: current?.name || name,
      unit: current?.unit || unit,
      qty: (current?.qty || 0) + quantity,
    })
  }

  const productSummary = [...quantities.values()]
    .map(product => `${product.name} x ${product.qty.toLocaleString('id-ID', { maximumFractionDigits: 3 })} ${product.unit}`)
    .join(', ') || 'Produk'

  return productSummary
}
