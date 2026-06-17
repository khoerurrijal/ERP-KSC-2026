import { createClient } from '@/utils/supabase/server'
import PriceListClient from './PriceListClient'

export const metadata = {
  title: 'Price List | King Sablon Cup',
  description: 'Daftar Harga Produk King Sablon Cup',
}

export default async function PriceListPage() {
  const supabase = await createClient()

  // Ambil data produk
  const { data: products } = await supabase
    .from('products')
    .select('product_code, name, category, workshop_code, base_price, price_polos')
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

  return (
    <div className="min-h-screen bg-background text-foreground pb-20">
      <div className="relative pt-12 pb-8 px-4 text-center">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[80%] h-full bg-primary/10 rounded-b-full blur-[100px] pointer-events-none -z-10" />
        <img src="/logo.png" alt="King Sablon Logo" className="h-16 mx-auto mb-6 drop-shadow-[0_0_15px_rgba(255,255,255,0.3)]" />
        <h1 className="text-4xl font-black tracking-tight mb-2">Price List Terbaru</h1>
        <p className="text-foreground/60 max-w-lg mx-auto">
          Daftar harga cup polos dan sablon per 1.000 pcs. Harga dapat berubah sewaktu-waktu.
        </p>
      </div>

      <div className="max-w-6xl mx-auto px-4 relative z-10">
        <PriceListClient products={products || []} matrix={matrix} />
      </div>
    </div>
  )
}
