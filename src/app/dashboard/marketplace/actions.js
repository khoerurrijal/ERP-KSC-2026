'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { handleAutoStatusUpdate } from '@/app/dashboard/production/actions'

async function requireMarketplaceAdmin(supabase) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Sesi login tidak ditemukan.')

  const { data: rolesData, error: rolesError } = await supabase
    .from('system_settings')
    .select('value')
    .eq('key', 'user_roles')
    .single()

  if (rolesError) throw rolesError

  const userEmail = user.email?.toLowerCase() || ''
  const matchedUser = (rolesData?.value || []).find(role => {
    const inputEmail = (role.email || '').trim().toLowerCase()
    return inputEmail === userEmail || `${inputEmail}@kingsablon.com` === userEmail
  })
  const userRole = matchedUser?.role || 'Operator'

  if (!['ADMIN', 'OWNER'].includes(String(userRole).toUpperCase())) {
    throw new Error('Hanya Admin/Owner yang dapat memproses pencairan marketplace.')
  }
}

function normalizeMarketplaceReceipt(value) {
  return String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '')
}

async function getQuickSettlementOrders(supabase, cutoffDate, platform = 'ALL') {
  if (!cutoffDate) throw new Error('Tanggal batas order wajib diisi.')

  const { data: orders, error } = await supabase
    .from('sales_orders')
    .select('id, invoice_number, total_amount, payment_status, marketplace_pencairan, date, marketplace_receipt, customers(name, type)')
    .lte('date', cutoffDate)
    .order('date', { ascending: true })
    .limit(5000)

  if (error) throw error

  const selectedPlatform = String(platform || 'ALL').toUpperCase()
  const candidateOrders = (orders || []).filter(order => {
    const paymentStatus = String(order.payment_status || '').toUpperCase()
    const customer = Array.isArray(order.customers) ? order.customers[0] : order.customers
    const customerName = String(customer?.name || '').toLowerCase()
    const customerType = String(customer?.type || '').toLowerCase()
    const marketplaceText = `${customerName} ${customerType}`
    const isKnownPlatform = ['shopee', 'tokopedia', 'tiktok'].some(name => marketplaceText.includes(name))
    const isMarketplaceCustomer = marketplaceText.includes('marketplace') || isKnownPlatform || Boolean(normalizeMarketplaceReceipt(order.marketplace_receipt))
    const needsReconciliation = paymentStatus !== 'LUNAS' && paymentStatus !== 'BATAL'

    if (!needsReconciliation || !isMarketplaceCustomer || Number(order.total_amount || 0) <= 0) return false
    if (selectedPlatform === 'ALL') return true
    if (selectedPlatform === 'LAINNYA') return !isKnownPlatform
    return marketplaceText.includes(selectedPlatform.toLowerCase())
  })

  const receiptCounts = new Map()
  candidateOrders.forEach(order => {
    const receipt = normalizeMarketplaceReceipt(order.marketplace_receipt)
    if (receipt) receiptCounts.set(receipt, (receiptCounts.get(receipt) || 0) + 1)
  })

  const ordersToProcess = candidateOrders.filter(order => {
    const receipt = normalizeMarketplaceReceipt(order.marketplace_receipt)
    return !receipt || receiptCounts.get(receipt) === 1
  })

  return {
    orders: ordersToProcess,
    excludedDuplicateCount: candidateOrders.length - ordersToProcess.length
  }
}

export async function processMarketplaceSettlement(settlementData, paymentMethod, settlementDate) {
  const supabase = await createClient()
  try {
    await requireMarketplaceAdmin(supabase)

    const orderIds = settlementData.map(d => d.orderId)

    // 1. Fetch orders — termasuk payment_status untuk duplicate guard
    const { data: orders, error: ordersErr } = await supabase
      .from('sales_orders')
      .select('id, invoice_number, total_amount, payment_status, marketplace_pencairan, dp_amount, customers (name)')
      .in('id', orderIds)
    if (ordersErr) throw ordersErr

    // Duplicate guard: filter hanya SO yang belum settled (payment_status !== 'LUNAS')
    const pendingOrders = orders.filter(o => {
      const paymentStatus = String(o.payment_status || '').toUpperCase()
      return paymentStatus !== 'LUNAS' && paymentStatus !== 'BATAL'
    })
    if (pendingOrders.length === 0) {
      throw new Error('Semua pesanan yang dipilih sudah pernah dicairkan (LUNAS). Tidak ada yang diproses.')
    }

    // Hanya proses pendingOrders — abaikan yang sudah LUNAS
    const pendingIds = new Set(pendingOrders.map(o => o.id))
    const activePencairan = settlementData.filter(d => pendingIds.has(d.orderId))
    const totalPencairan = activePencairan.reduce((acc, curr) => acc + curr.amount, 0)

    // Resolve marketplace name dari customer
    const marketplaceNames = new Set()
    pendingOrders.forEach(o => {
      const cname = (o.customers?.name || '').toLowerCase()
      if (cname.includes('shopee')) marketplaceNames.add('Shopee')
      else if (cname.includes('tokopedia')) marketplaceNames.add('Tokopedia')
      else if (cname.includes('tiktok')) marketplaceNames.add('TikTok')
      else marketplaceNames.add('Marketplace')
    })
    const mpString = Array.from(marketplaceNames).join(', ')

    // 2. Insert 1 transaksi kas masuk untuk batch settlement ini
    // so_id tidak diisi di batch transaksi karena mencakup banyak SO —
    // identifier is: reference='PENJUALAN', description mengandung invoice numbers
    const invoiceList = pendingOrders.map(o => o.invoice_number).join(', ')
    await supabase.from('transactions').insert({
      date: settlementDate,
      reference: 'PENJUALAN',
      description: `Pencairan ${mpString} - ${invoiceList}`,
      payment_method: paymentMethod,
      amount_in: totalPencairan,
      amount_out: 0,
      workshop_code: 'KING'
    })

    // 3. Distribusi HPP per SO — gunakan beli_gudang/beli_global precomputed
    let totalHppGudang = 0
    let totalHppGlobal = 0
    let virtualRoyaltyGlobal = 0

    for (const order of pendingOrders) {
      const pencairanAmount = activePencairan.find(d => d.orderId === order.id)?.amount || 0

      // Baca dp_amount aktual dari DB untuk menghindari overwrite yang salah
      const currentDbDp = Number(order.dp_amount || 0)

      // Update SO: marketplace_pencairan, payment_status LUNAS, dp_amount = total_amount
      // dp_amount diset ke total_amount hanya untuk marketplace (full settlement by design)
      // Jika sudah ada partial dp sebelumnya, set ke nilai tertinggi
      const finalDp = Math.max(currentDbDp, Number(order.total_amount || 0))

      await supabase.from('sales_orders').update({
        payment_status: 'LUNAS',
        dp_amount: finalDp,
        marketplace_pencairan: pencairanAmount
      }).eq('id', order.id)

      // Ambil items: gunakan beli_gudang/beli_global yang precomputed saat SO dibuat
      const { data: soItems } = await supabase
        .from('sales_items')
        .select('beli_gudang, beli_global, royalty_fee')
        .eq('so_id', order.id)

      for (const item of (soItems || [])) {
        totalHppGudang += Number(item.beli_gudang || 0)
        totalHppGlobal += Number(item.beli_global || 0)
        virtualRoyaltyGlobal += Number(item.royalty_fee || 0)
      }
    }

    // 4. Record HPP ke Gudang
    if (totalHppGudang > 0) {
      await supabase.from('transactions').insert([
        {
          date: settlementDate,
          reference: null,
          description: `Alokasi HPP Cup/Barang Gudang (Marketplace) - ${pendingOrders.length} Pesanan`,
          payment_method: 'Virtual',
          amount_in: totalHppGudang,
          amount_out: 0,
          workshop_code: 'GUDANG'
        },
        {
          date: settlementDate,
          reference: null,
          description: `Potongan HPP untuk Gudang (Marketplace) - ${pendingOrders.length} Pesanan`,
          payment_method: 'Virtual',
          amount_in: 0,
          amount_out: totalHppGudang,
          workshop_code: 'KING'
        }
      ])
    }

    // 5. Record HPP & Royalty ke Global
    const totalUntukGlobal = totalHppGlobal + virtualRoyaltyGlobal
    if (totalUntukGlobal > 0) {
      await supabase.from('transactions').insert([
        {
          date: settlementDate,
          reference: null,
          description: `Alokasi HPP Bahan & Royalty (Marketplace) - ${pendingOrders.length} Pesanan`,
          payment_method: 'Virtual',
          amount_in: totalUntukGlobal,
          amount_out: 0,
          workshop_code: 'GLOBAL'
        },
        {
          date: settlementDate,
          reference: null,
          description: `Potongan HPP/Royalty untuk Global (Marketplace) - ${pendingOrders.length} Pesanan`,
          payment_method: 'Virtual',
          amount_in: 0,
          amount_out: totalUntukGlobal,
          workshop_code: 'KING'
        }
      ])
    }

    // 6. Trigger auto status update untuk semua items di pending orders
    const pendingOrderIds = pendingOrders.map(o => o.id)
    const { data: allSettledItems } = await supabase
      .from('sales_items')
      .select('id')
      .in('so_id', pendingOrderIds)
    if (allSettledItems) {
      for (const item of allSettledItems) {
        await handleAutoStatusUpdate(item.id)
      }
    }

    revalidatePath('/dashboard/marketplace')
    revalidatePath('/dashboard/transactions')
    revalidatePath('/dashboard/production')
    revalidatePath('/dashboard/sales')
    revalidatePath('/track')

    return {
      success: true,
      processed: pendingOrders.length,
      skipped: orders.length - pendingOrders.length
    }
  } catch (err) {
    console.error(err)
    return { success: false, error: err.message }
  }
}

export async function previewQuickMarketplaceSettlement(cutoffDate, platform = 'ALL') {
  const supabase = await createClient()

  try {
    await requireMarketplaceAdmin(supabase)
    const { orders, excludedDuplicateCount } = await getQuickSettlementOrders(supabase, cutoffDate, platform)

    return {
      success: true,
      count: orders.length,
      total: orders.reduce((sum, order) => sum + Number(order.total_amount || 0), 0),
      invoices: orders.slice(0, 10).map(order => order.invoice_number),
      excludedDuplicateCount
    }
  } catch (err) {
    console.error('Quick marketplace preview error:', err)
    return { success: false, error: err.message }
  }
}

export async function processQuickMarketplaceSettlement(cutoffDate, platform, paymentMethod, settlementDate) {
  const supabase = await createClient()

  try {
    await requireMarketplaceAdmin(supabase)
    const { orders, excludedDuplicateCount } = await getQuickSettlementOrders(supabase, cutoffDate, platform)
    if (orders.length === 0) throw new Error('Tidak ada pesanan marketplace yang memenuhi filter.')

    const settlementData = orders.map(order => ({
      orderId: order.id,
      amount: Number(order.total_amount || 0),
      invoice_number: order.invoice_number
    }))

    const settlementResult = await processMarketplaceSettlement(settlementData, paymentMethod, settlementDate)
    if (!settlementResult.success) throw new Error(settlementResult.error)
    const processed = settlementResult.processed || 0

    return {
      success: true,
      processed,
      pendingProcessed: processed,
      excludedDuplicateCount
    }
  } catch (err) {
    console.error('Quick marketplace settlement error:', err)
    return { success: false, error: err.message }
  }
}

function parseBulkSettlementText(rawText) {
  return String(rawText || '')
    .split(/\r?\n/)
    .map((line, index) => {
      const trimmed = line.trim()
      if (!trimmed || /^\|?\s*:?-{2,}/.test(trimmed)) return null

      const cells = trimmed.includes('|')
        ? trimmed.replace(/^\|\s*/, '').replace(/\s*\|$/, '').split('|').map(cell => cell.trim())
        : trimmed.split('\t').map(cell => cell.trim())
      if (cells.length < 2) return null

      const cleanCell = cell => String(cell || '').replace(/\*\*/g, '').replace(/`/g, '').trim()
      const cleanAmount = cell => {
        const digits = cleanCell(cell).replace(/[^\d]/g, '')
        return digits ? Number(digits) : null
      }

      const firstAmount = cleanAmount(cells[0])
      const secondAmount = cleanAmount(cells[1])
      const headerText = cells.join(' ').toLowerCase()
      if (firstAmount === null && secondAmount === null && /pencair|pesanan|marketplace/.test(headerText)) return null
      const amount = firstAmount !== null ? firstAmount : secondAmount
      const receipt = cleanCell(firstAmount !== null ? cells[1] : cells[0]).replace(/\s+/g, '')

      if (!amount && !receipt) return null
      return { line: index + 1, receipt, amount }
    })
    .filter(Boolean)
}

async function buildBulkSettlementPreview(supabase, rawText) {
  const parsedRows = parseBulkSettlementText(rawText)
  if (parsedRows.length === 0) throw new Error('Tidak ada baris pencairan yang bisa dibaca.')
  if (parsedRows.length > 500) throw new Error('Maksimal 500 pesanan per batch.')

  const { data: orders, error } = await supabase
    .from('sales_orders')
    .select('id, invoice_number, total_amount, payment_status, marketplace_pencairan, marketplace_receipt, customers(name)')
    .not('marketplace_receipt', 'is', null)
    .neq('marketplace_receipt', '')
    .limit(5000)

  if (error) throw error

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
    else if (String(matches[0].payment_status || '').toUpperCase() === 'LUNAS' || Number(matches[0].marketplace_pencairan || 0) > 0) status = 'SUDAH CAIR'
    else if (row.amount > Number(matches[0].total_amount || 0)) status = 'NOMINAL > TAGIHAN'

    return {
      line: row.line,
      receipt: row.receipt,
      amount: row.amount,
      status,
      orderId: status === 'COCOK' ? matches[0]?.id : null,
      invoiceNumber: matches.length === 1 ? matches[0].invoice_number : null,
      customerName: customer?.name || null,
      invoiceTotal: matches.length === 1 ? Number(matches[0].total_amount || 0) : null
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
      overTotalCount: countByStatus('NOMINAL > TAGIHAN')
    }
  }
}

export async function previewBulkMarketplaceSettlement(rawText) {
  const supabase = await createClient()
  try {
    await requireMarketplaceAdmin(supabase)
    const preview = await buildBulkSettlementPreview(supabase, rawText)
    return { success: true, ...preview }
  } catch (err) {
    console.error('Bulk marketplace preview error:', err)
    return { success: false, error: err.message }
  }
}

export async function processBulkMarketplaceSettlement(rawText, paymentMethod, settlementDate) {
  const supabase = await createClient()
  try {
    await requireMarketplaceAdmin(supabase)
    const preview = await buildBulkSettlementPreview(supabase, rawText)
    const matchedRows = preview.rows.filter(row => row.status === 'COCOK')
    if (matchedRows.length === 0) throw new Error('Tidak ada baris yang cocok untuk diproses.')

    const settlementResult = await processMarketplaceSettlement(
      matchedRows.map(row => ({ orderId: row.orderId, amount: row.amount, invoice_number: row.invoiceNumber })),
      paymentMethod,
      settlementDate
    )
    if (!settlementResult.success) throw new Error(settlementResult.error)

    return {
      success: true,
      processed: settlementResult.processed,
      skipped: settlementResult.skipped,
      summary: preview.summary
    }
  } catch (err) {
    console.error('Bulk marketplace settlement error:', err)
    return { success: false, error: err.message }
  }
}

export async function updateMarketplaceReceipt(orderId, receipt) {
  const supabase = await createClient();
  const { error } = await supabase.from('sales_orders').update({ marketplace_receipt: receipt }).eq('id', orderId);
  if (error) return { success: false, error: error.message };
  revalidatePath('/dashboard/marketplace');
  revalidatePath('/dashboard/sales');
  return { success: true };
}
