'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

export async function savePricelistConfig(config) {
  const supabase = await createClient()

  try {
    // 1. Simpan config margin ke system_settings
    const { error: setErr } = await supabase
      .from('system_settings')
      .upsert({
        key: 'pricelist_config',
        value: { profitMargin: config.profitMargin },
        updated_at: new Date().toISOString()
      })
    
    if (setErr) throw setErr

    // 2. Simpan Matrix Sablon
    const matrixPromises = Object.values(config.matrix).map(row => 
      supabase.from('sablon_matrix').upsert(row, { onConflict: 'category' })
    )
    await Promise.all(matrixPromises)

    // 3. Update price_polos produk
    const { data: products, error: getErr } = await supabase
      .from('products')
      .select('id, base_price')
    
    if (getErr) throw getErr

    if (products && products.length > 0) {
      const margin = Number(config.profitMargin) || 0
      
      for (const prod of products) {
        if (!prod.base_price) continue
        const newPrice = Math.round(prod.base_price * (1 + (margin / 100)))
        await supabase
          .from('products')
          .update({ price_polos: newPrice })
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
