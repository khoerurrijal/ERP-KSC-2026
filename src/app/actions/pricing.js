'use server'

import { createAuthorizedAdminClient } from '@/lib/adminAuth'
import { calculateWeightedAverageHPP } from '@/utils/pricing'

/** Update modal master from a newly received PO using perpetual weighted average. */
export async function updateProductHPPFromReceipt(productCode, receipt) {
  try {
    const currentStockQty = Number(receipt?.currentStockQty)
    const currentHPP = Number(receipt?.currentHPP)
    const receivedQty = Number(receipt?.receivedQty)
    const receivedValue = Number(receipt?.receivedValue)
    const nextHPP = calculateWeightedAverageHPP({ currentStockQty, currentHPP, receivedQty, receivedValue })

    if (nextHPP === null) {
      return { success: false, error: 'Data stok atau biaya penerimaan tidak valid.' }
    }

    const { supabase } = await createAuthorizedAdminClient(['ADMIN', 'OWNER', 'OPERATOR'])

    const { data: updatedProduct, error: updateErr } = await supabase
      .from('products')
      .update({ price_polos: nextHPP })
      .eq('product_code', productCode)
      .select('product_code')
      .single()

    if (updateErr || !updatedProduct) {
      console.error(`Gagal update harga produk ${productCode}:`, updateErr)
      return { success: false, error: updateErr?.message || 'Produk tidak ditemukan.' }
    }

    return { success: true, price_polos: nextHPP }
  } catch (err) {
    console.error('Exception in updateProductHPPFromReceipt:', err)
    return { success: false, error: err.message || 'Gagal memperbarui HPP master.' }
  }
}
