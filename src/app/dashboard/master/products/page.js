import { createClient } from '@/utils/supabase/server'
import ProductsClient from './ProductsClient'

export default async function ProductsPage() {
  const supabase = await createClient()
  const [
    { data: products, error },
    { data: workshops }
  ] = await Promise.all([
    supabase
      .from('products')
      .select('*, workshops(name), product_units(id, unit_name, multiplier)')
      .order('created_at', { ascending: false }),
    supabase
      .from('workshops')
      .select('*')
      .order('name')
  ])

  return <ProductsClient products={products || []} error={error} workshops={workshops || []} />
}
