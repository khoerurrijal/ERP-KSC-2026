'use server'

import { isSablonProductionItem } from '@/utils/productionColorPasses.mjs'
import { createAuthorizedAdminClient } from '@/lib/adminAuth'
import { revalidatePath } from 'next/cache'
import { handleAutoStatusUpdate } from '@/app/dashboard/production/actions'
import { calculateDynamicHPP, calculateCostSnapshot } from '@/utils/pricing'
import { createAdminNotification } from '@/lib/adminNotifications'
import { formatVirtualProductDescription } from '@/utils/virtualTransactionDescription'
import { isKingInternalCustomerType, isKingInternalOrder, KING_INTERNAL_PURCHASE_MARKER } from '@/utils/kingInternalPurchase.mjs'
import {
  isLegacyFastTrackCode,
  isLegacySalesAddonCode,
  isLegacyTwoColorCode
} from '@/utils/legacySalesAddons.mjs'

export async function createSalesOrder(payload) {
  const { supabase } = await createAuthorizedAdminClient(['ADMIN', 'OWNER'])
  let createdSoId = null
  let createdKingInternal = false
  let createdKingItemIds = []

  try {
    const { customerId, orderDate, notes, items, dpAmount, paymentAccount, marketplaceReceipt, sourceRequestId, designService } = payload

    if (!customerId || !orderDate || !Array.isArray(items) || items.length === 0) {
      throw new Error('Customer, tanggal, dan minimal satu item wajib diisi.')
    }
    const { data: cust, error: customerError } = await supabase
      .from('customers')
      .select('name, type')
      .eq('customer_code', customerId)
      .single()
    if (customerError || !cust) throw new Error('Pelanggan tidak ditemukan.')
    const isKingInternal = isKingInternalCustomerType(cust.type)
    createdKingInternal = isKingInternal
    if (items.some(item => isLegacySalesAddonCode(item.product_id))) {
      throw new Error('Fast Track dan 2 Warna dipilih dari checklist pada item SABLON, bukan sebagai baris produk tambahan.')
    }
    const requestedDpAmount = Number(dpAmount || 0)
    if (!Number.isFinite(requestedDpAmount) || requestedDpAmount < 0) {
      throw new Error('Nominal DP tidak valid.')
    }
    const normalizedPaymentAccount = isKingInternal ? 'Virtual' : String(paymentAccount || '').trim()
    if (!isKingInternal && requestedDpAmount > 0 && !normalizedPaymentAccount) {
      throw new Error('Metode pembayaran wajib dipilih saat mencatat DP.')
    }
    for (const item of items) {
      const qty = Number(item.qty)
      const price = Number(item.price)
      const multiplier = Number(item.unit_multiplier || 1)
      if (!item.product_id || !Number.isFinite(qty) || qty <= 0 || !Number.isFinite(price) || price < 0 || !Number.isFinite(multiplier) || multiplier <= 0) {
        throw new Error('Detail item pesanan tidak valid.')
      }
    }
    if (isKingInternal && (designService || items.some(item => item.isFastTrack || item.isTwoColor))) {
      throw new Error('Pembelian internal KING hanya mencatat barang dan harga barang, tanpa jasa atau add-on produksi.')
    }

    const internalProducts = new Map()
    if (isKingInternal) {
      const quantitiesByProduct = new Map()
      for (const item of items) {
        const code = String(item.product_id || '').trim()
        const demand = Number(item.qty) * Number(item.unit_multiplier || 1)
        if (!Number.isSafeInteger(demand) || demand <= 0) {
          throw new Error('Qty pembelian KING harus menghasilkan jumlah stok bulat yang valid.')
        }
        quantitiesByProduct.set(code, (quantitiesByProduct.get(code) || 0) + demand)
      }

      for (const [code, demand] of quantitiesByProduct) {
        const { data: product, error: productError } = await supabase
          .from('products')
          .select('product_code, name, category, workshop_code, base_price, stock_qty, physical_stock, is_active')
          .eq('product_code', code)
          .single()
        if (productError || !product) throw new Error(`Produk ${code} tidak ditemukan.`)
        if (!['GUDANG', 'GLOBAL'].includes(String(product.workshop_code || '').trim().toUpperCase())) {
          throw new Error(`${product.name} bukan stok GUDANG/GLOBAL, jadi tidak bisa dibeli lewat SO internal KING.`)
        }
        if (product.is_active === false || ['JASA', 'JASA LAYANAN'].includes(String(product.category || '').trim().toUpperCase())) {
          throw new Error(`${product.name} bukan barang stok aktif.`)
        }
        if (Number(product.stock_qty || 0) < demand || Number(product.physical_stock || 0) < demand) {
          throw new Error(`Stok tersedia atau fisik ${product.name} tidak cukup untuk pembelian ini.`)
        }
        internalProducts.set(code, product)
      }
    }

    // Generate Invoice Number
    const dateStr = new Date().toISOString().split('T')[0].replace(/-/g, '')
    const randomStr = Math.floor(1000 + Math.random() * 9000)
    const invoiceNumber = `INV-${dateStr}-${randomStr}`

    // Calculate grand total
    const grandTotal = items.reduce((sum, item) => {
      let itemTotal = Number(item.qty) * Number(item.price);
      if (!isKingInternal && item.isFastTrack) {
        const qtyFastTrack = Math.ceil(Number(item.qty) * Number(item.unit_multiplier || 1) / 1000);
        itemTotal += 100000 * qtyFastTrack;
      }
      if (!isKingInternal && item.isTwoColor) {
        const actualQty = Number(item.qty) * Number(item.unit_multiplier || 1);
        itemTotal += 250 * actualQty;
      }
      return sum + itemTotal;
    }, 0) + (!isKingInternal && designService ? 50000 : 0)
    if (!isKingInternal && requestedDpAmount > grandTotal) throw new Error('DP tidak boleh melebihi total pesanan.')
    const normalizedDpAmount = isKingInternal ? grandTotal : requestedDpAmount
    const paymentStatus = isKingInternal ? 'LUNAS' : (normalizedDpAmount >= grandTotal ? 'LUNAS' : (normalizedDpAmount > 0 ? 'DP' : 'BELUM LUNAS'))
    const customerName = cust.name || customerId

    // Get profit margins from settings
    const { data: settings } = await supabase.from('system_settings').select('value').eq('key', 'pricelist_config').single();
    const pricelistConfig = settings?.value || {};
    const profitGudangNom = Number(pricelistConfig.profit_gudang_nominal || 0);
    const profitGlobalPct = Number(pricelistConfig.profit_global_percent || 0);

    // Pre-calculate HPP to save in sales_orders
    let totalHppGudang = 0;
    let totalHppGlobal = 0;
    let virtualRoyaltyGlobal = 0;
    const gudangProducts = []
    const globalProducts = []
    
    for (const item of items) {
      const { data: product } = isKingInternal
        ? { data: internalProducts.get(String(item.product_id || '').trim()) }
        : await supabase.from('products').select('workshop_code, base_price, category, name').eq('product_code', item.product_id).single();

      const dynamicHPP = await calculateDynamicHPP(supabase, item.product_id, product?.base_price || 0);
      
      const snapshot = calculateCostSnapshot({
        product,
        orderType: isKingInternal ? 'POLOS' : item.order_type,
        qty: item.qty,
        unitMultiplier: item.unit_multiplier,
        dynamicHPP,
        profitGudangNom,
        profitGlobalPct
      });

      const productDetail = { name: product?.name || item.product_id, qty: item.qty, unit: item.unit }
      let usesGlobal = Number(snapshot.royaltyFee || 0) > 0
      if (product) {
        if (product.workshop_code === 'GUDANG') {
          totalHppGudang += snapshot.beliGudang;
          if (Number(snapshot.beliGudang || 0) > 0) gudangProducts.push(productDetail)
        }
        if (product.workshop_code === 'GLOBAL') {
          totalHppGlobal += snapshot.beliGlobal - snapshot.royaltyFee;
          if (Number(snapshot.beliGlobal - snapshot.royaltyFee) > 0) usesGlobal = true
        }
      }
      virtualRoyaltyGlobal += snapshot.royaltyFee;
      if (usesGlobal) globalProducts.push(productDetail)
    }
    
    const finalBeliGlobal = totalHppGlobal + virtualRoyaltyGlobal;

    // 1. Insert Sales Order
    const salesOrderData = {
      invoice_number: invoiceNumber,
      marketplace_receipt: isKingInternal ? null : marketplaceReceipt || null,
      date: orderDate,
      customer_code: customerId,
      notes: notes,
      total_amount: grandTotal,
      dp_amount: normalizedDpAmount,
      payment_method: isKingInternal ? null : normalizedPaymentAccount || null,
      payment_status: paymentStatus,
    }
    if (sourceRequestId) salesOrderData.source_request_id = sourceRequestId

    const orderNotes = isKingInternal
      ? [KING_INTERNAL_PURCHASE_MARKER, notes].filter(Boolean).join('\n')
      : [notes, designService ? 'Jasa Desain Logo: Rp 50.000' : ''].filter(Boolean).join('\n')
    salesOrderData.notes = orderNotes

    const { data: so, error: soError } = await supabase
      .from('sales_orders')
      .insert(salesOrderData)
      .select()
      .single()

    if (soError) throw new Error('Gagal membuat pesanan: ' + soError.message)
    createdSoId = so.id

    // 2. Process Items
    const soItems = [];
    for (const item of items) {
      const { data: product } = isKingInternal
        ? { data: internalProducts.get(String(item.product_id || '').trim()) }
        : await supabase.from('products').select('workshop_code, base_price, category').eq('product_code', item.product_id).single();
      const dynamicHPP = await calculateDynamicHPP(supabase, item.product_id, product?.base_price || 0);

      const snapshot = calculateCostSnapshot({
        product,
        orderType: isKingInternal ? 'POLOS' : item.order_type,
        qty: item.qty,
        unitMultiplier: item.unit_multiplier,
        dynamicHPP,
        profitGudangNom,
        profitGlobalPct
      });

      
      // Royalty dipisah menjadi kolom sendiri (sesuai SOP baru)
      // Tidak lagi dicampur ke itemBeliGlobal

      let itemNotes = '';
      if (!isKingInternal && item.isFastTrack) itemNotes += '🔥 Fast Track\n';
      if (!isKingInternal && item.isTwoColor) itemNotes += '🎨 2 Warna\n';
      if (item.order_type?.toUpperCase() === 'PRINTING') {
        itemNotes += `🎨 Varian: ${item.printingColors || '3 Warna'}\n`;
      }

      soItems.push({
        so_id: so.id,
        order_type: isKingInternal ? 'POLOS' : item.order_type,
        product_code: item.product_id,
        status: isKingInternal ? 'SELESAI' : 'BARU MASUK',
        mockup_url: item.mockup_url,
        qty: Number(item.qty),
        unit: item.unit || 'PCS',
        unit_multiplier: item.unit_multiplier || 1,
        unit_price: Number(item.price),
        total_price: Number(item.qty) * Number(item.price),
        hpp_price: dynamicHPP,
        beli_gudang: snapshot.beliGudang,
        beli_global: snapshot.beliGlobal,
        royalty_fee: snapshot.royaltyFee,
        notes: itemNotes.trim()
      });
    }

    const { error: itemsError } = await supabase.from('sales_items').insert(soItems)
    if (itemsError) throw new Error('Gagal menyimpan item pesanan.')

    if (isKingInternal) {
      const { data: insertedItems, error: insertedItemsError } = await supabase
        .from('sales_items')
        .select('id')
        .eq('so_id', so.id)
      if (insertedItemsError || insertedItems?.length !== soItems.length) {
        throw new Error('Mutasi stok pembelian KING tidak dapat diverifikasi.')
      }
      createdKingItemIds = insertedItems.map(item => item.id)
      const { data: stockMutations, error: mutationRefError } = await supabase
        .from('stock_mutations')
        .update({ reference_number: 'PEMBELIAN INTERNAL KING' })
        .in('reference_id', createdKingItemIds)
        .select('id')
      if (mutationRefError || stockMutations?.length !== insertedItems.length) {
        throw new Error('Jejak mutasi stok pembelian KING tidak lengkap.')
      }
    }

    // 3. Consumer payments create bank/cash income. KING purchases are internal expenses.
    if (!isKingInternal && normalizedDpAmount > 0) {
      const { error: paymentError } = await supabase.from('transactions').insert({
        date: orderDate,
        reference: 'PENJUALAN',
        description: `Pembayaran ${paymentStatus} - ${customerName}`,
        payment_method: normalizedPaymentAccount,
        amount_in: normalizedDpAmount,
        amount_out: 0,
        workshop_code: 'KING',
        so_id: so.id
      })
      if (paymentError) throw new Error('Gagal mencatat pembayaran: ' + paymentError.message)
    }

    // If fully paid, we distribute the HPP to Gudang & Global + Virtual Royalty
    if (!isKingInternal && paymentStatus === 'LUNAS') {
      // Record HPP to Gudang
      if (totalHppGudang > 0) {
        const { error: hppInError } = await supabase.from('transactions').insert({
          date: orderDate,
          reference: null,
          description: formatVirtualProductDescription('GUDANG', gudangProducts),
          payment_method: 'Virtual',
          amount_in: totalHppGudang,
          workshop_code: 'GUDANG',
          so_id: so.id
        })
        if (hppInError) throw new Error('Gagal mencatat alokasi HPP Gudang: ' + hppInError.message)
        // King effectively "pays" this from its balance
        const { error: hppOutError } = await supabase.from('transactions').insert({
          date: orderDate,
          reference: 'BAYAR KE GUDANG',
          description: formatVirtualProductDescription('KING KE GUDANG', gudangProducts),
          payment_method: 'Virtual',
          amount_out: totalHppGudang,
          workshop_code: 'KING',
          so_id: so.id
        })
        if (hppOutError) throw new Error('Gagal mencatat potongan HPP Gudang: ' + hppOutError.message)
      }

      // Record HPP & Royalty to Global
      const totalUntukGlobal = totalHppGlobal + virtualRoyaltyGlobal
      if (totalUntukGlobal > 0) {
        const { error: globalInError } = await supabase.from('transactions').insert({
          date: orderDate,
          reference: null,
          description: formatVirtualProductDescription('GLOBAL', globalProducts),
          payment_method: 'Virtual',
          amount_in: totalUntukGlobal,
          workshop_code: 'GLOBAL',
          so_id: so.id
        })
        if (globalInError) throw new Error('Gagal mencatat alokasi HPP Global: ' + globalInError.message)
        const { error: globalOutError } = await supabase.from('transactions').insert({
          date: orderDate,
          reference: 'BAYAR KE GLOBAL',
          description: formatVirtualProductDescription('KING KE GLOBAL', globalProducts),
          payment_method: 'Virtual',
          amount_out: totalUntukGlobal,
          workshop_code: 'KING',
          so_id: so.id
        })
        if (globalOutError) throw new Error('Gagal mencatat potongan HPP Global: ' + globalOutError.message)
      }
    }

    if (isKingInternal && grandTotal > 0) {
      const salesBySource = new Map()
      for (const item of items) {
        const product = internalProducts.get(String(item.product_id || '').trim())
        const sourceWorkshop = String(product?.workshop_code || '').trim().toUpperCase()
        const sourceSale = salesBySource.get(sourceWorkshop) || { amount: 0, productNames: [] }
        sourceSale.amount += Number(item.qty) * Number(item.price)
        if (product?.name) sourceSale.productNames.push(product.name)
        salesBySource.set(sourceWorkshop, sourceSale)
      }

      const internalPurchaseTransactions = Array.from(salesBySource, ([sourceWorkshop, sourceSale]) => ({
        date: orderDate,
        reference: 'PENJUALAN INTERNAL KING',
        description: `Penjualan internal ke KING: ${sourceSale.productNames.join(', ')}`,
        payment_method: 'Virtual',
        amount_in: sourceSale.amount,
        amount_out: 0,
        workshop_code: sourceWorkshop,
        so_id: so.id
      })).filter(transaction => transaction.amount_in > 0)
      internalPurchaseTransactions.push({
        date: orderDate,
        reference: 'PEMBELIAN INTERNAL KING',
        description: `Pembelian internal KING dari ${Array.from(salesBySource.keys()).join(', ')}`,
        payment_method: 'Virtual',
        amount_in: 0,
        amount_out: grandTotal,
        workshop_code: 'KING',
        so_id: so.id
      })
      const { error: internalPurchaseError } = await supabase.from('transactions').insert(internalPurchaseTransactions)
      if (internalPurchaseError) throw new Error('Gagal mencatat pengeluaran virtual KING: ' + internalPurchaseError.message)
    }

    const { data: soItemsForStatus } = await supabase.from('sales_items').select('id').eq('so_id', so.id);
    if (!isKingInternal && soItemsForStatus) {
      for (const item of soItemsForStatus) {
        await handleAutoStatusUpdate(item.id);
      }
    }

    revalidatePath('/dashboard/sales')
    revalidatePath('/dashboard/transactions')
    revalidatePath('/dashboard/inventory')
    revalidatePath('/dashboard')
    
    return isKingInternal ? { success: true } : { success: true, invoice_number: invoiceNumber }

  } catch (error) {
    if (createdSoId) {
      try {
        await supabase.from('transactions').delete().eq('so_id', createdSoId)
        await supabase.from('sales_orders').delete().eq('id', createdSoId)
        if (createdKingInternal && createdKingItemIds.length) {
          await supabase.from('stock_mutations')
            .update({ reference_number: 'PEMBATALAN PEMBELIAN INTERNAL KING' })
            .in('reference_id', createdKingItemIds)
        }
      } catch (rollbackError) {
        console.error('Create Sales Order rollback error:', rollbackError)
      }
    }
    console.error('Create Sales Order Error:', error)
    return { success: false, error: error.message }
  }
}

export async function addSalesPayment(soId, paymentData) {
  const { amount: paymentAmount, method: paymentMethod, date: paymentDate } = paymentData;
  const { supabase } = await createAuthorizedAdminClient(['ADMIN', 'OWNER'])
  try {
    if (!soId || !String(paymentMethod || '').trim() || !paymentDate) throw new Error('Metode pembayaran dan tanggal wajib diisi.')
    const normalizedPaymentAmount = Number(paymentAmount)
    if (!Number.isFinite(normalizedPaymentAmount) || normalizedPaymentAmount <= 0) {
      throw new Error('Nominal pembayaran harus lebih dari 0.')
    }
    const { data: so, error: soError } = await supabase.from('sales_orders').select('*, customers(name, type)').eq('id', soId).single()
    if (soError) throw soError
    if (isKingInternalOrder(so)) throw new Error('Pembelian internal KING tidak menerima pembayaran pelanggan.')

    const currentPaid = Number(so.dp_amount || 0)
    const totalAmount = Number(so.total_amount || 0)
    const remaining = totalAmount - currentPaid

    // Guard 1: Sudah lunas, tolak pembayaran baru
    if (so.payment_status === 'LUNAS' || remaining <= 0) {
      throw new Error('Invoice sudah lunas. Tidak dapat menambah pembayaran lagi.')
    }

    // Guard 2: Overpayment — pembayaran melebihi sisa tagihan
    if (normalizedPaymentAmount > remaining) {
      throw new Error(`Pembayaran (Rp ${normalizedPaymentAmount.toLocaleString('id-ID', { maximumFractionDigits: 0 })}) melebihi sisa tagihan (Rp ${remaining.toLocaleString('id-ID', { maximumFractionDigits: 0 })}). Kurangi nominal pembayaran.`)
    }

    const newDpAmount = currentPaid + normalizedPaymentAmount
    // Gunakan exact payment_status values yang ada di sistem: BELUM LUNAS / DP / LUNAS
    const paymentStatus = newDpAmount >= totalAmount ? 'LUNAS' : (newDpAmount > 0 ? 'DP' : 'BELUM LUNAS')

    // Update SO
    const { error: paymentUpdateError } = await supabase.from('sales_orders').update({
      dp_amount: newDpAmount,
      payment_status: paymentStatus
    }).eq('id', soId)
    if (paymentUpdateError) throw paymentUpdateError

    if (paymentStatus !== so.payment_status) {
      await createAdminNotification(supabase, {
        notificationType: 'PAYMENT_STATUS',
        title: paymentStatus === 'LUNAS' ? 'Pelunasan dicatat' : 'Pembayaran pesanan berubah',
        message: `${so.invoice_number}: ${so.payment_status || 'BELUM LUNAS'} → ${paymentStatus}.`,
        href: `/sales?orderId=${encodeURIComponent(soId)}`,
        entityId: soId
      })
    }


    // Insert Transaction
    const { error: paymentTransactionError } = await supabase.from('transactions').insert({
      date: paymentDate,
      reference: 'PENJUALAN',
      description: paymentStatus,
      payment_method: String(paymentMethod).trim(),
      amount_in: normalizedPaymentAmount,
      amount_out: 0,
      workshop_code: 'KING',
      so_id: so.id
    })
    if (paymentTransactionError) throw paymentTransactionError

    // If it becomes LUNAS just now, distribute HPP!
    if (paymentStatus === 'LUNAS' && so.payment_status !== 'LUNAS') {
      const { data: items } = await supabase.from('sales_items').select('beli_gudang, beli_global, royalty_fee, product_code, qty, unit, products(name)').eq('so_id', so.id)
      
      let totalHppGudang = 0
      let totalUntukGlobal = 0
      const gudangProducts = []
      const globalProducts = []

      if (items) {
        items.forEach(item => {
          const warehouseAmount = Number(item.beli_gudang || 0)
          const globalAmount = Number(item.beli_global || 0)
          const royaltyAmount = Number(item.royalty_fee || 0)
          const productDetail = { name: item.products?.name || item.product_code, qty: item.qty, unit: item.unit }
          totalHppGudang += warehouseAmount
          totalUntukGlobal += globalAmount + royaltyAmount
          if (warehouseAmount > 0) gudangProducts.push(productDetail)
          if (globalAmount > 0 || royaltyAmount > 0) globalProducts.push(productDetail)
        })
      }

      // Record HPP to Gudang
      if (totalHppGudang > 0) {
        await supabase.from('transactions').insert([
          { date: paymentDate, description: formatVirtualProductDescription('GUDANG', gudangProducts), payment_method: 'Virtual', amount_in: totalHppGudang, workshop_code: 'GUDANG', so_id: so.id },
          { date: paymentDate, reference: 'BAYAR KE GUDANG', description: formatVirtualProductDescription('KING KE GUDANG', gudangProducts), payment_method: 'Virtual', amount_out: totalHppGudang, workshop_code: 'KING', so_id: so.id }
        ])
      }

      // Record HPP & Royalty to Global
      if (totalUntukGlobal > 0) {
        await supabase.from('transactions').insert([
          { date: paymentDate, description: formatVirtualProductDescription('GLOBAL', globalProducts), payment_method: 'Virtual', amount_in: totalUntukGlobal, workshop_code: 'GLOBAL', so_id: so.id },
          { date: paymentDate, reference: 'BAYAR KE GLOBAL', description: formatVirtualProductDescription('KING KE GLOBAL', globalProducts), payment_method: 'Virtual', amount_out: totalUntukGlobal, workshop_code: 'KING', so_id: so.id }
        ])
      }
    }

    // Trigger auto status update for all items in this SO
    const { data: soItemsForStatus } = await supabase.from('sales_items').select('id').eq('so_id', so.id);
    if (soItemsForStatus) {
      for (const item of soItemsForStatus) {
        await handleAutoStatusUpdate(item.id);
      }
    }

    revalidatePath('/dashboard/sales')
    revalidatePath('/dashboard/transactions')
    return { success: true }
  } catch (err) {
    console.error('Add Sales Payment Error:', err)
    return { success: false, error: err.message }
  }
}

export async function updateSalesOrder(soId, payload) {
  const { supabase } = await createAuthorizedAdminClient(['ADMIN', 'OWNER'])

  try {
    const { customerId, orderDate, notes, items, dpAmount, paymentAccount, marketplaceReceipt } = payload

    if (!soId || !customerId || !orderDate || !Array.isArray(items) || items.length === 0) {
      throw new Error('Customer, tanggal, dan minimal satu item wajib diisi.')
    }
    const { data: existingOrderForType, error: existingSoError } = await supabase
      .from('sales_orders')
      .select('notes, customers(type)')
      .eq('id', soId)
      .single()
    if (existingSoError || !existingOrderForType) throw new Error('Pesanan tidak ditemukan.')
    const { data: targetCustomer, error: targetCustomerError } = await supabase
      .from('customers')
      .select('type')
      .eq('customer_code', customerId)
      .single()
    if (targetCustomerError || !targetCustomer) throw new Error('Pelanggan tidak ditemukan.')
    if (isKingInternalOrder(existingOrderForType) || isKingInternalCustomerType(targetCustomer.type)) {
      throw new Error('Pembelian internal KING tidak dapat diubah lewat edit SO. Batalkan hanya jika barang benar-benar dikembalikan ke stok asal.')
    }
    for (const item of items) {
      const qty = Number(item.qty)
      const price = Number(item.price)
      const multiplier = Number(item.unit_multiplier || 1)
      if (!item.product_id || !Number.isFinite(qty) || qty <= 0 || !Number.isFinite(price) || price < 0 || !Number.isFinite(multiplier) || multiplier <= 0) {
        throw new Error('Detail item pesanan tidak valid.')
      }
    }

    const grandTotal = items.reduce((sum, item) => {
      let itemTotal = Number(item.qty) * Number(item.price);
      if (item.isFastTrack) {
        const qtyFastTrack = Math.ceil(Number(item.qty) * Number(item.unit_multiplier || 1) / 1000);
        itemTotal += 100000 * qtyFastTrack;
      }
      if (item.isTwoColor) {
        const actualQty = Number(item.qty) * Number(item.unit_multiplier || 1);
        itemTotal += 250 * actualQty;
      }
      return sum + itemTotal;
    }, 0)

    const { data: existingSo } = await supabase.from('sales_orders').select('dp_amount, invoice_number, date').eq('id', soId).single()
    const currentDbDpAmount = Number(existingSo?.dp_amount || 0)
    const invoiceNumber = existingSo?.invoice_number || `INV-${soId}`
    const orderOriginalDate = existingSo?.date || orderDate

    // Recalculate payment_status berdasarkan paid aktual vs total baru
    // Jika paid > total baru (total diedit turun), status LUNAS tanpa buat refund/kredit
    const paymentStatus = currentDbDpAmount >= grandTotal ? 'LUNAS' : (currentDbDpAmount > 0 ? 'DP' : 'BELUM LUNAS')

    // Get profit margins from settings
    const { data: settings } = await supabase.from('system_settings').select('value').eq('key', 'pricelist_config').single();
    const pricelistConfig = settings?.value || {};
    const profitGudangNom = Number(pricelistConfig.profit_gudang_nominal || 0);
    const profitGlobalPct = Number(pricelistConfig.profit_global_percent || 0);

    let totalBeliGudang = 0
    let totalBeliGlobal = 0
    let virtualRoyaltyGlobal = 0
    const gudangProducts = []
    const globalProducts = []
    
    const preparedItems = []
    const legacyAddons = items.filter(item => isLegacySalesAddonCode(item.product_id))
    const baseItems = items.filter(item => !isLegacySalesAddonCode(item.product_id))
    const legacyAppliesToItem = (addon, product) => {
      if (baseItems.length === 1) return true
      const productName = (product?.name || '').toLowerCase()
      const addonNotes = (addon.notes || '').toLowerCase()
      return Boolean(productName && addonNotes.includes(productName))
    }

    for (const item of items) {
      const productCode = String(item.product_id || '').toUpperCase()
      if (isLegacySalesAddonCode(productCode)) continue

      const { data: product } = await supabase.from('products').select('workshop_code, base_price, category, name').eq('product_code', item.product_id).single()
      
      const dynamicHPP = await calculateDynamicHPP(supabase, item.product_id, product?.base_price || 0)
      
      const snapshot = calculateCostSnapshot({
        product,
        orderType: item.order_type,
        qty: item.qty,
        unitMultiplier: item.unit_multiplier,
        dynamicHPP,
        profitGudangNom,
        profitGlobalPct
      });

      const productDetail = { name: product?.name || item.product_id, qty: item.qty, unit: item.unit }
      let usesGlobal = Number(snapshot.royaltyFee || 0) > 0
      if (product) {
        if (product.workshop_code === 'GUDANG') {
          totalBeliGudang += snapshot.beliGudang
          if (Number(snapshot.beliGudang || 0) > 0) gudangProducts.push(productDetail)
        }
        if (product.workshop_code === 'GLOBAL') {
          const globalHpp = snapshot.beliGlobal - snapshot.royaltyFee
          totalBeliGlobal += globalHpp
          if (Number(globalHpp || 0) > 0) usesGlobal = true
        }
      }
      virtualRoyaltyGlobal += snapshot.royaltyFee
      if (usesGlobal) globalProducts.push(productDetail)

      const legacyFastTrack = legacyAddons.some(addon => isLegacyFastTrackCode(addon.product_id) && legacyAppliesToItem(addon, product))
      const legacyTwoColor = legacyAddons.some(addon => isLegacyTwoColorCode(addon.product_id) && legacyAppliesToItem(addon, product))
      const isFastTrack = Boolean(item.isFastTrack) || legacyFastTrack
      const isTwoColor = Boolean(item.isTwoColor) || legacyTwoColor

      let itemNotes = item.notes || '';
      itemNotes = itemNotes
        .replace(/Fast Track\s*\n?/gi, '')
        .replace(/2 Warna\s*\n?/gi, '')
        .trim();
      if (isFastTrack) itemNotes = `🔥 Fast Track\n${itemNotes}`.trim();
      if (isTwoColor) itemNotes = `🎨 2 Warna\n${itemNotes}`.trim();

      const isExisting = String(item.id).length > 20;

      const preparedItem = {
        so_id: soId,
        order_type: item.order_type,
        product_code: item.product_id,
        mockup_url: item.mockup_url,
        qty: Number(item.qty),
        unit: item.unit || 'PCS',
        unit_multiplier: item.unit_multiplier || 1,
        unit_price: Number(item.price),
        total_price: Number(item.qty) * Number(item.price),
        hpp_price: dynamicHPP,
        beli_gudang: snapshot.beliGudang,
        beli_global: snapshot.beliGlobal,
        royalty_fee: snapshot.royaltyFee,
        notes: itemNotes.trim()
      }

      if (isExisting) {
        preparedItem.id = item.id;
      } else {
        preparedItem.id = crypto.randomUUID();
        preparedItem.status = 'BARU MASUK';
      }

      preparedItems.push(preparedItem)
    }

    const finalBeliGlobal = totalBeliGlobal + virtualRoyaltyGlobal

    const { error: soError } = await supabase
      .from('sales_orders')
      .update({
        marketplace_receipt: marketplaceReceipt || null,
        date: orderDate,
        customer_code: customerId,
        notes: notes,
        total_amount: grandTotal,
        payment_method: paymentAccount,
        payment_status: paymentStatus
      })
      .eq('id', soId)

    if (soError) throw new Error('Gagal update pesanan: ' + soError.message)

    const existingItemIds = preparedItems.filter(i => String(i.id).length > 20).map(i => i.id);

    const { data: currentDbItems } = await supabase.from('sales_items').select('id').eq('so_id', soId);
    if (currentDbItems) {
      const idsToDelete = currentDbItems.map(i => i.id).filter(id => !existingItemIds.includes(id));
      if (idsToDelete.length > 0) {
        await supabase.from('sales_items').delete().in('id', idsToDelete);
      }
    }

    const { error: itemsError } = await supabase.from('sales_items').upsert(preparedItems)
    if (itemsError) throw new Error('Gagal update item pesanan: ' + itemsError.message)

    // RECREATE VIRTUAL TRANSACTIONS IF LUNAS TO PREVENT LEDGER LEAK
    if (paymentStatus === 'LUNAS') {
      await supabase.from('transactions').delete().eq('so_id', soId).eq('payment_method', 'Virtual');

      if (totalBeliGudang > 0) {
        await supabase.from('transactions').insert([
          { date: orderOriginalDate, description: formatVirtualProductDescription('GUDANG', gudangProducts), payment_method: 'Virtual', amount_in: totalBeliGudang, workshop_code: 'GUDANG', so_id: soId },
          { date: orderOriginalDate, reference: 'BAYAR KE GUDANG', description: formatVirtualProductDescription('KING KE GUDANG', gudangProducts), payment_method: 'Virtual', amount_out: totalBeliGudang, workshop_code: 'KING', so_id: soId }
        ]);
      }
      if (finalBeliGlobal > 0) {
        await supabase.from('transactions').insert([
          { date: orderOriginalDate, description: formatVirtualProductDescription('GLOBAL', globalProducts), payment_method: 'Virtual', amount_in: finalBeliGlobal, workshop_code: 'GLOBAL', so_id: soId },
          { date: orderOriginalDate, reference: 'BAYAR KE GLOBAL', description: formatVirtualProductDescription('KING KE GLOBAL', globalProducts), payment_method: 'Virtual', amount_out: finalBeliGlobal, workshop_code: 'KING', so_id: soId }
        ]);
      }
    }

    const { data: soItemsForStatus } = await supabase.from('sales_items').select('id').eq('so_id', soId);
    if (soItemsForStatus) {
      for (const item of soItemsForStatus) {
        await handleAutoStatusUpdate(item.id);
      }
    }

    revalidatePath('/dashboard/sales')
    revalidatePath('/dashboard/transactions')
    
    return { success: true }
  } catch (error) {
    console.error('Update Sales Order Error:', error)
    return { success: false, error: error.message }
  }
}

export async function updateMockupUrl(itemId, mockupUrl) {
  const { supabase } = await createAuthorizedAdminClient(['ADMIN', 'OWNER'])
  try {
    if (!itemId || typeof mockupUrl !== 'string' || mockupUrl.length > 2000) throw new Error('URL mockup tidak valid.')
    const { error } = await supabase
      .from('sales_items')
      .update({ mockup_url: mockupUrl })
      .eq('id', itemId)
    
    if (error) throw error;
    
    revalidatePath('/dashboard/production')
    revalidatePath('/dashboard/sales')
    return { success: true }
  } catch (e) {
    console.error('Error update mockup url:', e)
    return { success: false, error: e.message }
  }
}

export async function updateSalesItemStatus(itemId, newStatus) {
  const { supabase } = await createAuthorizedAdminClient(['ADMIN', 'OWNER'])
  try {
    if (!itemId || typeof newStatus !== 'string' || !newStatus.trim()) throw new Error('Status item tidak valid.')
    const { data: item, error: fetchErr } = await supabase
      .from('sales_items')
      .select('*, products(name), sales_orders(invoice_number, payment_status, notes, customers(type))')
      .eq('id', itemId)
      .single()
    
    if (fetchErr || !item) throw new Error("Item tidak ditemukan")
    if (isKingInternalOrder(item.sales_orders)) throw new Error('Pembelian internal KING sudah selesai dan tidak masuk status produksi.')

    if (['DLL', 'JASA'].includes(String(item.order_type || '').toUpperCase()) && !isSablonProductionItem(item)) {
      throw new Error('Item layanan tidak memiliki status produksi.')
    }

    const oldStatus = (item.status || 'BARU MASUK').toUpperCase()
    const targetStatus = newStatus.toUpperCase()

    // Guard 1: Terminal BATAL state cannot be changed
    if (oldStatus === 'BATAL' && targetStatus !== 'BATAL') {
      throw new Error("Item yang sudah dibatalkan tidak bisa diubah statusnya.")
    }

    if (['DIKIRIM', 'SUDAH DIAMBIL', 'SELESAI'].includes(targetStatus) && targetStatus !== oldStatus) {
      throw new Error('Status pengiriman hanya dapat dikonfirmasi dari halaman Konfirmasi Pengiriman.')
    }

    // Relaxed guard: User can update to any valid status.
    // If we want to enforce strict workflow, we can do it here, but for flexibility, we allow it.

    const { error } = await supabase
      .from('sales_items')
      .update({ status: newStatus })
      .eq('id', itemId)
    
    if (error) throw new Error(error.message)

    if (oldStatus !== targetStatus) {
      await createAdminNotification(supabase, {
        notificationType: 'PRODUCTION_STATUS',
        title: 'Status produksi berubah',
        message: `${item?.sales_orders?.invoice_number || 'Pesanan'}: ${oldStatus} → ${targetStatus}.`,
        href: '/dashboard/production',
        entityId: itemId
      })
    }

    revalidatePath('/dashboard/sales')
    revalidatePath('/dashboard/production')
    revalidatePath('/track')
    return { success: true }
  } catch (error) {
    console.error('Update item status error:', error)
    return { success: false, error: error.message }
  }
}

export async function cancelSalesOrder(soId) {
  const { supabase } = await createAuthorizedAdminClient(['ADMIN', 'OWNER'])

  try {
    const { data: order, error: orderError } = await supabase
      .from('sales_orders')
      .select('notes, customers(type)')
      .eq('id', soId)
      .single()
    if (orderError || !order) throw new Error('Pesanan tidak ditemukan.')
    const isKingInternal = isKingInternalOrder(order)
    const { data: existingItems, error: existingItemsError } = await supabase
      .from('sales_items')
      .select('id')
      .eq('so_id', soId)
    if (existingItemsError) throw existingItemsError

    // 1. Ubah status semua item menjadi BATAL
    const { error: itemsErr } = await supabase.from('sales_items')
      .update({ status: 'BATAL' })
      .eq('so_id', soId)
    if (itemsErr) throw new Error(itemsErr.message)

    if (isKingInternal && existingItems?.length) {
      const { error: mutationRefError } = await supabase
        .from('stock_mutations')
        .update({ reference_number: 'PEMBATALAN PEMBELIAN INTERNAL KING' })
        .in('reference_id', existingItems.map(item => item.id))
      if (mutationRefError) console.error('Gagal memberi label mutasi pembatalan KING:', mutationRefError)
    }

    // 2. Ubah status pembayaran invoice menjadi BATAL
    const { error: soErr } = await supabase.from('sales_orders')
      .update({ payment_status: 'BATAL' })
      .eq('id', soId)
    if (soErr) throw new Error(soErr.message)

    // 3. Hapus transaksi alokasi HPP Virtual, dan beri penanda [DIBATALKAN] pada transaksi kas fisik
    const { error: virtualErr } = await supabase.from('transactions')
      .delete()
      .eq('so_id', soId)
      .eq('payment_method', 'Virtual')
    if (virtualErr) console.error('Error deleting virtual tx:', virtualErr)

    const { data: realTx } = await supabase.from('transactions')
      .select('id, description')
      .eq('so_id', soId)
      .neq('payment_method', 'Virtual')
    
    if (realTx && realTx.length > 0) {
      for (const tx of realTx) {
        if (!tx.description?.includes('[DIBATALKAN]')) {
          await supabase.from('transactions')
            .update({ description: `[DIBATALKAN] ${tx.description}` })
            .eq('id', tx.id)
        }
      }
    }

    revalidatePath('/dashboard/sales')
    revalidatePath('/dashboard/inventory')
    revalidatePath('/dashboard/report')
    revalidatePath('/dashboard/transactions')
    return { success: true }
  } catch (error) {
    console.error('Cancel Sales Order error:', error)
    return { success: false, error: error.message }
  }
}
