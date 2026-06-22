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
    .select('id, product_code, name, category, base_price, price_polos')
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

  return (
    <div className="min-h-screen bg-background text-foreground pb-20">
      <div className="relative pt-12 pb-8 px-4 text-center">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[80%] h-full bg-primary/10 rounded-b-full blur-[100px] pointer-events-none -z-10" />
        <img src="/logo.png" alt="King Sablon Logo" className="h-16 mx-auto mb-4 drop-shadow-[0_0_15px_rgba(255,255,255,0.3)]" />
        <h1 className="text-3xl font-black tracking-tight mb-2">Order Cepat</h1>
        <p className="text-foreground/60 text-sm max-w-sm mx-auto">
          Kalkulator harga otomatis. Pilih produk, tentukan jumlah, dan dapatkan invoice Anda.
        </p>
      </div>

      <div className="max-w-xl mx-auto px-4 relative z-10">
        <OrderClient products={products || []} matrix={matrix} />
      </div>
    </div>
  )
}
