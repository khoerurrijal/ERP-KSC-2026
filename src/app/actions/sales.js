'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { handleAutoStatusUpdate } from '@/app/dashboard/production/actions'
import { calculateDynamicHPP, calculateCostSnapshot } from '@/utils/pricing'

export async function createSalesOrder(payload) {
  const supabase = await createClient()

  try {
    const { customerId, orderDate, notes, items, dpAmount, paymentAccount, marketplaceReceipt } = payload

    // Generate Invoice Number
    const dateStr = new Date().toISOString().split('T')[0].replace(/-/g, '')
    const randomStr = Math.floor(1000 + Math.random() * 9000)
    const invoiceNumber = `INV-${dateStr}-${randomStr}`

    // Calculate grand total
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
    const paymentStatus = dpAmount >= grandTotal ? 'LUNAS' : (dpAmount > 0 ? 'DP' : 'BELUM LUNAS')

    // Get customer name
    const { data: cust } = await supabase.from('customers').select('name').eq('customer_code', customerId).single()
    const customerName = cust ? cust.name : customerId

    // Get profit margins from settings
    const { data: settings } = await supabase.from('system_settings').select('value').eq('key', 'pricelist_config').single();
    const pricelistConfig = settings?.value || {};
    const profitGudangNom = Number(pricelistConfig.profit_gudang_nominal || 0);
    const profitGlobalPct = Number(pricelistConfig.profit_global_percent || 0);

    // Pre-calculate HPP to save in sales_orders
    let totalHppGudang = 0;
    let totalHppGlobal = 0;
    let virtualRoyaltyGlobal = 0;
    
    for (const item of items) {
      const { data: product } = await supabase.from('products').select('workshop_code, base_price, category').eq('product_code', item.product_id).single();

      const dynamicHPP = await calculateDynamicHPP(supabase, item.product_id, product?.base_price || 0);
      
      const snapshot = calculateCostSnapshot({
        product,
        orderType: item.order_type,
        qty: item.qty,
        unitMultiplier: item.unit_multiplier,
        dynamicHPP,
        profitGudangNom,
        profitGlobalPct
      });

      if (product) {
        if (product.workshop_code === 'GUDANG') {
          totalHppGudang += snapshot.beliGudang;
        }
        if (product.workshop_code === 'GLOBAL') {
          totalHppGlobal += snapshot.beliGlobal - snapshot.royaltyFee;
        }
      }
      virtualRoyaltyGlobal += snapshot.royaltyFee;
    }
    
    const finalBeliGlobal = totalHppGlobal + virtualRoyaltyGlobal;

    // 1. Insert Sales Order
    const { data: so, error: soError } = await supabase
      .from('sales_orders')
      .insert({
        invoice_number: invoiceNumber,
        marketplace_receipt: marketplaceReceipt || null,
        date: orderDate,
        customer_code: customerId,
        notes: notes,
        total_amount: grandTotal,
        dp_amount: dpAmount,
        payment_method: paymentAccount,
        payment_status: paymentStatus,
        status: 'PROSES'
      })
      .select()
      .single()

    if (soError) throw new Error('Gagal membuat pesanan: ' + soError.message)

    // 2. Process Items
    const soItems = [];
    for (const item of items) {
      const { data: product } = await supabase.from('products').select('workshop_code, base_price, category').eq('product_code', item.product_id).single();
      const dynamicHPP = await calculateDynamicHPP(supabase, item.product_id, product?.base_price || 0);

      const snapshot = calculateCostSnapshot({
        product,
        orderType: item.order_type,
        qty: item.qty,
        unitMultiplier: item.unit_multiplier,
        dynamicHPP,
        profitGudangNom,
        profitGlobalPct
      });

      
      // Royalty dipisah menjadi kolom sendiri (sesuai SOP baru)
      // Tidak lagi dicampur ke itemBeliGlobal

      let itemNotes = '';
      if (item.isFastTrack) itemNotes += '🔥 Fast Track\n';
      if (item.order_type?.toUpperCase() === 'PRINTING') {
        itemNotes += `🎨 Varian: ${item.printingColors || '3 Warna'}\n`;
      }
      
      const productNameForNotes = item.product_search || product?.name || item.product_id;

      soItems.push({
        so_id: so.id,
        order_type: item.order_type,
        product_code: item.product_id,
        status: 'BARU MASUK',
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

      if (item.isFastTrack) {
        const qtyFastTrack = Math.ceil(Number(item.qty) * Number(item.unit_multiplier || 1) / 1000);
        soItems.push({
          so_id: so.id,
          order_type: 'POLOS', // don't show in production
          product_code: 'SRV-FAST-TRACK',
          status: 'BARU MASUK',
          qty: qtyFastTrack,
          unit: 'Layanan',
          unit_multiplier: 1,
          unit_price: 100000,
          total_price: 100000 * qtyFastTrack,
          hpp_price: 0,
          beli_gudang: 0,
          beli_global: 0,
          royalty_fee: 0,
          notes: `Untuk ${productNameForNotes}`
        });
      }

      if (item.isTwoColor) {
        const actualQty = Number(item.qty) * Number(item.unit_multiplier || 1);
        soItems.push({
          so_id: so.id,
          order_type: 'SABLON', // SHOW in production
          product_code: 'SRV-2-WARNA',
          status: 'BARU MASUK',
          qty: actualQty,
          unit: 'Pcs',
          unit_multiplier: 1,
          unit_price: 250,
          total_price: 250 * actualQty,
          hpp_price: 0,
          beli_gudang: 0,
          beli_global: 0,
          royalty_fee: 0,
          notes: `Untuk ${productNameForNotes} - Warna Ke-2`
        });
      }
    }

    const { error: itemsError } = await supabase.from('sales_items').insert(soItems)
    if (itemsError) throw new Error('Gagal menyimpan item pesanan.')

    // 3. Transactions Splitting Logic (If any payment is made)
    // We record the incoming cash to KING
    if (dpAmount > 0) {
      await supabase.from('transactions').insert({
        date: orderDate,
        reference: 'PENJUALAN',
        description: `Pembayaran ${paymentStatus} - ${customerName}`,
        payment_method: paymentAccount,
        amount_in: dpAmount,
        amount_out: 0,
        workshop_code: 'KING',
        so_id: so.id
      })
    }

    // If fully paid, we distribute the HPP to Gudang & Global + Virtual Royalty
    if (paymentStatus === 'LUNAS') {
      // Record HPP to Gudang
      if (totalHppGudang > 0) {
        await supabase.from('transactions').insert({
          date: orderDate,
          reference: null,
          description: `Alokasi HPP Cup/Barang Gudang - ${invoiceNumber}`,
          payment_method: 'Virtual',
          amount_in: totalHppGudang,
          workshop_code: 'GUDANG',
          so_id: so.id
        })
        // King effectively "pays" this from its balance
        await supabase.from('transactions').insert({
          date: orderDate,
          reference: null,
          description: `Potongan HPP untuk Gudang - ${invoiceNumber}`,
          payment_method: 'Virtual',
          amount_out: totalHppGudang,
          workshop_code: 'KING',
          so_id: so.id
        })
      }

      // Record HPP & Royalty to Global
      const totalUntukGlobal = totalHppGlobal + virtualRoyaltyGlobal
      if (totalUntukGlobal > 0) {
        await supabase.from('transactions').insert({
          date: orderDate,
          reference: null,
          description: `Alokasi HPP Bahan & Royalty - ${invoiceNumber}`,
          payment_method: 'Virtual',
          amount_in: totalUntukGlobal,
          workshop_code: 'GLOBAL',
          so_id: so.id
        })
        await supabase.from('transactions').insert({
          date: orderDate,
          reference: null,
          description: `Potongan HPP/Royalty untuk Global - ${invoiceNumber}`,
          payment_method: 'Virtual',
          amount_out: totalUntukGlobal,
          workshop_code: 'KING',
          so_id: so.id
        })
      }
    }

    const { data: soItemsForStatus } = await supabase.from('sales_items').select('id').eq('so_id', so.id);
    if (soItemsForStatus) {
      for (const item of soItemsForStatus) {
        await handleAutoStatusUpdate(item.id);
      }
    }

    revalidatePath('/dashboard/sales')
    revalidatePath('/dashboard/transactions')
    revalidatePath('/dashboard/inventory')
    revalidatePath('/dashboard')
    
    return { success: true, invoice_number: invoiceNumber }

  } catch (error) {
    console.error('Create Sales Order Error:', error)
    return { success: false, error: error.message }
  }
}

export async function addSalesPayment(soId, paymentData) {
  const { amount: paymentAmount, method: paymentMethod, date: paymentDate } = paymentData;
  const supabase = await createClient()
  try {
    const { data: so, error: soError } = await supabase.from('sales_orders').select('*, customers(name)').eq('id', soId).single()
    if (soError) throw soError

    const currentPaid = Number(so.dp_amount || 0)
    const totalAmount = Number(so.total_amount || 0)
    const remaining = totalAmount - currentPaid

    // Guard 1: Sudah lunas, tolak pembayaran baru
    if (so.payment_status === 'LUNAS' || remaining <= 0) {
      throw new Error('Invoice sudah lunas. Tidak dapat menambah pembayaran lagi.')
    }

    // Guard 2: Overpayment — pembayaran melebihi sisa tagihan
    if (Number(paymentAmount) > remaining) {
      throw new Error(`Pembayaran (Rp ${Number(paymentAmount).toLocaleString('id-ID')}) melebihi sisa tagihan (Rp ${remaining.toLocaleString('id-ID')}). Kurangi nominal pembayaran.`)
    }

    const newDpAmount = currentPaid + Number(paymentAmount)
    // Gunakan exact payment_status values yang ada di sistem: BELUM LUNAS / DP / LUNAS
    const paymentStatus = newDpAmount >= totalAmount ? 'LUNAS' : (newDpAmount > 0 ? 'DP' : 'BELUM LUNAS')

    // Update SO
    await supabase.from('sales_orders').update({
      dp_amount: newDpAmount,
      payment_status: paymentStatus
    }).eq('id', soId)


    // Insert Transaction
    const custName = so.customers?.name || so.customer_code
    await supabase.from('transactions').insert({
      date: paymentDate,
      reference: 'PENJUALAN',
      description: `Pembayaran ${paymentStatus} - ${custName}`,
      payment_method: paymentMethod,
      amount_in: paymentAmount,
      amount_out: 0,
      workshop_code: 'KING',
      so_id: so.id
    })

    // If it becomes LUNAS just now, distribute HPP!
    if (paymentStatus === 'LUNAS' && so.payment_status !== 'LUNAS') {
      const { data: items } = await supabase.from('sales_items').select('beli_gudang, beli_global').eq('so_id', so.id)
      
      let totalHppGudang = 0
      let totalUntukGlobal = 0

      if (items) {
        items.forEach(item => {
          totalHppGudang += Number(item.beli_gudang || 0)
          totalUntukGlobal += Number(item.beli_global || 0)
        })
      }

      // Record HPP to Gudang
      if (totalHppGudang > 0) {
        await supabase.from('transactions').insert([
          { date: paymentDate, description: `Alokasi HPP Cup/Barang Gudang - ${so.invoice_number}`, payment_method: 'Virtual', amount_in: totalHppGudang, workshop_code: 'GUDANG', so_id: so.id },
          { date: paymentDate, description: `Potongan HPP untuk Gudang - ${so.invoice_number}`, payment_method: 'Virtual', amount_out: totalHppGudang, workshop_code: 'KING', so_id: so.id }
        ])
      }

      // Record HPP & Royalty to Global
      if (totalUntukGlobal > 0) {
        await supabase.from('transactions').insert([
          { date: paymentDate, description: `Alokasi HPP Bahan & Royalty - ${so.invoice_number}`, payment_method: 'Virtual', amount_in: totalUntukGlobal, workshop_code: 'GLOBAL', so_id: so.id },
          { date: paymentDate, description: `Potongan HPP/Royalty untuk Global - ${so.invoice_number}`, payment_method: 'Virtual', amount_out: totalUntukGlobal, workshop_code: 'KING', so_id: so.id }
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
  const supabase = await createClient()

  try {
    const { customerId, orderDate, notes, items, dpAmount, paymentAccount, marketplaceReceipt } = payload

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
    
    const preparedItems = []

    for (const item of items) {
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

      if (product) {
        if (product.workshop_code === 'GUDANG') {
          totalBeliGudang += snapshot.beliGudang
        }
        if (product.workshop_code === 'GLOBAL') {
          totalBeliGlobal += snapshot.beliGlobal - snapshot.royaltyFee
        }
      }
      virtualRoyaltyGlobal += snapshot.royaltyFee

      let itemNotes = item.notes || '';
      const productNameForNotes = product?.name || item.product_id;

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

      if (item.isFastTrack) {
        const qtyFastTrack = Math.ceil(Number(item.qty) * Number(item.unit_multiplier || 1) / 1000);
        preparedItems.push({
          id: crypto.randomUUID(),
          so_id: soId,
          order_type: 'LAINNYA', 
          product_code: 'FAST-TRACK',
          status: 'BARU MASUK',
          qty: qtyFastTrack,
          unit: 'SLOT',
          unit_multiplier: 1,
          unit_price: 100000,
          total_price: 100000 * qtyFastTrack,
          hpp_price: 0,
          beli_gudang: 0,
          beli_global: 0,
          royalty_fee: 0,
          notes: `Jalur Cepat untuk ${productNameForNotes}`
        });
      }

      if (item.isTwoColor) {
        const actualQty = Number(item.qty) * Number(item.unit_multiplier || 1);
        preparedItems.push({
          id: crypto.randomUUID(),
          so_id: soId,
          order_type: 'LAINNYA',
          product_code: 'BIAYA-WARNA',
          status: 'BARU MASUK',
          qty: actualQty,
          unit: 'PCS',
          unit_multiplier: 1,
          unit_price: 250,
          total_price: 250 * actualQty,
          hpp_price: 0,
          beli_gudang: 0,
          beli_global: 0,
          royalty_fee: 0,
          notes: `Warna Ke-2 untuk ${productNameForNotes}`
        });
      }
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
          { date: orderOriginalDate, description: `Alokasi HPP Cup/Barang Gudang - ${invoiceNumber} (Update)`, payment_method: 'Virtual', amount_in: totalBeliGudang, workshop_code: 'GUDANG', so_id: soId },
          { date: orderOriginalDate, description: `Potongan HPP untuk Gudang - ${invoiceNumber} (Update)`, payment_method: 'Virtual', amount_out: totalBeliGudang, workshop_code: 'KING', so_id: soId }
        ]);
      }
      if (finalBeliGlobal > 0) {
        await supabase.from('transactions').insert([
          { date: orderOriginalDate, description: `Alokasi HPP Bahan & Royalty - ${invoiceNumber} (Update)`, payment_method: 'Virtual', amount_in: finalBeliGlobal, workshop_code: 'GLOBAL', so_id: soId },
          { date: orderOriginalDate, description: `Potongan HPP/Royalty untuk Global - ${invoiceNumber} (Update)`, payment_method: 'Virtual', amount_out: finalBeliGlobal, workshop_code: 'KING', so_id: soId }
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
  const supabase = await createClient()
  try {
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
  const supabase = await createClient()
  try {
    const { data: item, error: fetchErr } = await supabase
      .from('sales_items')
      .select('*, sales_orders(payment_status)')
      .eq('id', itemId)
      .single()
    
    if (fetchErr || !item) throw new Error("Item tidak ditemukan")

    const oldStatus = (item.status || 'BARU MASUK').toUpperCase()
    const targetStatus = newStatus.toUpperCase()

    // Guard 1: Terminal BATAL state cannot be changed
    if (oldStatus === 'BATAL' && targetStatus !== 'BATAL') {
      throw new Error("Item yang sudah dibatalkan tidak bisa diubah statusnya.")
    }

    // Relaxed guard: User can update to any valid status.
    // If we want to enforce strict workflow, we can do it here, but for flexibility, we allow it.

    const { error } = await supabase
      .from('sales_items')
      .update({ status: newStatus })
      .eq('id', itemId)
    
    if (error) throw new Error(error.message)

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
  const supabase = await createClient()

  try {
    // 1. Ubah status semua item menjadi BATAL
    const { error: itemsErr } = await supabase.from('sales_items')
      .update({ status: 'BATAL' })
      .eq('so_id', soId)
    if (itemsErr) throw new Error(itemsErr.message)

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
    return { success: true }
  } catch (error) {
    console.error('Cancel Sales Order error:', error)
    return { success: false, error: error.message }
  }
}
