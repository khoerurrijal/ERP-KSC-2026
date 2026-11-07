import { createClient } from '@/utils/supabase/server'
import ProductsClient from './ProductsClient'
import { numericTokenPattern } from '@/utils/search'

export default async function ProductsPage({ searchParams }) {
  const supabase = await createClient()
  const resolvedParams = await Promise.resolve(searchParams || {})
  const search = String(resolvedParams.search || '').replace(/[(),"]/g, ' ').trim()
  let matchedWorkshopCodes = []

  if (search) {
    const { data: matchingWorkshops } = await supabase
      .from('workshops')
      .select('code')
      .ilike('name', `%${search}%`)
    matchedWorkshopCodes = (matchingWorkshops || []).map(workshop => workshop.code).filter(Boolean)
  }

  let productsQuery = supabase
    .from('products')
    .select('*, workshops(name), product_units(id, unit_name, multiplier)')
    .order('created_at', { ascending: false })

  if (search) {
    const numericPattern = numericTokenPattern(search)
    const searchFilters = numericPattern
      ? [`name.imatch."${numericPattern}"`, `category.imatch."${numericPattern}"`, `product_code.ilike.%${search}%`]
      : [`name.ilike.%${search}%`, `category.ilike.%${search}%`, `product_code.ilike.%${search}%`]
    if (matchedWorkshopCodes.length) searchFilters.push(`workshop_code.in.(${matchedWorkshopCodes.join(',')})`)
    productsQuery = productsQuery.or(searchFilters.join(','))
  }

  const [
    { data: products, error },
    { data: workshops }
  ] = await Promise.all([
    productsQuery,
    supabase
      .from('workshops')
      .select('*')
      .order('name')
  ])

  return <ProductsClient products={products || []} error={error} workshops={workshops || []} initialSearch={search} />
}
