import { createClient } from '@/utils/supabase/server'
import MarketplaceClient from './MarketplaceClient'

export default async function MarketplacePage() {
  const supabase = await createClient()

  // Include marketplace orders even when the marketplace receipt is still empty,
  // so an operator can repair missing order numbers from this screen.
  const { data: customers } = await supabase
    .from('customers')
    .select('customer_code, type')

  const marketplaceCustomerCodes = (customers || [])
    .filter(customer => {
      const type = String(customer.type || '').toUpperCase()
      return type.includes('MARKETPLACE') || ['SHOPEE', 'TOKOPEDIA', 'TIKTOK'].some(platform => type.includes(platform))
    })
    .map(customer => customer.customer_code)
    .filter(Boolean)

  let rawOrders = []
  if (marketplaceCustomerCodes.length > 0) {
    const { data } = await supabase
      .from('sales_orders')
      .select(`
        *,
        customers (name, type),
        sales_items (qty, unit_price)
      `)
      .in('customer_code', marketplaceCustomerCodes)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(1000)
    rawOrders = data || []
  }

  const validOrders = rawOrders || []

  const marketplaceOrders = validOrders;

  const { data: settings } = await supabase.from('system_settings').select('*').eq('key', 'dropdown_config').single()
  const dropdownConfig = settings?.value || {}

  return <MarketplaceClient marketplaceOrders={marketplaceOrders} dropdownConfig={dropdownConfig} />
}
