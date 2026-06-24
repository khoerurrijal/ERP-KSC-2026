import { createClient } from '@/utils/supabase/server'
import OrderClient from './OrderClient'

export const metadata = {
  title: 'Order Sablon Cup | King Sablon Cup',
  description: 'Kalkulator dan Form Pemesanan Sablon Cup',
}

export default async function OrderPage() {
  const supabase = await createClient()

  // Ambil data produk
  const { data: products } = await supabase
    .from('products')
    .select('id, product_code, name, category, base_price, price_polos, workshop_code')
    .eq('is_active', true)
    .order('name')

  // Ambil matrix sablon
  const { data: matrixData } = await supabase
    .from('sablon_matrix')
    .select('*')

  const matrix = {}
  if (matrixData) {
    matrixData.forEach(row => {
      matrix[row.category] = row
    })
  }

  // Ambil dropdown config dan pricelist config
  const { data: settings } = await supabase
    .from('system_settings')
    .select('key, value')
    .in('key', ['dropdown_config', 'pricelist_config', 'category_images_config'])
  const dropdownConfig = settings?.find(s => s.key === 'dropdown_config')?.value || {}
  const pricelistConfig = settings?.find(s => s.key === 'pricelist_config')?.value || {}
  const categoryImagesConfig = settings?.find(s => s.key === 'category_images_config')?.value || {}

  return (
    <div className="min-h-screen bg-background text-foreground pb-20">
      <div className="relative pt-8 pb-6 px-4 text-center">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full bg-primary/10 rounded-b-[3rem] blur-[80px] pointer-events-none -z-10" />
        <img src="/logo-dark.png" alt="King Sablon Logo" className="h-20 mx-auto mb-3 drop-shadow-[0_0_15px_rgba(255,255,255,0.2)] object-contain" />
        <h1 className="text-2xl font-black tracking-tight mb-1">Order Cepat</h1>
        <p className="text-foreground/60 text-xs max-w-xs mx-auto">
          Kalkulator harga otomatis. Pilih produk, tentukan jumlah, dan dapatkan invoice Anda.
        </p>
      </div>

      <div className="max-w-md mx-auto px-3 relative z-10">
        <OrderClient 
          products={products || []} 
          matrix={matrix} 
          dropdownConfig={dropdownConfig} 
          pricelistConfig={pricelistConfig} 
          categoryImagesConfig={categoryImagesConfig}
        />
      </div>
    </div>
  )
}
