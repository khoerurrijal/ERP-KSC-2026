'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { handleAutoStatusUpdate } from '@/app/dashboard/production/actions'

export async function processMarketplaceSettlement(settlementData, paymentMethod, settlementDate) {
  const supabase = await createClient()
  try {
    // 1. Fetch the orders to verify
    const orderIds = settlementData.map(d => d.orderId)
    const totalPencairan = settlementData.reduce((acc, curr) => acc + curr.amount, 0)

    const { data: orders, error: ordersErr } = await supabase
      .from('sales_orders')
      .select('id, invoice_number, total_amount, customers (name)')
      .in('id', orderIds)
    
    if (ordersErr) throw ordersErr

    // Extract unique marketplace names from the customers.name
    const marketplaceNames = new Set()
    orders.forEach(o => {
      const cname = (o.customers?.name || '').toLowerCase()
      if (cname.includes('shopee')) marketplaceNames.add('Shopee')
      else if (cname.includes('tokopedia')) marketplaceNames.add('Tokopedia')
      else if (cname.includes('tiktok')) marketplaceNames.add('TikTok')
      else marketplaceNames.add('Marketplace')
    })
    
    const mpString = Array.from(marketplaceNames).join(', ')

    // 2. Insert to Transactions (Buku Besar)
    await supabase.from('transactions').insert({
      date: settlementDate,
      reference: 'PENJUALAN',
      description: `Pencairan ${mpString} (${orders.length} Pesanan)`,
      payment_method: paymentMethod,
      amount_in: totalPencairan,
      amount_out: 0,
      workshop_code: 'KING'
    })

    // 3. Update all orders to LUNAS and set their pencairan value evenly (or just full)
    // Actually the user said detailnya ada di menu marketplace, so we should set payment_status = 'LUNAS' 
    // and maybe dp_amount = total_amount.
    // Also we distribute HPP for these orders since they just became LUNAS!
    
    // Distribute HPP logic similar to sales.js
    let totalHppGudang = 0
    let totalHppGlobal = 0
    let virtualRoyaltyGlobal = 0

    for (const order of orders) {
      // Find exact amount from settlementData
      const pencairanAmount = settlementData.find(d => d.orderId === order.id)?.amount || 0

      // Update order to LUNAS
      await supabase.from('sales_orders').update({
        payment_status: 'LUNAS',
        dp_amount: order.total_amount, // Mark as fully paid
        marketplace_pencairan: pencairanAmount
      }).eq('id', order.id)

      // Fetch items for HPP
      const { data: soItems } = await supabase.from('sales_items').select('*').eq('so_id', order.id)
      
      for (const item of (soItems || [])) {
        const { data: product } = await supabase.from('products').select('workshop_code, base_price, category').eq('product_code', item.product_code).single()
        
        if (product) {
          const itemHppTotal = product.base_price * item.qty
          if (product.workshop_code === 'GUDANG') totalHppGudang += itemHppTotal
          if (product.workshop_code === 'GLOBAL') totalHppGlobal += itemHppTotal

          const category = product.category?.toLowerCase() || ''
          const isPlastik = category.includes('plastik')
          const isSealer = category.includes('sealer')

          if (isPlastik && item.order_type === 'Sablon') {
            virtualRoyaltyGlobal += (20 * Number(item.qty))
          } else if (isSealer) {
            virtualRoyaltyGlobal += (20000 * Number(item.qty))
          }
        }
      }
    }

    // Record HPP to Gudang
    if (totalHppGudang > 0) {
      await supabase.from('transactions').insert({
        date: settlementDate,
        reference: null,
        description: `Alokasi HPP Cup/Barang Gudang (Marketplace) - ${orders.length} Pesanan`,
        payment_method: 'Virtual',
        amount_in: totalHppGudang,
        workshop_code: 'GUDANG'
      })
      await supabase.from('transactions').insert({
        date: settlementDate,
        reference: null,
        description: `Potongan HPP untuk Gudang (Marketplace) - ${orders.length} Pesanan`,
        payment_method: 'Virtual',
        amount_out: totalHppGudang,
        workshop_code: 'KING'
      })
    }

    // Record HPP & Royalty to Global
    const totalUntukGlobal = totalHppGlobal + virtualRoyaltyGlobal
    if (totalUntukGlobal > 0) {
      await supabase.from('transactions').insert({
        date: settlementDate,
        reference: null,
        description: `Alokasi HPP Bahan & Royalty (Marketplace) - ${orders.length} Pesanan`,
        payment_method: 'Virtual',
        amount_in: totalUntukGlobal,
        workshop_code: 'GLOBAL'
      })
      await supabase.from('transactions').insert({
        date: settlementDate,
        reference: null,
        description: `Potongan HPP/Royalty untuk Global (Marketplace) - ${orders.length} Pesanan`,
        payment_method: 'Virtual',
        amount_out: totalUntukGlobal,
        workshop_code: 'KING'
      })
    }

    // Trigger auto status update for all items in the settled orders
    // Because marketplace orders might be stuck at DIKIRIM and need to move to SELESAI once LUNAS
    const { data: allSettledItems } = await supabase.from('sales_items').select('id').in('so_id', orderIds);
    if (allSettledItems) {
      for (const item of allSettledItems) {
        await handleAutoStatusUpdate(item.id);
      }
    }

    revalidatePath('/dashboard/marketplace')
    revalidatePath('/dashboard/transactions')
    revalidatePath('/dashboard/production')
    revalidatePath('/dashboard/sales')
    revalidatePath('/track')
    return { success: true }
  } catch (err) {
    console.error(err)
    return { success: false, error: err.message }
  }
}
