import { createClient } from '@/utils/supabase/server'
import MutasiClient from './MutasiClient'

export const dynamic = 'force-dynamic'

export default async function MutasiPage({ searchParams }) {
  const supabase = await createClient()
  const resolvedParams = await searchParams
  
  const selectedMonth = resolvedParams?.month || (() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })()

  // Ambil semua data mutasi (Pastikan VIEW sudah ada di DB)
  // Karena bisa besar, kita limit 100k, filter di client atau jika terlalu besar harus filter DB
  // Namun untuk saat ini kita ambil semua mutasi pada bulan terpilih saja agar ringan, atau semua jika tidak ada filter.
  // Tapi requirement: "ketika ganti bulan summary berubah", mutasi biasanya diliat per bulan.
  
  // Karena VIEW belum tentu jalan jika user belum execute scriptnya, 
  // kita tetap panggil VIEW, dan kalau error (karena belum di-run), client akan menampilkan tabel kosong dengan peringatan.
  const year = parseInt(selectedMonth.split('-')[0])
  const month = parseInt(selectedMonth.split('-')[1])
  const lastDay = new Date(year, month, 0).getDate()
  const endDateStr = `${selectedMonth}-${String(lastDay).padStart(2, '0')}`

  const { data: mutations, error } = await supabase
    .from('inventory_mutations')
    .select('*')
    .gte('mutation_date', `${selectedMonth}-01`)
    .lte('mutation_date', endDateStr)
    .order('created_at', { ascending: false })
    .limit(50000)

  // Ambil data produk untuk dropdown filter
  const { data: products } = await supabase.from('products').select('product_code, name').order('name')

  return (
    <MutasiClient 
      mutations={mutations || []} 
      products={products || []} 
      selectedMonth={selectedMonth} 
      error={error ? error.message : null}
    />
  )
}
