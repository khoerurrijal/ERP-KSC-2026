'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

export async function addProduct(payload) {
  const { units, ...productData } = payload
  const supabase = await createClient()
  
  const { data: product, error } = await supabase
    .from('products')
    .insert([productData])
    .select('*, workshops(name)')
    .single()

  if (error) return { error: error.message }
  
  if (units && units.length > 0) {
    const unitRecords = units.map(u => ({
      product_code: product.product_code,
      unit_name: u.unit_name,
      multiplier: u.multiplier
    }))
    await supabase.from('product_units').insert(unitRecords)
  }
  
  revalidatePath('/dashboard/master/products')
  return { success: true, product: { ...product, product_units: units || [] } }
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

export async function updateProduct(id, payload) {
  const { units, ...productData } = payload
  const supabase = await createClient()
  
  const { data: product, error } = await supabase
    .from('products')
    .update(productData)
    .eq('id', id)
    .select('*, workshops(name)')
    .single()

  if (error) return { error: error.message }
  
  if (units) {
    await supabase.from('product_units').delete().eq('product_code', product.product_code)
    if (units.length > 0) {
      const unitRecords = units.map(u => ({
        product_code: product.product_code,
        unit_name: u.unit_name,
        multiplier: u.multiplier
      }))
      await supabase.from('product_units').insert(unitRecords)
    }
  }
  
  revalidatePath('/dashboard/master/products')
  return { success: true, product: { ...product, product_units: units || [] } }
}

export async function updateStock(product_code, new_stock) {
  const supabase = await createClient()
  
  const { error } = await supabase
    .from('products')
    .update({ physical_stock: new_stock })
    .eq('product_code', product_code)

  if (error) return { error: error.message }
  
  revalidatePath('/dashboard/inventory')
  return { success: true }
}
