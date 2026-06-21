import { createClient } from '@/utils/supabase/server'

/**
 * Menghitung ulang HPP dan Harga Jual untuk suatu produk
 * berdasarkan 3 transaksi Purchase Order terakhir.
 */
export async function recalculateProductPrices(productCode) {
  try {
    const supabase = await createClient()

    // 1. Dapatkan detail produk (khususnya workshop_code untuk mark-up)
    const { data: product, error: prodErr } = await supabase
      .from('products')
      .select('workshop_code')
      .eq('product_code', productCode)
      .single()

    if (prodErr || !product) {
      console.error(`Gagal mengambil data produk ${productCode}:`, prodErr)
      return { success: false }
    }

    // 2. Ambil 3 transaksi PO terakhir untuk produk ini
    // Membutuhkan join dengan purchase_orders untuk mengurutkan berdasarkan tanggal
    const { data: recentItems, error: itemsErr } = await supabase
      .from('purchase_items')
      .select(`
        unit_price,
        purchase_orders!inner(date)
      `)
      .eq('product_code', productCode)
      // Supabase JS tidak bisa langsung order by relasi secara mudah tanpa raw query kadang,
      // tapi kita coba order by relasi atau ambil yang id terbesarnya
      .order('id', { ascending: false })
      .limit(3)

    if (itemsErr) {
      console.error(`Gagal mengambil riwayat PO ${productCode}:`, itemsErr)
      return { success: false }
    }

    if (!recentItems || recentItems.length === 0) {
      // Jika tidak ada histori PO, tidak perlu update HPP (mungkin dihapus semua)
      return { success: true }
    }

    // 3. Hitung Rata-rata HPP Murni
    const totalHpp = recentItems.reduce((sum, item) => sum + Number(item.unit_price || 0), 0)
    const hppMurni = totalHpp / recentItems.length

    // 4. Update Master Produk (base_price = HPP Murni)
    // Harga jual akhir akan dihitung dinamis di frontend (kasir) menggunakan pricelist_config
    const { error: updateErr } = await supabase
      .from('products')
      .update({
        hpp_murni: hppMurni,
        base_price: hppMurni,
        price_polos: hppMurni // price_polos disimpan sama dengan hpp_murni sebagai backward compatibility
      })
      .eq('product_code', productCode)

    if (updateErr) {
      console.error(`Gagal update harga produk ${productCode}:`, updateErr)
      return { success: false }
    }

    return { success: true, hpp_murni: hppMurni, base_price: hppMurni, price_polos: hppMurni }
  } catch (err) {
    console.error('Exception in recalculateProductPrices:', err)
    return { success: false }
  }
}
