import { createClient } from '@/utils/supabase/server'
import TransactionsClient from './TransactionsClient'

export default async function TransactionsPage({ searchParams = {} }) {
  const supabase = await createClient()
  const resolvedParams = await Promise.resolve(searchParams)
  const search = String(resolvedParams?.transactionSearch || '').replace(/[(),"]/g, ' ').trim()

  let transactionsQuery = supabase
    .from('transactions')
    .select('*, sales_orders(customers(name))')
    .order('date', { ascending: false })
    .limit(search ? 50000 : 1000)

  if (search) {
    const { data: matchedCustomers } = await supabase.from('customers').select('customer_code').or(`name.ilike.%${search}%,customer_code.ilike.%${search}%`)
    const customerCodes = (matchedCustomers || []).map(customer => customer.customer_code).filter(Boolean)
    const relatedOrderIds = []

    if (customerCodes.length) {
      const { data: customerOrders } = await supabase
        .from('sales_orders')
        .select('id')
        .in('customer_code', customerCodes)
      relatedOrderIds.push(...(customerOrders || []).map(order => order.id))
    }

    const uniqueOrderIds = [...new Set(relatedOrderIds)]
    const searchFilters = [
      `description.ilike.%${search}%`,
      `reference.ilike.%${search}%`,
      `workshop_code.ilike.%${search}%`,
      ...(uniqueOrderIds.length ? [`so_id.in.(${uniqueOrderIds.join(',')})`] : [])
    ]
    transactionsQuery = transactionsQuery.or(searchFilters.join(','))
  }

  const { data: transactions } = await transactionsQuery

  const { data: settings } = await supabase.from('system_settings').select('*').eq('key', 'dropdown_config').single()
  const dropdownConfig = settings?.value || {}

  return <TransactionsClient transactions={transactions || []} dropdownConfig={dropdownConfig} initialSearch={search} />
}
