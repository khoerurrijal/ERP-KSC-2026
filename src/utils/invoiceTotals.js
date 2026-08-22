const SERVICE_CODES = new Set(['SRV-FAST-TRACK', 'FAST-TRACK', 'SRV-2-WARNA', 'BIAYA-WARNA'])

function getServiceType(item) {
  const code = String(item.product_code || '').toUpperCase()
  if (['SRV-FAST-TRACK', 'FAST-TRACK'].includes(code)) return 'fast-track'
  if (['SRV-2-WARNA', 'BIAYA-WARNA'].includes(code)) return 'two-color'
  return null
}

export function getInvoiceBaseItems(items = []) {
  return items.filter(item => !SERVICE_CODES.has(String(item.product_code || '').toUpperCase()))
}

export function getInvoiceAdditionalCharges(items = []) {
  const serviceRows = items.filter(item => getServiceType(item))
  const legacyTypes = new Set(serviceRows.map(getServiceType))
  const baseItems = getInvoiceBaseItems(items)

  const calculatedCharges = baseItems.flatMap((item, index) => {
    const notes = String(item.notes || '')
    const qty = Number(item.qty || 0)
    const unitMultiplier = Number(item.unit_multiplier || 1)
    const charges = []

    if (!legacyTypes.has('fast-track') && (item.is_fast_track || /fast[\s_-]*track/i.test(notes))) {
      charges.push({
        key: `fast-track-${item.id || index}`,
        label: 'Biaya Fast Track',
        amount: 100000 * Math.ceil((qty * unitMultiplier) / 1000)
      })
    }

    if (!legacyTypes.has('two-color') && (item.is_two_color || /2\s*warna|warna\s*ke-?2/i.test(notes))) {
      charges.push({
        key: `two-color-${item.id || index}`,
        label: 'Biaya 2 Warna',
        amount: 250 * qty * unitMultiplier
      })
    }

    return charges
  })

  const legacyCharges = serviceRows.map((item, index) => ({
    key: `legacy-${getServiceType(item)}-${item.id || index}`,
    label: getServiceType(item) === 'fast-track' ? 'Biaya Fast Track' : 'Biaya 2 Warna',
    amount: Number(item.total_price || (Number(item.qty || 0) * Number(item.unit_price || 0)))
  }))

  return [...calculatedCharges, ...legacyCharges]
}
