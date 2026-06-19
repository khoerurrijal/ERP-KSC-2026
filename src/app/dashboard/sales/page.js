import { createClient } from '@/utils/supabase/server'
import SalesClient from './SalesClient'

export const dynamic = 'force-dynamic'

export default async function SalesPage() {
  const supabase = await createClient()

  // Fetch sales orders with customer data and items
  const { data: rawOrders } = await supabase
    .from('sales_orders')
    .select(`
      *,
      customers (name),
      sales_items (qty, unit_price)
    `)
    .or('marketplace_receipt.is.null,marketplace_receipt.eq.""')
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(1000)

  const salesOrders = rawOrders || [];

  const { data: settings } = await supabase.from('system_settings').select('*').eq('key', 'dropdown_config').single()
  const dropdownConfig = settings?.value || {}

  return <SalesClient salesOrders={salesOrders} dropdownConfig={dropdownConfig} />
}
