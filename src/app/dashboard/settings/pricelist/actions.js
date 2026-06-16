'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

export async function savePricelistConfig(config) {
  const supabase = await createClient()

  try {
    // 1. Simpan config ke system_settings
    const { error: setErr } = await supabase
      .from('system_settings')
      .upsert({
        key: 'pricelist_config',
        value: config,
        updated_at: new Date().toISOString()
      })
    
    if (setErr) throw setErr

    // 2. Ambil semua produk untuk diupdate selling_price-nya
    // selling_price = base_price + (base_price * profitMargin / 100)
    const { data: products, error: getErr } = await supabase
      .from('products')
      .select('id, base_price')
    
    if (getErr) throw getErr

    if (products && products.length > 0) {
      const margin = Number(config.profitMargin) || 0
      
      // Karena keterbatasan Supabase JS bulk update tanpa ID yang sama, 
      // kita harus update satu per satu atau menggunakan RPC.
      // Untuk amannya (karena jumlah produk mungkin belum terlalu besar), kita loop:
      for (const prod of products) {
        const newSellingPrice = Math.round(prod.base_price * (1 + (margin / 100)))
        await supabase
          .from('products')
          .update({ selling_price: newSellingPrice })
          .eq('id', prod.id)
      }
    }

    revalidatePath('/dashboard/settings/pricelist')
    revalidatePath('/dashboard/master/products')
    return { success: true }
  } catch (error) {
    console.error('Failed to save pricelist config:', error)
    return { success: false, error: error.message }
  }
}
