import { createClient } from '@/utils/supabase/server'
import { notFound } from 'next/navigation'
import TrackClient from './TrackClient'

export const dynamic = 'force-dynamic'

export default async function PublicTrackingPage({ params }) {
  const { id } = await params
  const supabase = await createClient()

  // Find sales order by ID
  const { data: order } = await supabase
    .from('sales_orders')
    .select(`
      *,
      customers (name, phone),
      sales_items (
        id,
        product_code,
        product_name,
        qty,
        unit_price,
        total_price,
        status,
        unit_multiplier
      )
    `)
    .eq('id', id)
    .single()

  if (!order) {
    notFound()
  }

  // Find production logs for this order
  const { data: logs } = await supabase
    .from('production_logs')
    .select('*')
    .eq('sales_order_id', id)
    .order('created_at', { ascending: false })

  // Find company settings to get the brand logo/name
  const { data: settings } = await supabase
    .from('settings')
    .select('*')
    .limit(1)
    .single()

  return <TrackClient order={order} logs={logs || []} settings={settings || {}} />
}
