'use server'

import { createAuthorizedAdminClient } from '@/lib/adminAuth'
import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

export async function getMarketplaceSettlementDetails(transactionId) {
  const supabase = await createClient()

  try {
    const { data: transaction, error: transactionError } = await supabase
      .from('transactions')
      .select('reference, description')
      .eq('id', transactionId)
      .maybeSingle()

    if (transactionError) throw transactionError
    if (
      !transaction ||
      String(transaction.reference || '').toUpperCase() !== 'PENJUALAN' ||
      !/^Pencairan\s/i.test(String(transaction.description || ''))
    ) {
      throw new Error('Transaksi pencairan tidak ditemukan.')
    }

    const description = String(transaction.description || '')
    const separatorIndex = description.indexOf(' - ')
    const invoiceNumbers = separatorIndex === -1
      ? []
      : [...new Set(description.slice(separatorIndex + 3).split(',').map(value => value.trim()).filter(Boolean))]

    const orders = []
    for (let offset = 0; offset < invoiceNumbers.length; offset += 200) {
      const invoiceBatch = invoiceNumbers.slice(offset, offset + 200)
      const { data, error } = await supabase
        .from('sales_orders')
        .select('invoice_number, marketplace_pencairan, customers(name), sales_items(qty, unit, products(name))')
        .in('invoice_number', invoiceBatch)

      if (error) throw error
      orders.push(...(data || []))
    }

    const ordersByReference = new Map(orders.map(order => [String(order.invoice_number), order]))
    return {
      success: true,
      orders: invoiceNumbers.map(invoiceNumber => ordersByReference.get(invoiceNumber)).filter(Boolean).map(order => {
        const customer = Array.isArray(order.customers) ? order.customers[0] : order.customers
        const items = Array.isArray(order.sales_items) ? order.sales_items : []

        return {
          customerName: customer?.name || 'Pelanggan tidak diketahui',
          amount: Number(order.marketplace_pencairan || 0),
          products: items.map(item => {
            const product = Array.isArray(item.products) ? item.products[0] : item.products
            return {
              name: product?.name || 'Produk',
              quantity: Number(item.qty || 0),
              unit: item.unit || 'pcs'
            }
          })
        }
      })
    }
  } catch {
    return { success: false, error: 'Rincian pencairan tidak dapat dimuat.' }
  }
}

export async function createManualTransaction(payload) {
  const { supabase } = await createAuthorizedAdminClient(['ADMIN', 'OWNER'])

  try {
    const { date, type, reference, workshop_code, payment_method, amount, description } = payload
    
    // Validasi
    if (!Number.isFinite(Number(amount)) || Number(amount) <= 0) {
      throw new Error("Nominal transaksi harus lebih dari 0")
    }
    if (!date) {
      throw new Error("Tanggal transaksi wajib diisi")
    }
    const normalizedAmount = Number(amount)

    const isMasuk = type === 'MASUK'

    const { error } = await supabase.from('transactions').insert([{
      date,
      reference: workshop_code === 'KING' ? reference : 'LAIN-LAIN',
      description,
      payment_method,
      workshop_code,
      amount_in: isMasuk ? normalizedAmount : 0,
      amount_out: isMasuk ? 0 : normalizedAmount
    }])

    if (error) throw error

    revalidatePath('/dashboard/transactions')
    revalidatePath('/dashboard/report')
    return { success: true }
  } catch (err) {
    console.error('Error creating transaction:', err)
    return { success: false, error: err.message }
  }
}

export async function updateTransaction(id, payload) {
  const { supabase } = await createAuthorizedAdminClient(['ADMIN', 'OWNER'])

  try {
    const { date, type, reference, workshop_code, payment_method, amount, description } = payload
    
    if (!Number.isFinite(Number(amount)) || Number(amount) <= 0) {
      throw new Error("Nominal transaksi harus lebih dari 0")
    }
    const normalizedAmount = Number(amount)

    const isMasuk = type === 'MASUK'

    const { error } = await supabase.from('transactions')
      .update({
        date,
        reference: workshop_code === 'KING' ? reference : 'LAIN-LAIN',
        description,
        payment_method,
        workshop_code,
        amount_in: isMasuk ? normalizedAmount : 0,
        amount_out: isMasuk ? 0 : normalizedAmount
      })
      .eq('id', id)

    if (error) throw error

    revalidatePath('/dashboard/transactions')
    revalidatePath('/dashboard/report')
    return { success: true }
  } catch (err) {
    console.error('Error updating transaction:', err)
    return { success: false, error: err.message }
  }
}

export async function deleteTransaction(id) {
  const { supabase } = await createAuthorizedAdminClient(['ADMIN', 'OWNER'])
  try {
    const { error } = await supabase.from('transactions').delete().eq('id', id)
    if (error) throw error
    revalidatePath('/dashboard/transactions')
    revalidatePath('/dashboard/report')
    return { success: true }
  } catch (err) {
    console.error('Error deleting transaction:', err)
    return { success: false, error: err.message }
  }
}
