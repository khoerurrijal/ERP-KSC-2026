import { createClient } from '@/utils/supabase/server'
import MarketplaceClient from './MarketplaceClient'

export default async function MarketplacePage() {
  const supabase = await createClient()

  // Include marketplace orders even when the marketplace receipt is still empty,
  // so an operator can repair missing order numbers from this screen.
  const { data: customers } = await supabase
    .from('customers')
    .select('customer_code, name, type')

  const marketplaceCustomerCodes = (customers || [])
    .filter(customer => {
      const identity = `${String(customer.name || '')} ${String(customer.type || '')}`.toUpperCase()
      return identity.includes('MARKETPLACE') || ['SHOPEE', 'TOKOPEDIA', 'TIKTOK'].some(platform => identity.includes(platform))
    })
    .map(customer => customer.customer_code)
    .filter(Boolean)

  let rawOrders = []
  if (marketplaceCustomerCodes.length > 0) {
    const pageSize = 1000
    const allOrders = []

    for (let from = 0; ; from += pageSize) {
      const { data, error } = await supabase
        .from('sales_orders')
        .select(`
          *,
          customers (name, type),
          sales_items (qty, unit_price)
        `)
        .in('customer_code', marketplaceCustomerCodes)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false })
        .order('id', { ascending: true })
        .range(from, from + pageSize - 1)

      if (error) throw error

      const pageOrders = data || []
      allOrders.push(...pageOrders)
      if (pageOrders.length < pageSize) break
    }

    rawOrders = allOrders.filter(order => {
      const paymentStatus = String(order.payment_status || '').toUpperCase()
      const settlementStatus = String(order.marketplace_settlement_status || 'PENDING').toUpperCase()
      return paymentStatus !== 'LUNAS'
        && paymentStatus !== 'BATAL'
        && settlementStatus !== 'SETTLED_EXTERNAL'
    })
  }

  const marketplaceOrders = rawOrders

  const { data: settings } = await supabase.from('system_settings').select('*').eq('key', 'dropdown_config').single()
  const dropdownConfig = settings?.value || {}

  return <MarketplaceClient marketplaceOrders={marketplaceOrders} dropdownConfig={dropdownConfig} />
}
