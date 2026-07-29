import { createClient } from '@/utils/supabase/server'
import InventoryClient from './InventoryClient'

// Komponen server ini di-render di dalam Suspense boundary di page.js
// sehingga UI halaman bisa langsung tampil, dan data dimuat secara streaming
export default async function InventoryData({ searchParams = {} }) {
  const supabase = await createClient()

  const page = parseInt(searchParams.page || '1', 10)
  const pageSize = parseInt(searchParams.pageSize || '50', 10)
  const search = searchParams.search || ''
  const category = searchParams.category || ''
  const workshop = searchParams.workshop || ''
  const sortKey = searchParams.sortKey || 'name'
  const sortDir = searchParams.sortDir || 'asc'

  let query = supabase
    .from('products')
    .select(`
      *,
      workshops (name)
    `, { count: 'exact' })
    .eq('is_active', true)

  if (search) {
    query = query.or(`name.ilike.%${search}%,product_code.ilike.%${search}%,category.ilike.%${search}%`)
  }

  if (category) {
    query = query.eq('category', category)
  }

  if (workshop) {
    query = query.eq('workshop_code', workshop)
  }

  const validSortKey = ['name', 'product_code', 'category', 'physical_stock', 'safety_stock'].includes(sortKey) ? sortKey : 'name'
  query = query.order(validSortKey, { ascending: sortDir === 'asc' })

  const start = (page - 1) * pageSize
  const end = start + pageSize - 1
  query = query.range(start, end)

  const [
    productsRes,
    { data: pipelineData },
    { data: workshops },
    { data: allCategories }
  ] = await Promise.all([
    query,
    supabase
      .from('product_pipeline_view')
      .select('*')
      .limit(200),
    supabase
      .from('workshops')
      .select('id, name, code')
      .order('name'),
    supabase
      .from('products')
      .select('category')
      .eq('is_active', true)
      .limit(300)
  ])

  const categories = Array.from(new Set((allCategories || []).map(c => c.category).filter(Boolean))).sort()

  return (
    <InventoryClient
      products={productsRes.data || []}
      totalCount={productsRes.count || 0}
      page={page}
      pageSize={pageSize}
      pipelineData={pipelineData || []}
      workshops={workshops || []}
      categories={categories}
      searchParams={searchParams}
    />
  )
}
