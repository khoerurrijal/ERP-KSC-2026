import { createClient } from '@/utils/supabase/server'
import TransactionsClient from './TransactionsClient'

export default async function TransactionsPage({ searchParams = {} }) {
  const supabase = await createClient()
  const resolvedParams = await Promise.resolve(searchParams)
  const search = String(resolvedParams?.transactionSearch || '').replace(/[(),"]/g, ' ').trim()

  let transactionsQuery = supabase
    .from('transactions')
    .select('*, sales_orders(invoice_number, customers(name))')
    .order('date', { ascending: false })
    .limit(search ? 50000 : 1000)

  if (search) {
    const [matchedCustomers, matchedOrders] = await Promise.all([
      supabase.from('customers').select('customer_code').ilike('name', `%${search}%`),
      supabase.from('sales_orders').select('id').ilike('invoice_number', `%${search}%`)
    ])
    const customerCodes = (matchedCustomers.data || []).map(customer => customer.customer_code).filter(Boolean)
    const relatedOrderIds = (matchedOrders.data || []).map(order => order.id)

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
