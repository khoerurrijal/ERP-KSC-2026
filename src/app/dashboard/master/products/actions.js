'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

export async function addProduct(data) {
  const supabase = await createClient()
  
  const { data: product, error } = await supabase
    .from('products')
    .insert([data])
    .select('*, workshops(name)')
    .single()

  if (error) return { error: error.message }
  
  revalidatePath('/dashboard/master/products')
  return { success: true, product }
}

export async function deleteProduct(id) {
  const supabase = await createClient()
  
  const { error } = await supabase
    .from('products')
    .delete()
    .eq('id', id)

  if (error) {
    if (error.code === '23503') return { error: 'Gagal dihapus: Produk ini sudah memiliki transaksi penjualan/pembelian.' }
    return { error: error.message }
  }

  revalidatePath('/dashboard/master/products')
  return { success: true }
}

export async function updateProduct(id, data) {
  const supabase = await createClient()
  
  const { data: product, error } = await supabase
    .from('products')
    .update(data)
    .eq('id', id)
    .select('*, workshops(name)')
    .single()

  if (error) return { error: error.message }
  
  revalidatePath('/dashboard/master/products')
  return { success: true, product }
}

export async function updateStock(product_code, new_stock) {
  const supabase = await createClient()
  
  const { error } = await supabase
    .from('products')
    .update({ stock_qty: new_stock })
    .eq('product_code', product_code)

  if (error) return { error: error.message }
  
  revalidatePath('/dashboard/inventory')
  return { success: true }
}
