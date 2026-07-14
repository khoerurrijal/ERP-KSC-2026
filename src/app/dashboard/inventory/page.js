import { createClient } from '@/utils/supabase/server'
import InventoryClient from './InventoryClient'

export const dynamic = 'force-dynamic'

export default async function InventoryPage() {
  const supabase = await createClient()

  // Fetch products, pipeline, and workshops
  const [
    { data: products },
    { data: pipelineData },
    { data: workshops }
  ] = await Promise.all([
    supabase
      .from('products')
      .select(`
        *,
        workshops (name)
      `)
      .eq('is_active', true)
      .limit(100000)
      .order('name'),
    supabase
      .from('product_pipeline_view')
      .select('*')
      .limit(100000),
    supabase
      .from('workshops')
      .select('*')
      .order('name')
  ])

  return (
    <InventoryClient 
      products={products || []} 
      pipelineData={pipelineData || []} 
      workshops={workshops || []}
    />
  )
}
