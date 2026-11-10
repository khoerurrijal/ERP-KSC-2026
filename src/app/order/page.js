import Image from 'next/image'
import { createAdminClient } from '@/utils/supabase/admin'
import OrderClient from './OrderClient'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Form Pemesanan | King Sablon Cup',
  description: 'Form pemesanan produk King Sablon Cup dengan informasi harga.',
}

export default async function OrderPage() {
  const supabase = createAdminClient()

  const { data: products } = await supabase
    .from('products')
    .select('id, product_code, name, category, base_price, price_polos, workshop_code')
    .eq('is_active', true)
    .order('name')

  const { data: productUnits } = await supabase
    .from('product_units')
    .select('product_code, unit_name, multiplier')
    .in('unit_name', ['ROLL', 'PACK'])

  const { data: settings } = await supabase
    .from('system_settings')
    .select('key, value')
    .in('key', ['dropdown_config', 'pricelist_config', 'category_images_config'])
  const dropdownConfig = settings?.find(s => s.key === 'dropdown_config')?.value || {}
  const pricelistConfig = settings?.find(s => s.key === 'pricelist_config')?.value || {}
  const categoryImagesConfig = settings?.find(s => s.key === 'category_images_config')?.value || {}

  return (
    <main style={{ colorScheme: 'light' }} className="min-h-screen bg-[#f8f7f4] pb-32 text-stone-900">
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center gap-4 px-4 py-4 sm:px-6">
          <div className="flex h-14 w-28 items-center justify-center overflow-hidden rounded-lg bg-[#211c13] p-2">
            <Image src="/logo.png" alt="King Sablon Cup" width={160} height={78} priority className="h-full w-full object-contain" />
          </div>
          <div><p className="text-sm font-bold text-stone-900">King Sablon Cup</p><p className="mt-0.5 text-xs text-stone-500">Katalog & pesanan</p></div>
        </div>
      </header>
      <div className="mx-auto max-w-5xl px-4 pt-7 sm:px-6 sm:pt-10">
        <OrderClient products={products || []} productUnits={productUnits || []} dropdownConfig={dropdownConfig} pricelistConfig={pricelistConfig} categoryImagesConfig={categoryImagesConfig} />
      </div>
    </main>
  )
}
