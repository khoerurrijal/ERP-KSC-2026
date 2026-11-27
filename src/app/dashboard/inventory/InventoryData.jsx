import { createClient } from '@/utils/supabase/server'
import InventoryClient from './InventoryClient'
import { buildAllTermsSearchFilter } from '@/utils/search'

const excludeNonStockServices = query =>
  query.not('category', 'in', '("JASA","Jasa Layanan")')

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
  const isStockTable = activeTab === 'table'
  const isPipelineTab = activeTab === 'pipeline'
  const tableSearch = isStockTable ? search : ''
  const tableCategory = isStockTable ? category : ''
  const tableWorkshop = isStockTable ? workshop : ''

  let query = excludeNonStockServices(supabase
    .from('products')
    .select(`
      *,
      workshops (name)
    `, { count: 'exact' })
  )

  if (!tableSearch) {
    query = query.eq('is_active', true)
  }

  if (tableSearch) {
    query = query.or(buildAllTermsSearchFilter(
      ['name', 'category', 'product_code'],
      tableSearch,
      { numericSubstringFields: ['product_code'] }
    ))
  }

  if (tableCategory) {
    query = query.eq('category', tableCategory)
  }

  if (tableWorkshop) {
    query = query.eq('workshop_code', tableWorkshop)
  }

  const validSortKey = ['name', 'product_code', 'category', 'physical_stock', 'safety_stock', 'stock_qty', 'workshop'].includes(sortKey) ? sortKey : 'name'
  const sortColumn = validSortKey === 'workshop' ? 'workshop_code' : validSortKey
  query = query.order(sortColumn, { ascending: sortDir === 'asc' })

  const start = (page - 1) * pageSize
  const end = start + pageSize - 1
  query = query.range(start, end)

  let pipelineQuery = excludeNonStockServices(supabase
    .from('product_pipeline_view')
    .select('*')
  )
  if (search && isPipelineTab) {
    pipelineQuery = pipelineQuery.or(buildAllTermsSearchFilter(['product_name', 'category'], search))
  }
  if (category && isPipelineTab) {
    pipelineQuery = pipelineQuery.eq('category', category)
  }
  pipelineQuery = pipelineQuery.limit(search && isPipelineTab ? 1000 : 200)

  const [
    productsRes,
    { data: pipelineData },
    { data: workshops },
    { data: allCategories }
  ] = await Promise.all([
    isStockTable ? query : Promise.resolve({ data: [], count: 0 }),
    isPipelineTab ? pipelineQuery : Promise.resolve({ data: [] }),
    supabase
      .from('workshops')
      .select('id, name, code')
      .order('name'),
    excludeNonStockServices(supabase
      .from('products')
      .select('category')
      .eq('is_active', true)
      .limit(300)
    )
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
