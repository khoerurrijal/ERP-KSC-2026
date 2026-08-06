const DELIVERY_STATUSES = new Set(['DIKIRIM', 'SUDAH DIAMBIL'])
const TRACKED_ORDER_TYPES = new Set(['SABLON', 'POLOS', 'PRINTING'])
const MANUAL_SERVICE_ORDER_TYPES = new Set(['JASA', 'LAINNYA'])
const VALID_STATUSES = new Set([
  'DRAFT',
  'BARU MASUK',
  'SIAP PROSES',
  'PROSES',
  'SUDAH JADI',
  'SIAP KIRIM',
  'DIKIRIM',
  'SUDAH DIAMBIL',
  'SELESAI',
  'BATAL'
])
const LEGACY_SERVICE_CODES = new Set(['SRV-FAST-TRACK', 'FAST-TRACK', 'SRV-2-WARNA', 'BIAYA-WARNA'])

const normalizeRelation = (value) => Array.isArray(value) ? value[0] : value
const normalizeText = (value) => String(value || '').trim().toUpperCase()
const normalizeMarketplaceReceipt = (value) => {
  const receipt = normalizeText(value)
  return ['NULL', 'N/A', '-'].includes(receipt) ? '' : receipt
}

const makeIssue = (id, severity, category, title, description, records = [], href = '') => ({
  id,
  severity,
  category,
  title,
  description,
  records,
  href
})

const groupBy = (rows, getKey) => {
  const groups = new Map()
  for (const row of rows) {
    const key = getKey(row)
    if (!key) continue
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(row)
  }
  return groups
}

export async function runAuditScan(supabase) {
  const [ordersResult, itemsResult, transactionsResult, settingsResult] = await Promise.all([
    supabase
      .from('sales_orders')
      .select('id, invoice_number, date, total_amount, dp_amount, payment_status, marketplace_receipt, marketplace_pencairan')
      .order('date', { ascending: false })
      .limit(5000),
    supabase
      .from('sales_items')
      .select('id, so_id, product_code, order_type, qty, unit_multiplier, status, notes, products(name, is_active)')
      .limit(10000),
    supabase
      .from('transactions')
      .select('id, date, reference, description, amount_in, amount_out, so_id')
      .order('date', { ascending: false })
      .limit(10000),
    supabase
      .from('system_settings')
      .select('key')
      .in('key', ['user_roles', 'dropdown_config', 'pricelist_config'])
  ])

  const queryErrors = [ordersResult, itemsResult, transactionsResult, settingsResult]
    .filter(result => result.error)
    .map(result => result.error.message)

  if (queryErrors.length > 0) {
    return {
      generatedAt: new Date().toISOString(),
      summary: { total: 1, critical: 1, warning: 0, info: 0 },
      issues: [makeIssue(
        'audit-query-error',
        'critical',
        'Kesehatan Sistem',
        'Audit tidak bisa membaca seluruh data',
        queryErrors.join('; '),
        [],
        '/dashboard'
      )]
    }
  }

  const orders = ordersResult.data || []
  const items = itemsResult.data || []
  const transactions = transactionsResult.data || []
  const settings = new Set((settingsResult.data || []).map(setting => setting.key))
  const orderById = new Map(orders.map(order => [String(order.id), order]))
  const issues = []
  const legacyServicesByOrder = new Map()
  const finishedUnpaidByOrder = new Map()
  const deliveredPaidByOrder = new Map()

  const addToIssueGroup = (groups, key, row) => {
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(row)
  }

  const duplicateInvoices = groupBy(orders, order => normalizeText(order.invoice_number))
  for (const [invoice, rows] of duplicateInvoices) {
    if (rows.length < 2) continue
    issues.push(makeIssue(
      `duplicate-invoice-${invoice}`,
      'critical',
      'Data Ganda',
      `Invoice ${invoice} terdaftar lebih dari sekali`,
      `${rows.length} sales order menggunakan nomor invoice yang sama.`,
      rows.map(row => ({ label: row.id, value: row.date || '-', href: `/sales?search=${encodeURIComponent(invoice)}` })),
      `/sales?search=${encodeURIComponent(invoice)}`
    ))
  }

  const duplicateReceipts = groupBy(orders, order => normalizeMarketplaceReceipt(order.marketplace_receipt))
  for (const [receipt, rows] of duplicateReceipts) {
    if (!receipt || rows.length < 2) continue
    issues.push(makeIssue(
      `duplicate-receipt-${receipt}`,
      'warning',
      'Verifikasi Marketplace',
      `Nomor pesanan marketplace ${receipt} dipakai beberapa invoice`,
      `${rows.length} invoice memakai nomor yang sama. Ini bisa berupa split order internal atau input ganda dan perlu diverifikasi sebelum rekonsiliasi.`,
      rows.map(row => ({ label: row.invoice_number || row.id, value: row.date || '-', href: '/marketplace' })),
      '/marketplace'
    ))
  }

  for (const item of items) {
    const order = orderById.get(String(item.so_id))
    const product = normalizeRelation(item.products)
    const code = normalizeText(item.product_code)
    const orderType = normalizeText(item.order_type)
    const status = normalizeText(item.status || 'BARU MASUK')
    const isLegacyService = LEGACY_SERVICE_CODES.has(code)
    const isManualService = MANUAL_SERVICE_ORDER_TYPES.has(orderType)
    const isTrackedItem = TRACKED_ORDER_TYPES.has(orderType) && !isLegacyService

    if (!order) {
      issues.push(makeIssue(
        `orphan-item-${item.id}`,
        'critical',
        'Relasi Data',
        'Sales item tidak memiliki invoice',
        `Item ${item.product_code || item.id} mengarah ke sales order yang tidak ditemukan.`,
        [{ label: item.id, value: item.product_code || '-', href: '/sales' }],
        '/sales'
      ))
    }

    const productInactive = product?.is_active === false
    if ((!product || productInactive) && !isLegacyService && !isManualService) {
      issues.push(makeIssue(
        `missing-product-${item.id}`,
        'info',
        'Referensi Produk',
        `Referensi produk historis ${item.product_code || item.id}`,
        productInactive
          ? 'Master produk saat ini tidak aktif. Data invoice tetap dipertahankan dan tidak dianggap sebagai masalah.'
          : 'Master produk saat ini tidak ditemukan. Data invoice tetap dipertahankan dan tidak dianggap sebagai masalah.',
        [{ label: item.product_code || item.id, value: order?.invoice_number || '-', href: '/master/products' }],
        '/master/products'
      ))
    }

    if (isLegacyService) {
      const orderKey = order ? String(order.id) : `item-${item.id}`
      addToIssueGroup(legacyServicesByOrder, orderKey, {
        label: order?.invoice_number || item.so_id || item.id,
        value: item.product_code,
        href: `/sales?search=${encodeURIComponent(order?.invoice_number || '')}`
      })
    }

    if (!VALID_STATUSES.has(status)) {
      issues.push(makeIssue(
        `invalid-status-${item.id}`,
        'critical',
        'Status Produksi',
        `Status item tidak dikenal: ${status}`,
        'Status ini tidak termasuk daftar status produksi yang digunakan aplikasi.',
        [{ label: order?.invoice_number || item.so_id, value: status, href: '/sales' }],
        '/sales'
      ))
    }

    const paymentStatus = normalizeText(order?.payment_status)
    if (isTrackedItem && status === 'SELESAI' && paymentStatus !== 'LUNAS') {
      const orderKey = order ? String(order.id) : `item-${item.id}`
      addToIssueGroup(finishedUnpaidByOrder, orderKey, {
        label: order?.invoice_number || item.so_id,
        value: `${status} / ${paymentStatus || '-'}`,
        href: `/sales?search=${encodeURIComponent(order?.invoice_number || '')}`
      })
    }

    if (isTrackedItem && DELIVERY_STATUSES.has(status) && paymentStatus === 'LUNAS') {
      const orderKey = order ? String(order.id) : `item-${item.id}`
      addToIssueGroup(deliveredPaidByOrder, orderKey, {
        label: order?.invoice_number || item.so_id,
        value: status,
        href: '/status-pesanan?tab=shipping'
      })
    }
  }

  for (const [orderKey, rows] of legacyServicesByOrder) {
    const order = orderById.get(orderKey)
    const invoice = order?.invoice_number || rows[0]?.label || orderKey
    const codes = [...new Set(rows.map(row => row.value).filter(Boolean))].join(', ')
    issues.push(makeIssue(
      `legacy-service-${orderKey}`,
      'info',
      'Data Legacy',
      `Layanan legacy pada invoice ${invoice}`,
      `Ditemukan ${codes}. Ini catatan data historis; item tidak ikut tracking produksi dan tidak dihapus otomatis.`,
      rows,
      `/sales?search=${encodeURIComponent(invoice || '')}`
    ))
  }

  for (const [orderKey, rows] of finishedUnpaidByOrder) {
    const order = orderById.get(orderKey)
    const invoice = order?.invoice_number || rows[0]?.label || orderKey
    issues.push(makeIssue(
      `finished-unpaid-${orderKey}`,
      'warning',
      'Status & Pembayaran',
      `Invoice ${invoice} memiliki item selesai tetapi belum lunas`,
      `${rows.length} item produksi berstatus SELESAI sementara invoice belum LUNAS.`,
      rows,
      `/sales?search=${encodeURIComponent(invoice || '')}`
    ))
  }

  for (const [orderKey, rows] of deliveredPaidByOrder) {
    const order = orderById.get(orderKey)
    const invoice = order?.invoice_number || rows[0]?.label || orderKey
    issues.push(makeIssue(
      `delivered-paid-${orderKey}`,
      'warning',
      'Status & Pembayaran',
      `Invoice ${invoice} lunas tetapi belum selesai`,
      `${rows.length} item produksi sudah dikirim/diambil dan invoice sudah LUNAS, tetapi belum difinalisasi menjadi SELESAI.`,
      rows,
      '/status-pesanan?tab=shipping'
    ))
  }

  for (const order of orders) {
    const paymentStatus = normalizeText(order.payment_status)
    const receipt = normalizeMarketplaceReceipt(order.marketplace_receipt)
    const payout = Number(order.marketplace_pencairan || 0)
    const total = Number(order.total_amount || 0)
    const orderItems = items.filter(item => String(item.so_id) === String(order.id))

    if (orderItems.length === 0 && paymentStatus !== 'BATAL') {
      issues.push(makeIssue(
        `empty-order-${order.id}`,
        'warning',
        'Relasi Data',
        `Invoice ${order.invoice_number || order.id} tidak memiliki item`,
        'Sales order aktif tidak memiliki sales item yang bisa diproduksi atau ditagihkan.',
        [{ label: order.invoice_number || order.id, value: order.date || '-', href: `/sales?search=${encodeURIComponent(order.invoice_number || '')}` }],
        `/sales?search=${encodeURIComponent(order.invoice_number || '')}`
      ))
    }

    if (receipt && paymentStatus === 'LUNAS' && payout <= 0) {
      issues.push(makeIssue(
        `marketplace-payout-missing-${order.id}`,
        'warning',
        'Marketplace',
        `Pencairan marketplace invoice ${order.invoice_number || order.id} kosong`,
        'Invoice marketplace sudah lunas, tetapi nominal pencairannya masih kosong.',
        [{ label: order.invoice_number || order.id, value: `Rp ${total.toLocaleString('id-ID')}`, href: '/marketplace' }],
        '/marketplace'
      ))
    }

    if (receipt && paymentStatus !== 'LUNAS' && payout > 0) {
      issues.push(makeIssue(
        `marketplace-status-mismatch-${order.id}`,
        'critical',
        'Marketplace',
        `Pencairan ada tetapi invoice ${order.invoice_number || order.id} belum lunas`,
        'Nominal marketplace_pencairan sudah terisi, tetapi payment_status belum LUNAS.',
        [{ label: order.invoice_number || order.id, value: `Rp ${payout.toLocaleString('id-ID')}`, href: '/marketplace' }],
        '/marketplace'
      ))
    }

    if (Number(order.dp_amount || 0) > total && total >= 0) {
      issues.push(makeIssue(
        `overpayment-${order.id}`,
        'warning',
        'Keuangan',
        `DP invoice ${order.invoice_number || order.id} melebihi total`,
        'Nilai pembayaran tercatat lebih besar daripada total invoice.',
        [{ label: order.invoice_number || order.id, value: `DP Rp ${Number(order.dp_amount).toLocaleString('id-ID')} / Total Rp ${total.toLocaleString('id-ID')}`, href: `/sales?search=${encodeURIComponent(order.invoice_number || '')}` }],
        `/sales?search=${encodeURIComponent(order.invoice_number || '')}`
      ))
    }
  }

  const duplicateTransactions = groupBy(transactions, transaction => [
    transaction.date,
    transaction.reference,
    transaction.description,
    transaction.amount_in,
    transaction.amount_out,
    transaction.so_id || ''
  ].join('|'))
  for (const [key, rows] of duplicateTransactions) {
    if (rows.length < 2 || !key) continue
    issues.push(makeIssue(
      `duplicate-transaction-${rows[0].id}`,
      'warning',
      'Keuangan',
      'Transaksi yang sama tercatat lebih dari sekali',
      `${rows.length} transaksi memiliki tanggal, keterangan, nominal, dan invoice yang sama.`,
      rows.map(row => ({ label: row.id, value: row.description || '-', href: '/transactions' })),
      '/transactions'
    ))
  }

  for (const key of ['user_roles', 'dropdown_config', 'pricelist_config']) {
    if (!settings.has(key)) {
      issues.push(makeIssue(
        `missing-setting-${key}`,
        'warning',
        'Kesehatan Sistem',
        `Konfigurasi ${key} belum tersedia`,
        'Aplikasi mungkin menggunakan nilai default untuk sebagian fitur.',
        [{ label: key, value: 'Tidak ditemukan', href: '/system-config' }],
        '/system-config'
      ))
    }
  }

  const severityWeight = { critical: 0, warning: 1, info: 2 }
  issues.sort((a, b) => severityWeight[a.severity] - severityWeight[b.severity])

  return {
    generatedAt: new Date().toISOString(),
    summary: {
      total: issues.length,
      critical: issues.filter(issue => issue.severity === 'critical').length,
      warning: issues.filter(issue => issue.severity === 'warning').length,
      info: issues.filter(issue => issue.severity === 'info').length
    },
    issues: issues.slice(0, 250)
  }
}
