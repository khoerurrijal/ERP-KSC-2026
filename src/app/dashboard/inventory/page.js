import { createClient } from '@/utils/supabase/server'
import InventoryClient from './InventoryClient'

export default async function InventoryPage() {
  const supabase = await createClient()

  // Fetch products with their workshop data
  const { data: products } = await supabase
    .from('products')
    .select(`
      *,
      workshops (name)
    `)
    .limit(100000)
    .order('name')

  return <InventoryClient products={products || []} />
}
