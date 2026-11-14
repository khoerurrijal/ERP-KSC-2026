export function normalizeMarketplaceReceipt(value) {
  return String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '')
}

export function buildBulkSettlementPreview(parsedRows, orders) {
  const orderIndex = new Map()
  for (const order of orders || []) {
    const receipt = normalizeMarketplaceReceipt(order.marketplace_receipt)
    if (!receipt) continue
    const existing = orderIndex.get(receipt) || []
    existing.push(order)
    orderIndex.set(receipt, existing)
  }

  const inputCounts = new Map()
  parsedRows.forEach(row => {
    const receipt = normalizeMarketplaceReceipt(row.receipt)
    inputCounts.set(receipt, (inputCounts.get(receipt) || 0) + 1)
  })

  const rows = parsedRows.map(row => {
    const receipt = normalizeMarketplaceReceipt(row.receipt)
    const matches = orderIndex.get(receipt) || []
    const customer = matches.length === 1
      ? (Array.isArray(matches[0].customers) ? matches[0].customers[0] : matches[0].customers)
      : null
    let status = 'COCOK'

    if (!row.receipt || !row.amount || row.amount <= 0) status = 'NOMINAL INVALID'
    else if ((inputCounts.get(receipt) || 0) > 1) status = 'DUPLIKAT INPUT'
    else if (matches.length === 0) status = 'TIDAK DITEMUKAN'
    else if (matches.length > 1) status = 'DUPLIKAT DATABASE'
    else if (String(matches[0].payment_status || '').toUpperCase() === 'LUNAS' || String(matches[0].marketplace_settlement_status || '').toUpperCase() === 'SETTLED_EXTERNAL' || Number(matches[0].marketplace_pencairan || 0) > 0) status = 'SUDAH CAIR'

    const invoiceTotal = matches.length === 1 ? Number(matches[0].total_amount || 0) : null
    const overTotal = status === 'COCOK' && Number(row.amount) > invoiceTotal

    return {
      line: row.line,
      receipt: row.receipt,
      amount: row.amount,
      status,
      overTotal,
      orderId: status === 'COCOK' ? matches[0]?.id : null,
      invoiceNumber: matches.length === 1 ? matches[0].invoice_number : null,
      customerName: customer?.name || null,
      invoiceTotal
    }
  })

  const matchedRows = rows.filter(row => row.status === 'COCOK')
  const countByStatus = status => rows.filter(row => row.status === status).length
  return {
    rows,
    summary: {
      inputCount: rows.length,
      matchedCount: matchedRows.length,
      matchedTotal: matchedRows.reduce((sum, row) => sum + Number(row.amount || 0), 0),
      invalidCount: countByStatus('NOMINAL INVALID'),
      notFoundCount: countByStatus('TIDAK DITEMUKAN'),
      duplicateCount: countByStatus('DUPLIKAT INPUT') + countByStatus('DUPLIKAT DATABASE'),
      settledCount: countByStatus('SUDAH CAIR'),
      overTotalCount: rows.filter(row => row.overTotal).length
    }
  }
}

export function isValidSettlementAmount(amount, invoiceTotal, allowAboveInvoice = false) {
  const parsedAmount = Number(amount)
  return Number.isFinite(parsedAmount) && parsedAmount > 0 && (
    allowAboveInvoice || parsedAmount <= Number(invoiceTotal || 0)
  )
}
