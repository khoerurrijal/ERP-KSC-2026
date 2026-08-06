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

async function getQuickSettlementOrders(supabase, cutoffDate, platform = 'ALL') {
  if (!cutoffDate) throw new Error('Tanggal batas order wajib diisi.')

  const { data: orders, error } = await supabase
    .from('sales_orders')
    .select('id, invoice_number, total_amount, payment_status, marketplace_pencairan, date, marketplace_receipt, customers(name)')
    .not('marketplace_receipt', 'is', null)
    .neq('marketplace_receipt', '')
    .lte('date', cutoffDate)
    .order('date', { ascending: true })
    .limit(5000)

  if (error) throw error

  const selectedPlatform = String(platform || 'ALL').toUpperCase()
  const candidateOrders = (orders || []).filter(order => {
    const paymentStatus = String(order.payment_status || '').toUpperCase()
    const payoutMissing = Number(order.marketplace_pencairan || 0) <= 0
    const customer = Array.isArray(order.customers) ? order.customers[0] : order.customers
    const customerName = String(customer?.name || '').toLowerCase()
    const isKnownPlatform = ['shopee', 'tokopedia', 'tiktok'].some(name => customerName.includes(name))
    const needsReconciliation = paymentStatus !== 'BATAL' && (paymentStatus !== 'LUNAS' || payoutMissing)

    if (!needsReconciliation || Number(order.total_amount || 0) <= 0) return false
    if (selectedPlatform === 'ALL') return true
    if (selectedPlatform === 'LAINNYA') return !isKnownPlatform
    return customerName.includes(selectedPlatform.toLowerCase())
  })

  const receiptCounts = new Map()
  candidateOrders.forEach(order => {
    const receipt = String(order.marketplace_receipt || '').trim().toUpperCase()
    receiptCounts.set(receipt, (receiptCounts.get(receipt) || 0) + 1)
  })

  const ordersToProcess = candidateOrders.filter(order => {
    const receipt = String(order.marketplace_receipt || '').trim().toUpperCase()
    return receiptCounts.get(receipt) === 1
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
    const pendingOrders = orders.filter(o => o.payment_status !== 'LUNAS')
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

async function processMarketplacePayoutBackfill(supabase, orders, paymentMethod, settlementDate) {
  if (orders.length === 0) return { processed: 0 }

  const marketplaceNames = new Set()
  orders.forEach(order => {
    const customer = Array.isArray(order.customers) ? order.customers[0] : order.customers
    const customerName = String(customer?.name || '').toLowerCase()
    if (customerName.includes('shopee')) marketplaceNames.add('Shopee')
    else if (customerName.includes('tokopedia')) marketplaceNames.add('Tokopedia')
    else if (customerName.includes('tiktok')) marketplaceNames.add('TikTok')
    else marketplaceNames.add('Marketplace')
  })

  const totalPayout = orders.reduce((sum, order) => sum + Number(order.total_amount || 0), 0)
  const invoiceList = orders.map(order => order.invoice_number).join(', ')
  const { error: transactionError } = await supabase.from('transactions').insert({
    date: settlementDate,
    reference: 'PENJUALAN',
    description: `Backfill Pencairan ${Array.from(marketplaceNames).join(', ')} - ${invoiceList}`,
    payment_method: paymentMethod,
    amount_in: totalPayout,
    amount_out: 0,
    workshop_code: 'KING'
  })

  if (transactionError) throw transactionError

  for (const order of orders) {
    const { error: updateError } = await supabase
      .from('sales_orders')
      .update({ marketplace_pencairan: Number(order.total_amount || 0) })
      .eq('id', order.id)

    if (updateError) throw updateError
  }

  revalidatePath('/dashboard/marketplace')
  revalidatePath('/dashboard/transactions')
  revalidatePath('/dashboard/production')
  revalidatePath('/dashboard/sales')
  revalidatePath('/track')
  return { processed: orders.length }
}

export async function processQuickMarketplaceSettlement(cutoffDate, platform, paymentMethod, settlementDate) {
  const supabase = await createClient()

  try {
    await requireMarketplaceAdmin(supabase)
    const { orders, excludedDuplicateCount } = await getQuickSettlementOrders(supabase, cutoffDate, platform)
    if (orders.length === 0) throw new Error('Tidak ada pesanan marketplace yang memenuhi filter.')

    const pendingOrders = orders.filter(order => String(order.payment_status || '').toUpperCase() !== 'LUNAS')
    const alreadyLunasOrders = orders.filter(order => String(order.payment_status || '').toUpperCase() === 'LUNAS')
    let processed = 0

    if (pendingOrders.length > 0) {
      const settlementData = pendingOrders.map(order => ({
        orderId: order.id,
        amount: Number(order.total_amount || 0),
        invoice_number: order.invoice_number
      }))

      const settlementResult = await processMarketplaceSettlement(settlementData, paymentMethod, settlementDate)
      if (!settlementResult.success) throw new Error(settlementResult.error)
      processed += settlementResult.processed || 0
    }

    if (alreadyLunasOrders.length > 0) {
      const backfillResult = await processMarketplacePayoutBackfill(supabase, alreadyLunasOrders, paymentMethod, settlementDate)
      processed += backfillResult.processed || 0
    }

    return {
      success: true,
      processed,
      pendingProcessed: pendingOrders.length,
      payoutBackfilled: alreadyLunasOrders.length,
      excludedDuplicateCount
    }
  } catch (err) {
    console.error('Quick marketplace settlement error:', err)
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
