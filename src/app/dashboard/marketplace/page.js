import { createClient } from '@/utils/supabase/server'
import MarketplaceClient from './MarketplaceClient'

export default async function MarketplacePage() {
  const supabase = await createClient()

  // Fetch sales orders where marketplace_receipt is not null
  const { data: rawOrders } = await supabase
    .from('sales_orders')
    .select(`
      *,
      customers (name, type),
      sales_items (qty, unit_price)
    `)
    .not('marketplace_receipt', 'is', null)
    .neq('marketplace_receipt', '')
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(1000)

  const validOrders = rawOrders || []

  const marketplaceOrders = validOrders;

  const { data: settings } = await supabase.from('system_settings').select('*').eq('key', 'dropdown_config').single()
  const dropdownConfig = settings?.value || {}

  return <MarketplaceClient marketplaceOrders={marketplaceOrders} dropdownConfig={dropdownConfig} />
}
