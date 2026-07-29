import { createClient } from '@/utils/supabase/server'
import SalesClient from './SalesClient'

// Komponen server ini di-render di dalam Suspense boundary di page.js
// sehingga layout dashboard bisa muncul instan, data dimuat secara streaming
export default async function SalesData({ searchParams = {} }) {
  const supabase = await createClient()

  const page = parseInt(searchParams.page || '1', 10)
  const pageSize = parseInt(searchParams.pageSize || '50', 10)
  const search = searchParams.search || ''
  const filterStatus = searchParams.status || 'BELUM_LUNAS'
  const filterCustomerType = searchParams.customerType || 'ALL'
  const filterMonth = searchParams.month || ''

  let query = supabase
    .from('sales_orders')
    .select(`
      *,
      customers (name, type),
      sales_items (qty, unit_price)
    `, { count: 'exact' })
    .or('marketplace_receipt.is.null,marketplace_receipt.eq.""')

  if (search) {
    query = query.or(`invoice_number.ilike.%${search}%`)
  }

  if (filterMonth) {
    const [y, m] = filterMonth.split('-').map(Number)
    const startDate = `${filterMonth}-01`
    const endDate = new Date(y, m, 1).toISOString().slice(0, 10)
    query = query.gte('date', startDate).lt('date', endDate)
  }

  if (filterStatus === 'BELUM_LUNAS') {
    query = query.in('payment_status', ['BELUM LUNAS', 'DP'])
  } else if (filterStatus === 'LUNAS') {
    query = query.eq('payment_status', 'LUNAS')
  }

  query = query.order('date', { ascending: false }).order('created_at', { ascending: false })

  const start = (page - 1) * pageSize
  const end = start + pageSize - 1
  query = query.range(start, end)

  let itemsQuery = supabase
    .from('sales_items')
    .select(`
      id, qty, unit_price, total_price, product_name, item_name, status, mockup_url, order_type, unit_multiplier, product_code,
      sales_orders!inner(invoice_number, date, payment_status, customers(name)),
      products(name)
    `)
  
  if (filterMonth) {
    const [y, m] = filterMonth.split('-').map(Number)
    const startDate = `${filterMonth}-01`
    const endDate = new Date(y, m, 1).toISOString().slice(0, 10)
    itemsQuery = itemsQuery.gte('sales_orders.date', startDate).lt('sales_orders.date', endDate)
  }

  itemsQuery = itemsQuery.order('id', { ascending: false }).limit(300)

  const [salesOrdersResult, salesItemsResult, settingsResult] = await Promise.all([
    query,
    itemsQuery,
    supabase
      .from('system_settings')
      .select('value')
      .eq('key', 'dropdown_config')
      .single()
  ])

  const salesOrders = salesOrdersResult.data || []
  const totalCount = salesOrdersResult.count || 0
  const salesItems = salesItemsResult.data || []
  const dropdownConfig = settingsResult.data?.value || {}

  return (
    <SalesClient
      salesOrders={salesOrders}
      totalCount={totalCount}
      page={page}
      pageSize={pageSize}
      salesItems={salesItems}
      dropdownConfig={dropdownConfig}
      searchParams={searchParams}
    />
  )
}
