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

  // 1. KPI Summary Query (Computed over entire month without page limit)
  const targetMonth = filterMonth || new Date().toISOString().slice(0, 7)
  const [sy, sm] = targetMonth.split('-').map(Number)
  const sStart = `${targetMonth}-01`
  const sEnd = new Date(sy, sm, 1).toISOString().slice(0, 10)

  const summaryQuery = supabase
    .from('sales_orders')
    .select('grand_total, total_amount, dp_amount, payment_status')
    .or('marketplace_receipt.is.null,marketplace_receipt.eq.""')
    .gte('date', sStart)
    .lt('date', sEnd)
    .neq('payment_status', 'BATAL')

  // 2. Main Sales Orders Table Query
  let query = supabase
    .from('sales_orders')
    .select(`
      *,
      customers!inner (name, type),
      sales_items (qty, unit_price)
    `, { count: 'exact' })
    .or('marketplace_receipt.is.null,marketplace_receipt.eq.""')

  if (search) {
    query = query.or(`invoice_number.ilike.%${search}%,customers.name.ilike.%${search}%`)
  }

  if (filterCustomerType !== 'ALL') {
    query = query.eq('customers.type', filterCustomerType)
  }

  if (filterMonth) {
    query = query.gte('date', sStart).lt('date', sEnd)
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

  // 3. Sales Items Query
  let itemsQuery = supabase
    .from('sales_items')
    .select(`
      id, qty, unit_price, total_price, product_name, item_name, status, mockup_url, order_type, unit_multiplier, product_code,
      sales_orders!inner(invoice_number, date, payment_status, customers(name)),
      products(name)
    `)
  
  if (filterMonth) {
    itemsQuery = itemsQuery.gte('sales_orders.date', sStart).lt('sales_orders.date', sEnd)
  }

  itemsQuery = itemsQuery.order('id', { ascending: false }).limit(300)

  const [salesOrdersResult, salesItemsResult, settingsResult, summaryResult] = await Promise.all([
    query,
    itemsQuery,
    supabase
      .from('system_settings')
      .select('value')
      .eq('key', 'dropdown_config')
      .single(),
    summaryQuery
  ])

  const salesOrders = salesOrdersResult.data || []
  const totalCount = salesOrdersResult.count || 0
  const salesItems = salesItemsResult.data || []
  const dropdownConfig = settingsResult.data?.value || {}
  const summaryOrders = summaryResult.data || []

  // Compute server-side totals for the target month
  const serverTotalOmset = summaryOrders.reduce((sum, o) => sum + Number(o.grand_total || o.total_amount || 0), 0)
  const serverTotalPiutang = summaryOrders
    .filter(o => o.payment_status !== 'LUNAS')
    .reduce((sum, o) => sum + Math.max(0, Number(o.grand_total || o.total_amount || 0) - Number(o.dp_amount || 0)), 0)

  return (
    <SalesClient
      salesOrders={salesOrders}
      totalCount={totalCount}
      page={page}
      pageSize={pageSize}
      salesItems={salesItems}
      dropdownConfig={dropdownConfig}
      searchParams={searchParams}
      serverTotalOmset={serverTotalOmset}
      serverTotalPiutang={serverTotalPiutang}
    />
  )
}

