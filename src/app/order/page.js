import { createClient } from '@/utils/supabase/server'
import OrderClient from './OrderClient'

export const metadata = {
  title: 'Form Pemesanan | King Sablon Cup',
  description: 'Form pemesanan produk King Sablon Cup dengan estimasi harga.',
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
      <div className="relative pt-5 sm:pt-7 pb-2 px-4 text-center">
        <img src="/logo-dark.png" alt="King Sablon Logo" className="h-16 sm:h-20 mx-auto drop-shadow-[0_0_15px_rgba(255,255,255,0.2)] object-contain" />
      </div>

      <div className="max-w-3xl mx-auto px-3 sm:px-4 pt-4 sm:pt-6 relative z-10">
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
