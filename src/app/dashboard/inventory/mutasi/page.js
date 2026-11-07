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
  const searchTerm = String(resolvedParams?.mutationSearch || '').trim()
  const search = searchTerm.replace(/[(),"]/g, ' ').trim()

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

  let mutationsQuery = supabase
    .from('inventory_mutations')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50000)

  if (search) {
    mutationsQuery = mutationsQuery.or(`reference.ilike.%${search}%,actor.ilike.%${search}%,product_name.ilike.%${search}%`)
  } else {
    mutationsQuery = mutationsQuery
      .gte('mutation_date', `${selectedMonth}-01`)
      .lte('mutation_date', endDateStr)
  }

  const { data: rawMutations, error } = await mutationsQuery

  let mutations = rawMutations || [];

  // Ambil mutasi tambahan dari stock_mutations yang tidak tercover oleh view
  let stockMutationsQuery = supabase
    .from('stock_mutations')
    .select('*, products(name)')
    .not('mutation_type', 'in', '("IN","OUT_POLOS","OUT_SABLON")')

  if (search) {
    const { data: matchedProducts } = await supabase
      .from('products')
      .select('product_code')
      .ilike('name', `%${searchTerm}%`)
    const matchedProductCodes = (matchedProducts || []).map(product => product.product_code).filter(Boolean)
    const searchFilters = [
      `reference_number.ilike.%${search}%`,
      `mutation_type.ilike.%${search}%`,
      ...(matchedProductCodes.length ? [`product_code.in.(${matchedProductCodes.join(',')})`] : [])
    ]
    stockMutationsQuery = stockMutationsQuery.or(searchFilters.join(','))
  } else {
    stockMutationsQuery = stockMutationsQuery
      .gte('created_at', `${selectedMonth}-01T00:00:00`)
      .lte('created_at', `${endDateStr}T23:59:59`)
  }

  stockMutationsQuery = stockMutationsQuery.order('created_at', { ascending: false }).limit(50000)
  const { data: stockMutations } = await stockMutationsQuery

  if (stockMutations && stockMutations.length > 0) {
    const extraMutations = stockMutations.map(m => {
      const isPositive = (m.qty_tersedia_change > 0) || (m.qty_fisik_change > 0);
      const isNegative = (m.qty_tersedia_change < 0) || (m.qty_fisik_change < 0);
      const magnitude = Math.max(Math.abs(m.qty_tersedia_change || 0), Math.abs(m.qty_fisik_change || 0));

      return {
        mutation_date: m.created_at.substring(0, 10),
        reference: `${m.mutation_type}: ${m.reference_number || '-'}`,
        actor: 'SYSTEM',
        product_code: m.product_code,
        product_name: m.products?.name || 'Unknown',
        qty_in: isPositive ? magnitude : 0,
        qty_out: isNegative ? magnitude : 0,
        created_at: m.created_at
      }
    });
    mutations = [...mutations, ...extraMutations].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }

  // Ambil data produk untuk dropdown filter
  const { data: products } = await supabase.from('products').select('product_code, name').order('name')

  return (
    <MutasiClient 
      mutations={mutations} 
      products={products || []} 
      selectedMonth={selectedMonth} 
      initialSearch={searchTerm}
      error={error ? error.message : null}
    />
  )
}
