'use server'

import { createAuthorizedAdminClient } from '@/lib/adminAuth'
import { revalidatePath } from 'next/cache'
import { handleAutoStatusUpdate } from '@/app/dashboard/production/actions'
import { formatVirtualProductDescription } from '@/utils/virtualTransactionDescription'
import { buildBulkSettlementPreview as buildBulkSettlementRows, isValidSettlementAmount, normalizeMarketplaceReceipt } from './settlementPreview.mjs'

async function requireMarketplaceAdmin() {
  return createAuthorizedAdminClient(
    ['ADMIN', 'OWNER'],
    'Hanya Admin/Owner yang dapat memproses pencairan marketplace.'
  )
}

function isMarketplaceOrder(order) {
  const customer = Array.isArray(order.customers) ? order.customers[0] : order.customers
  const marketplaceText = `${String(customer?.name || '').toLowerCase()} ${String(customer?.type || '').toLowerCase()}`
  const isKnownPlatform = ['shopee', 'tokopedia', 'tiktok'].some(name => marketplaceText.includes(name))
  return marketplaceText.includes('marketplace') || isKnownPlatform || Boolean(normalizeMarketplaceReceipt(order.marketplace_receipt))
}

async function runInBatches(items, batchSize, task) {
  for (let index = 0; index < items.length; index += batchSize) {
    const batch = items.slice(index, index + batchSize)
    const results = await Promise.allSettled(batch.map(task))
    const failed = results.find(result => result.status === 'rejected')
    if (failed) throw failed.reason
  }
}

async function getQuickSettlementOrders(supabase, cutoffDate, platform = 'ALL') {
  if (!cutoffDate) throw new Error('Tanggal batas order wajib diisi.')

  const { data: orders, error } = await supabase
    .from('sales_orders')
    .select('id, invoice_number, total_amount, payment_status, marketplace_pencairan, marketplace_settlement_status, date, marketplace_receipt, customers(name, type)')
    .lte('date', cutoffDate)
    .order('date', { ascending: true })
    .limit(5000)

  if (error) throw error

  const selectedPlatform = String(platform || 'ALL').toUpperCase()
  const candidateOrders = (orders || []).filter(order => {
    const paymentStatus = String(order.payment_status || '').toUpperCase()
    const customer = Array.isArray(order.customers) ? order.customers[0] : order.customers
    const marketplaceText = `${String(customer?.name || '').toLowerCase()} ${String(customer?.type || '').toLowerCase()}`
    const isKnownPlatform = ['shopee', 'tokopedia', 'tiktok'].some(name => marketplaceText.includes(name))
    const isMarketplaceCustomer = isMarketplaceOrder(order)
    const needsReconciliation = paymentStatus !== 'LUNAS' && paymentStatus !== 'BATAL'
    const settlementStatus = String(order.marketplace_settlement_status || 'PENDING').toUpperCase()

    if (!needsReconciliation || settlementStatus === 'SETTLED_EXTERNAL' || !isMarketplaceCustomer || Number(order.total_amount || 0) <= 0) return false
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
  const excludedDuplicateOrders = candidateOrders
    .filter(order => {
      const receipt = normalizeMarketplaceReceipt(order.marketplace_receipt)
      return receipt && receiptCounts.get(receipt) > 1
    })
    .map(order => ({
      customer_name: (Array.isArray(order.customers) ? order.customers[0] : order.customers)?.name || null,
      date: order.date,
      marketplace_receipt: order.marketplace_receipt
    }))

  return {
    orders: ordersToProcess,
    excludedDuplicateCount: excludedDuplicateOrders.length,
    excludedDuplicateOrders
  }
}

async function runMarketplaceSettlement(settlementData, paymentMethod, settlementDate, { allowAboveInvoice = false } = {}) {
  try {
    const { supabase } = await requireMarketplaceAdmin()

    if (!Array.isArray(settlementData) || settlementData.length === 0 || !paymentMethod || !settlementDate) {
      throw new Error('Data pencairan marketplace belum lengkap.')
    }
    if (settlementData.length > 500 || settlementData.some(item => !item?.orderId || !Number.isFinite(Number(item.amount)) || Number(item.amount) <= 0)) {
      throw new Error('Data pencairan marketplace tidak valid.')
    }

    const orderIds = settlementData.map(d => d.orderId)

    // 1. Fetch orders — termasuk payment_status untuk duplicate guard
    const { data: orders, error: ordersErr } = await supabase
      .from('sales_orders')
      .select('id, invoice_number, total_amount, payment_status, marketplace_pencairan, marketplace_settlement_status, dp_amount, customers (name)')
      .in('id', orderIds)
    if (ordersErr) throw ordersErr
    const fetchedOrders = orders || []

    // Duplicate guard: filter hanya SO yang belum settled (payment_status !== 'LUNAS')
    const pendingOrders = fetchedOrders.filter(o => {
      const paymentStatus = String(o.payment_status || '').toUpperCase()
      const settlementStatus = String(o.marketplace_settlement_status || 'PENDING').toUpperCase()
      return paymentStatus !== 'LUNAS' && paymentStatus !== 'BATAL' && settlementStatus !== 'SETTLED_EXTERNAL'
    })
    if (pendingOrders.length === 0) {
      throw new Error('Semua pesanan yang dipilih sudah pernah dicairkan (LUNAS). Tidak ada yang diproses.')
    }

    // Hanya proses pendingOrders — abaikan yang sudah LUNAS
    const pendingIds = new Set(pendingOrders.map(o => o.id))
    const activePencairan = settlementData.filter(d => pendingIds.has(d.orderId))
    const settlementAmountByOrderId = new Map(activePencairan.map(item => [item.orderId, Number(item.amount)]))
    for (const order of pendingOrders) {
      const amount = settlementAmountByOrderId.get(order.id) || 0
      if (!isValidSettlementAmount(amount, order.total_amount, allowAboveInvoice)) {
        throw new Error(`Nominal pencairan untuk ${order.invoice_number} tidak valid.`)
      }
    }
    const totalPencairan = activePencairan.reduce((acc, curr) => acc + Number(curr.amount), 0)

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
    const gudangProducts = []
    const globalProducts = []

    await runInBatches(pendingOrders, 10, async order => {
      const pencairanAmount = settlementAmountByOrderId.get(order.id) || 0
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
    })

    const pendingOrderIds = pendingOrders.map(o => o.id)
    const allSettledItems = []
    for (let offset = 0; ; offset += 1000) {
      const { data: itemPage } = await supabase
        .from('sales_items')
        .select('id, so_id, beli_gudang, beli_global, royalty_fee, product_code, qty, unit, products(name)')
        .in('so_id', pendingOrderIds)
        .order('id', { ascending: true })
        .range(offset, offset + 999)
      allSettledItems.push(...(itemPage || []))
      if (!itemPage || itemPage.length < 1000) break
    }

    // Ambil item dalam satu query, lalu tetap gunakan nilai HPP yang tersimpan pada SO.
    for (const item of allSettledItems || []) {
      const warehouseAmount = Number(item.beli_gudang || 0)
      const globalAmount = Number(item.beli_global || 0)
      const royaltyAmount = Number(item.royalty_fee || 0)
      const productDetail = { name: item.products?.name || item.product_code, qty: item.qty, unit: item.unit }
      totalHppGudang += warehouseAmount
      totalHppGlobal += globalAmount
      virtualRoyaltyGlobal += royaltyAmount
      if (warehouseAmount > 0) gudangProducts.push(productDetail)
      if (globalAmount > 0 || royaltyAmount > 0) globalProducts.push(productDetail)
    }

    // 4. Record HPP ke Gudang
    if (totalHppGudang > 0) {
      await supabase.from('transactions').insert([
        {
          date: settlementDate,
          reference: null,
          description: formatVirtualProductDescription('GUDANG', gudangProducts),
          payment_method: 'Virtual',
          amount_in: totalHppGudang,
          amount_out: 0,
          workshop_code: 'GUDANG'
        },
        {
          date: settlementDate,
          reference: 'BAYAR KE GUDANG',
          description: formatVirtualProductDescription('KING KE GUDANG', gudangProducts),
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
          description: formatVirtualProductDescription('GLOBAL', globalProducts),
          payment_method: 'Virtual',
          amount_in: totalUntukGlobal,
          amount_out: 0,
          workshop_code: 'GLOBAL'
        },
        {
          date: settlementDate,
          reference: 'BAYAR KE GLOBAL',
          description: formatVirtualProductDescription('KING KE GLOBAL', globalProducts),
          payment_method: 'Virtual',
          amount_in: 0,
          amount_out: totalUntukGlobal,
          workshop_code: 'KING'
        }
      ])
    }

    // 6. Trigger auto status update untuk semua items di pending orders
    await runInBatches(allSettledItems || [], 10, item => handleAutoStatusUpdate(item.id))

    revalidatePath('/dashboard/marketplace')
    revalidatePath('/dashboard/transactions')
    revalidatePath('/dashboard/production')
    revalidatePath('/dashboard/sales')
    revalidatePath('/track')

    return {
      success: true,
      processed: pendingOrders.length,
      skipped: fetchedOrders.length - pendingOrders.length
    }
  } catch (err) {
    console.error(err)
    return { success: false, error: err.message }
  }
}

export async function processMarketplaceSettlement(settlementData, paymentMethod, settlementDate) {
  return runMarketplaceSettlement(settlementData, paymentMethod, settlementDate)
}

export async function previewQuickMarketplaceSettlement(cutoffDate, platform = 'ALL') {
  try {
    const { supabase } = await requireMarketplaceAdmin()
    const { orders, excludedDuplicateCount, excludedDuplicateOrders } = await getQuickSettlementOrders(supabase, cutoffDate, platform)

    return {
      success: true,
      count: orders.length,
      candidateCount: orders.length + excludedDuplicateCount,
      total: orders.reduce((sum, order) => sum + Number(order.total_amount || 0), 0),
      excludedDuplicateCount,
      excludedDuplicateOrders: excludedDuplicateOrders.slice(0, 20)
    }
  } catch (err) {
    console.error('Quick marketplace preview error:', err)
    return { success: false, error: err.message }
  }
}

export async function processQuickMarketplaceSettlement(cutoffDate, platform, paymentMethod, settlementDate) {
  try {
    const { supabase } = await requireMarketplaceAdmin()
    const { orders, excludedDuplicateCount } = await getQuickSettlementOrders(supabase, cutoffDate, platform)
    if (orders.length === 0) throw new Error('Tidak ada pesanan marketplace yang memenuhi filter.')

    const settlementData = orders.map(order => ({
      orderId: order.id,
      amount: Number(order.total_amount || 0),
      invoice_number: order.invoice_number
    }))

    const settlementResult = await runMarketplaceSettlement(settlementData, paymentMethod, settlementDate)
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
    .select('id, invoice_number, total_amount, payment_status, marketplace_pencairan, marketplace_settlement_status, marketplace_receipt, customers(name)')
    .not('marketplace_receipt', 'is', null)
    .neq('marketplace_receipt', '')
    .limit(5000)

  if (error) throw error
  return buildBulkSettlementRows(parsedRows, orders || [])
}

export async function previewBulkMarketplaceSettlement(rawText) {
  try {
    const { supabase } = await requireMarketplaceAdmin()
    const preview = await buildBulkSettlementPreview(supabase, rawText)
    return { success: true, ...preview }
  } catch (err) {
    console.error('Bulk marketplace preview error:', err)
    return { success: false, error: err.message }
  }
}

export async function processBulkMarketplaceSettlement(rawText, paymentMethod, settlementDate) {
  try {
    const { supabase } = await requireMarketplaceAdmin()
    const preview = await buildBulkSettlementPreview(supabase, rawText)
    const matchedRows = preview.rows.filter(row => row.status === 'COCOK')
    if (matchedRows.length === 0) throw new Error('Tidak ada baris yang cocok untuk diproses.')

    const settlementResult = await runMarketplaceSettlement(
      matchedRows.map(row => ({ orderId: row.orderId, amount: row.amount, invoice_number: row.invoiceNumber })),
      paymentMethod,
      settlementDate,
      { allowAboveInvoice: true }
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
  try {
    const { supabase } = await requireMarketplaceAdmin()
    const { error } = await supabase.from('sales_orders').update({ marketplace_receipt: receipt }).eq('id', orderId)
    if (error) throw error
    revalidatePath('/dashboard/marketplace')
    revalidatePath('/dashboard/sales')
    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export async function markMarketplaceOrdersSettledExternally(orderIds) {
  try {
    const { supabase } = await requireMarketplaceAdmin()
    const uniqueIds = [...new Set(Array.isArray(orderIds) ? orderIds.filter(Boolean) : [])]
    if (uniqueIds.length === 0 || uniqueIds.length > 500) {
      throw new Error('Pilih antara 1 sampai 500 order marketplace.')
    }

    const { data: orders, error: fetchError } = await supabase
      .from('sales_orders')
      .select('id, payment_status, marketplace_settlement_status, marketplace_receipt, customers(name, type)')
      .in('id', uniqueIds)
    if (fetchError) throw fetchError

    const eligibleIds = (orders || [])
      .filter(order => {
        const paymentStatus = String(order.payment_status || '').toUpperCase()
        const settlementStatus = String(order.marketplace_settlement_status || 'PENDING').toUpperCase()
        return paymentStatus !== 'LUNAS'
          && paymentStatus !== 'BATAL'
          && settlementStatus !== 'SETTLED_EXTERNAL'
          && isMarketplaceOrder(order)
      })
      .map(order => order.id)

    if (eligibleIds.length === 0) {
      throw new Error('Tidak ada order marketplace pending yang bisa ditandai.')
    }

    const { error: updateError } = await supabase
      .from('sales_orders')
      .update({ marketplace_settlement_status: 'SETTLED_EXTERNAL' })
      .in('id', eligibleIds)
    if (updateError) throw updateError

    revalidatePath('/dashboard/marketplace')
    revalidatePath('/dashboard/sales')
    return { success: true, processed: eligibleIds.length }
  } catch (error) {
    console.error('External marketplace settlement error:', error)
    return { success: false, error: error.message }
  }
}
