import { createClient } from '@/utils/supabase/server'
import SalesClient from './SalesClient'

export default async function SalesData({ searchParams = {} }) {
  const supabase = await createClient()

  const page = parseInt(searchParams.page || '1', 10)
  const pageSize = parseInt(searchParams.pageSize || '50', 10)
  const search = searchParams.search || ''
  const filterStatus = searchParams.status || 'BELUM_LUNAS'
  const filterCustomerType = searchParams.customerType || 'ALL'
  const filterMonth = searchParams.month || ''

  // 1. Calculate Date Bounds for Filter Month
  let startDate = ''
  let endDate = ''
  if (filterMonth) {
    const [y, m] = filterMonth.split('-').map(Number)
    const lastDay = new Date(y, m, 0).getDate()
    startDate = `${filterMonth}-01`
    endDate = `${filterMonth}-${String(lastDay).padStart(2, '0')}`
  }

  // 2. Summary KPI Query (Filtered by month if selected, or overall)
  let summaryQuery = supabase
    .from('sales_orders')
    .select('total_amount, dp_amount, payment_status, date')
    .or('marketplace_receipt.is.null,marketplace_receipt.eq.""')
    .neq('payment_status', 'BATAL')

  if (filterMonth) {
    summaryQuery = summaryQuery.gte('date', startDate).lte('date', endDate)
  }

  // 3. Main Sales Orders Query
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
    query = query.gte('date', startDate).lte('date', endDate)
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

  // 4. Sales Items Query
  let itemsQuery = supabase
    .from('sales_items')
    .select(`
      id, qty, unit_price, total_price, status, mockup_url, order_type, unit_multiplier, product_code, notes,
      sales_orders(invoice_number, date, payment_status, customers(name)),
      products(name)
    `)
    .order('id', { ascending: false })
    .limit(500)

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

  // Calculate Omset & Piutang accurately from summary dataset
  const serverTotalOmset = summaryOrders.reduce((sum, o) => sum + Number(o.total_amount || 0), 0)
  const serverTotalPiutang = summaryOrders
    .filter(o => o.payment_status !== 'LUNAS')
    .reduce((sum, o) => sum + Math.max(0, Number(o.total_amount || 0) - Number(o.dp_amount || 0)), 0)

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

