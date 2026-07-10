'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { handleAutoStatusUpdate } from '@/app/dashboard/production/actions'

export async function processMarketplaceSettlement(settlementData, paymentMethod, settlementDate) {
  const supabase = await createClient()
  try {
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

export async function updateMarketplaceReceipt(orderId, receipt) {
  const supabase = await createClient();
  const { error } = await supabase.from('sales_orders').update({ marketplace_receipt: receipt }).eq('id', orderId);
  if (error) return { success: false, error: error.message };
  revalidatePath('/dashboard/marketplace');
  revalidatePath('/dashboard/sales');
  return { success: true };
}
