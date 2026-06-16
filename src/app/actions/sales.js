'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

export async function calculateDynamicHPP(supabase, productCode, fallbackPrice) {
  try {
    const { data: purchases, error } = await supabase
      .from('purchase_items')
      .select('unit_price')
      .eq('product_code', productCode)
      .order('id', { ascending: false });
      
    if (error || !purchases || purchases.length === 0) return fallbackPrice;
    
    if (purchases.length >= 3) {
      const sum = purchases.reduce((acc, curr) => acc + Number(curr.unit_price || 0), 0);
      return sum / purchases.length;
    } else {
      return Math.max(...purchases.map(p => Number(p.unit_price || 0)));
    }
  } catch(e) {
    return fallbackPrice;
  }
}

export async function createSalesOrder(payload) {
  const supabase = await createClient()

  try {
    const { customerId, orderDate, notes, items, dpAmount, paymentAccount, marketplaceReceipt } = payload

    // Generate Invoice Number
    const dateStr = new Date().toISOString().split('T')[0].replace(/-/g, '')
    const randomStr = Math.floor(1000 + Math.random() * 9000)
    const invoiceNumber = `INV-${dateStr}-${randomStr}`

    // Calculate grand total
    const grandTotal = items.reduce((sum, item) => sum + (Number(item.qty) * Number(item.price)), 0)
    const paymentStatus = dpAmount >= grandTotal ? 'LUNAS' : (dpAmount > 0 ? 'DP' : 'BELUM LUNAS')

    // Get customer name
    const { data: cust } = await supabase.from('customers').select('name').eq('customer_code', customerId).single()
    const customerName = cust ? cust.name : customerId

    // Get profit margins from settings
    const { data: settings } = await supabase.from('system_settings').select('value').eq('key', 'cashflow_config').single();
    const cashflowConfig = settings?.value || {};
    const profitGudangPct = Number(cashflowConfig.profit_gudang_percent || 0);
    const profitGlobalPct = Number(cashflowConfig.profit_global_percent || 0);

    // Pre-calculate HPP to save in sales_orders
    let totalHppGudang = 0;
    let totalHppGlobal = 0;
    let virtualRoyaltyGlobal = 0;
    
    for (const item of items) {
      const category = item.category?.toLowerCase() || '';
      const isPlastik = category.includes('plastik');
      const isSealer = category.includes('sealer');

      if (isPlastik && item.order_type === 'Sablon') {
        virtualRoyaltyGlobal += (20 * Number(item.qty));
      } else if (isSealer) {
        virtualRoyaltyGlobal += (20000 * Number(item.qty));
      }

      const { data: product } = await supabase.from('products').select('workshop_code, base_price').eq('product_code', item.product_id).single();
      const dynamicHPP = await calculateDynamicHPP(supabase, item.product_id, product?.base_price || 0);
      
      if (product) {
        const itemHppTotal = dynamicHPP * item.qty;
        if (product.workshop_code === 'GUDANG') {
          totalHppGudang += itemHppTotal * (1 + (profitGudangPct / 100));
        }
        if (product.workshop_code === 'GLOBAL') {
          totalHppGlobal += itemHppTotal * (1 + (profitGlobalPct / 100));
        }
      }
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
      const { data: product } = await supabase.from('products').select('workshop_code, base_price').eq('product_code', item.product_id).single();
      const dynamicHPP = await calculateDynamicHPP(supabase, item.product_id, product?.base_price || 0);

      const category = item.category?.toLowerCase() || '';
      const isPlastik = category.includes('plastik');
      const isSealer = category.includes('sealer');

      let itemRoyalty = 0;
      if (isPlastik && item.order_type === 'Sablon') {
        itemRoyalty = (20 * Number(item.qty));
      } else if (isSealer) {
        itemRoyalty = (20000 * Number(item.qty));
      }

      const itemHppTotal = dynamicHPP * Number(item.qty);
      let itemBeliGudang = 0;
      let itemBeliGlobal = 0;

      if (product?.workshop_code === 'GUDANG') itemBeliGudang = itemHppTotal * (1 + (profitGudangPct / 100));
      if (product?.workshop_code === 'GLOBAL') itemBeliGlobal = itemHppTotal * (1 + (profitGlobalPct / 100));
      
      // Royalty selalu masuk ke Global
      itemBeliGlobal += itemRoyalty;

      soItems.push({
        so_id: so.id,
        order_type: item.order_type,
        product_code: item.product_id,
        mockup_url: item.mockup_url,
        qty: Number(item.qty),
        unit: item.unit || 'PCS',
        unit_multiplier: item.unit_multiplier || 1,
        unit_price: Number(item.price),
        total_price: Number(item.qty) * Number(item.price),
        hpp_price: dynamicHPP,
        beli_gudang: itemBeliGudang,
        beli_global: itemBeliGlobal
      });
    }

    const { error: itemsError } = await supabase.from('sales_items').insert(soItems)
    if (itemsError) throw new Error('Gagal menyimpan item pesanan.')

    // DECREMENT STOCK for each item
    for (const item of soItems) {
      const removedQty = Number(item.qty) * Number(item.unit_multiplier || 1)
      const { data: prod } = await supabase.from('products').select('stock_qty').eq('product_code', item.product_code).single()
      if (prod) {
        await supabase.from('products')
          .update({ stock_qty: Number(prod.stock_qty || 0) - removedQty })
          .eq('product_code', item.product_code)
      }
    }

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

export async function addSalesPayment(soId, paymentAmount, paymentMethod, paymentDate) {
  const supabase = await createClient()
  try {
    const { data: so, error: soError } = await supabase.from('sales_orders').select('*, customers(name)').eq('id', soId).single()
    if (soError) throw soError

    const newDpAmount = Number(so.dp_amount || 0) + Number(paymentAmount)
    const paymentStatus = newDpAmount >= Number(so.total_amount) ? 'LUNAS' : 'BELUM LUNAS'

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

    const grandTotal = items.reduce((sum, item) => sum + (Number(item.qty) * Number(item.price)), 0)
    const paymentStatus = dpAmount >= grandTotal ? 'LUNAS' : (dpAmount > 0 ? 'DP' : 'BELUM LUNAS')

    // Get profit margins from settings
    const { data: settings } = await supabase.from('system_settings').select('value').eq('key', 'cashflow_config').single();
    const cashflowConfig = settings?.value || {};
    const profitGudangPct = Number(cashflowConfig.profit_gudang_percent || 0);
    const profitGlobalPct = Number(cashflowConfig.profit_global_percent || 0);

    let totalBeliGudang = 0
    let totalBeliGlobal = 0
    let virtualRoyaltyGlobal = 0
    
    const preparedItems = []

    for (const item of items) {
      const category = item.category?.toLowerCase() || ''
      const isPlastik = category.includes('plastik')
      const isSealer = category.includes('sealer')

      let itemRoyalty = 0
      if (isPlastik && item.order_type === 'Sablon') {
        itemRoyalty = (20 * Number(item.qty))
      } else if (isSealer) {
        itemRoyalty = (20000 * Number(item.qty))
      }
      virtualRoyaltyGlobal += itemRoyalty

      const { data: product } = await supabase.from('products').select('workshop_code, base_price').eq('product_code', item.product_id).single()
      
      const dynamicHPP = await calculateDynamicHPP(supabase, item.product_id, product?.base_price || 0)
      const itemHppTotal = dynamicHPP * Number(item.qty)
      
      let itemBeliGudang = 0;
      let itemBeliGlobal = 0;

      if (product?.workshop_code === 'GUDANG') {
        itemBeliGudang = itemHppTotal * (1 + (profitGudangPct / 100))
        totalBeliGudang += itemBeliGudang
      }
      if (product?.workshop_code === 'GLOBAL') {
        itemBeliGlobal = itemHppTotal * (1 + (profitGlobalPct / 100))
        totalBeliGlobal += itemBeliGlobal
      }

      itemBeliGlobal += itemRoyalty

      preparedItems.push({
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
        beli_gudang: itemBeliGudang,
        beli_global: itemBeliGlobal
      })
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
        dp_amount: dpAmount,
        payment_method: paymentAccount,
        payment_status: paymentStatus
      })
      .eq('id', soId)

    if (soError) throw new Error('Gagal update pesanan: ' + soError.message)

    // Delete existing items
    await supabase.from('sales_items').delete().eq('so_id', soId)

    // Re-insert new items
    const { error: itemsError } = await supabase.from('sales_items').insert(preparedItems)
    if (itemsError) throw new Error('Gagal update item pesanan.')

    revalidatePath('/dashboard/sales')
    revalidatePath('/dashboard/transactions')
    
    return { success: true }
  } catch (error) {
    console.error('Update Sales Order Error:', error)
    return { success: false, error: error.message }
  }
}

