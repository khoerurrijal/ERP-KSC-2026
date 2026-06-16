import { createClient } from '@/utils/supabase/server'
import ProductsClient from './ProductsClient'

export default async function ProductsPage() {
  const supabase = await createClient()
  const { data: products, error } = await supabase
    .from('products')
    .select('*, workshops(name)')
    .order('created_at', { ascending: false })

  return <ProductsClient products={products || []} error={error} />
}
