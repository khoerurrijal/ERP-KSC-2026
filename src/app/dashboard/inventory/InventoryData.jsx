import { createClient } from '@/utils/supabase/server'
import InventoryClient from './InventoryClient'
import { numericTokenPattern } from '@/utils/search'

// Komponen server ini di-render di dalam Suspense boundary di page.js
// sehingga UI halaman bisa langsung tampil, dan data dimuat secara streaming
export default async function InventoryData({ searchParams = {}, activeTab = 'table' }) {
  const supabase = await createClient()

  const page = parseInt(searchParams.page || '1', 10)
  const pageSize = parseInt(searchParams.pageSize || '50', 10)
  const search = String(searchParams.search || '').replace(/[(),"]/g, ' ').trim()
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

  if (!search) {
    query = query.eq('is_active', true)
  }

  if (search) {
    const numericPattern = numericTokenPattern(search)
    query = query.or(numericPattern
      ? `name.imatch."${numericPattern}",category.imatch."${numericPattern}"`
      : `name.ilike.%${search}%,category.ilike.%${search}%`)
  }

  if (!search && category) {
    query = query.eq('category', category)
  }

  if (!search && workshop) {
    query = query.eq('workshop_code', workshop)
  }

  const validSortKey = ['name', 'product_code', 'category', 'physical_stock', 'safety_stock', 'stock_qty', 'workshop'].includes(sortKey) ? sortKey : 'name'
  const sortColumn = validSortKey === 'workshop' ? 'workshop_code' : validSortKey
  query = query.order(sortColumn, { ascending: sortDir === 'asc' })

  const start = (page - 1) * pageSize
  const end = start + pageSize - 1
  query = query.range(start, end)

  let pipelineQuery = supabase
    .from('product_pipeline_view')
    .select('*')
  if (search && activeTab === 'pipeline') {
    const numericPattern = numericTokenPattern(search)
    pipelineQuery = pipelineQuery.or(numericPattern
      ? `product_name.imatch."${numericPattern}",category.imatch."${numericPattern}"`
      : `product_name.ilike.%${search}%,category.ilike.%${search}%`)
  }
  pipelineQuery = pipelineQuery.limit(search && activeTab === 'pipeline' ? 1000 : 200)

  const [
    productsRes,
    { data: pipelineData },
    { data: workshops },
    { data: allCategories }
  ] = await Promise.all([
    query,
    pipelineQuery,
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
      activeTab={activeTab}
    />
  )
}
