import { createClient } from '@/utils/supabase/server'
import { matchesSearchText } from '@/utils/search'
import SalesClient from './SalesClient'

export default async function SalesData({ searchParams = {}, itemsOnly = false }) {
  const supabase = await createClient()

  const page = parseInt(searchParams.page || '1', 10)
  const pageSize = parseInt(searchParams.pageSize || '50', 10)
  const search = String(searchParams.search || '').trim()
  const directOrderId = search ? '' : String(searchParams.orderId || '').trim()
  const filterStatus = searchParams.status || 'BELUM_LUNAS'
  const filterCustomerType = searchParams.customerType || 'ALL'
  const now = new Date()
  const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const filterMonth = searchParams.month || defaultMonth

  // 1. Calculate Date Bounds for Filter Month
  let startDate = ''
  let endDate = ''
  if (filterMonth) {
    const [y, m] = filterMonth.split('-').map(Number)
    const lastDay = new Date(y, m, 0).getDate()
    startDate = `${filterMonth}-01`
    endDate = `${filterMonth}-${String(lastDay).padStart(2, '0')}`
  }

  // Helper search lookup for customer & product codes
  let matchedCustCodes = []
  let matchedProductCodes = []
  let matchedSoIds = []

  let safeSearch = search ? search.replace(/[(),"]/g, ' ').trim() : ''

  if (safeSearch) {
    const [custRes, prodRes] = await Promise.all([
      supabase.from('customers').select('customer_code, name').or(`name.ilike.%${safeSearch}%,customer_code.ilike.%${safeSearch}%`).limit(50000),
      supabase.from('products').select('product_code, name').or(`name.ilike.%${safeSearch}%,product_code.ilike.%${safeSearch}%`).limit(50000)
    ])

    matchedCustCodes = (custRes.data || [])
      .filter(customer => matchesSearchText(customer.name, safeSearch) || matchesSearchText(customer.customer_code, safeSearch))
      .map(customer => customer.customer_code)
      .filter(Boolean)
    matchedProductCodes = (prodRes.data || [])
      .filter(product => matchesSearchText(product.name, safeSearch) || matchesSearchText(product.product_code, safeSearch))
      .map(product => product.product_code)
      .filter(Boolean)
    
    // Also fetch SO IDs that belong to the matched customers to ensure sales_items can be searched by customer name
    let additionalSoIds = []
    if (matchedCustCodes.length > 0) {
      const { data: custSoRes } = await supabase.from('sales_orders').select('id').in('customer_code', matchedCustCodes)
      additionalSoIds = (custSoRes || []).map(s => s.id)
    }
    
    matchedSoIds = additionalSoIds.filter(Boolean)
  }

  // 2. Summary KPI Query untuk bulan terpilih
  let summaryQuery = supabase
    .from('sales_orders')
    .select('total_amount, dp_amount, payment_status, date')
    .or('marketplace_receipt.is.null,marketplace_receipt.eq.""')
    .neq('payment_status', 'BATAL')

  // Piutang berjalan selalu seluruh waktu; hanya transaksi marketplace,
  // batal, dan yang sudah lunas dikeluarkan dari perhitungannya.
  const piutangQuery = supabase
    .from('sales_orders')
    .select('total_amount, dp_amount, payment_status')
    .or('marketplace_receipt.is.null,marketplace_receipt.eq.""')
    .neq('payment_status', 'BATAL')

  summaryQuery = summaryQuery.gte('date', startDate).lte('date', endDate)

  // 3. Main Sales Orders Query
  let query = supabase
    .from('sales_orders')
    .select(`
      *,
      customers (name, type),
      sales_items (id, order_type, product_code, qty, unit, unit_multiplier, unit_price, mockup_url, notes, status)
    `, { count: 'exact' })

  // Marketplace orders are excluded from the default operational list, but
  // a lookup must be able to find every matching Sales Order.
  if (!safeSearch && !directOrderId) {
    query = query.or('marketplace_receipt.is.null,marketplace_receipt.eq.""')
  }

  const searchFilters = safeSearch
    ? [
        `payment_status.ilike.%${safeSearch}%`,
        ...(matchedCustCodes.length > 0 ? [`customer_code.in.(${matchedCustCodes.join(',')})`] : [])
      ]
    : []

  if (directOrderId) query = query.eq('id', directOrderId)

  // Keep unpaid orders from earlier months visible in the selected month view.
  const monthConditionGroups = filterMonth && !safeSearch && !directOrderId
    ? [
        [`date.gte.${startDate}`, `date.lte.${endDate}`],
        ...(filterStatus === 'LUNAS' ? [] : [[`date.lt.${startDate}`, 'payment_status.in.(BELUM LUNAS,DP)']])
      ]
    : []

  const orderFilters = monthConditionGroups.length
    ? monthConditionGroups.flatMap(group =>
        searchFilters.length
          ? searchFilters.map(searchFilter => `and(${[...group, searchFilter].join(',')})`)
          : [`and(${group.join(',')})`]
      )
    : searchFilters

  if (orderFilters.length) {
    query = query.or(orderFilters.join(','))
  }

  if (!safeSearch && !directOrderId && filterStatus === 'BELUM_LUNAS') {
    query = query.in('payment_status', ['BELUM LUNAS', 'DP'])
  } else if (!safeSearch && !directOrderId && filterStatus === 'LUNAS') {
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
      sales_orders!inner(invoice_number, date, payment_status, marketplace_receipt, customers(name)),
      products(name)
    `)

  if (filterMonth && !safeSearch && !directOrderId) {
    itemsQuery = itemsQuery.gte('sales_orders.date', startDate).lte('sales_orders.date', endDate)
  }

  if (directOrderId) {
    itemsQuery = itemsQuery.eq('so_id', directOrderId)
  } else if (safeSearch) {
    const itemOrConditions = [`product_code.ilike.%${safeSearch}%`]
    if (matchedProductCodes.length > 0) itemOrConditions.push(`product_code.in.(${matchedProductCodes.join(',')})`)
    if (matchedSoIds.length > 0) itemOrConditions.push(`so_id.in.(${matchedSoIds.join(',')})`)
    if (itemOrConditions.length) itemsQuery = itemsQuery.or(itemOrConditions.join(','))
    else itemsQuery = itemsQuery.eq('product_code', '__NO_PRODUCT_SEARCH_MATCH__')
  }

  itemsQuery = itemsQuery.order('id', { ascending: false }).limit(safeSearch ? 50000 : 1000)

  const [salesOrdersResult, salesItemsResult, settingsResult, summaryResult, piutangResult, customersResult, productsResult, workshopsResult] = await Promise.all([
    query,
    itemsQuery,
    supabase.from('system_settings').select('key, value').in('key', ['dropdown_config', 'pricelist_config']),
    summaryQuery,
    piutangQuery,
    supabase.from('customers').select('*').order('name'),
    supabase.from('products').select('*, product_units(id, unit_name, multiplier)').order('name'),
    supabase.from('workshops').select('*').order('name')
  ])

  const salesOrders = salesOrdersResult.data || []
  const totalCount = salesOrdersResult.count || 0
  const salesItems = salesItemsResult.data || []
  const settings = settingsResult.data || []
  const dropdownConfig = settings.find(setting => setting.key === 'dropdown_config')?.value || {}
  const pricelistConfig = settings.find(setting => setting.key === 'pricelist_config')?.value || {}
  const summaryOrders = summaryResult.data || []
  const piutangOrders = piutangResult.data || []

  // Calculate Omset & Piutang accurately from summary dataset
  const serverTotalOmset = summaryOrders.reduce((sum, o) => sum + Number(o.total_amount || 0), 0)
  const serverTotalPiutang = piutangOrders
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
      pricelistConfig={pricelistConfig}
      customers={customersResult.data || []}
      products={productsResult.data || []}
      workshops={workshopsResult.data || []}
      searchParams={{ ...searchParams, month: filterMonth }}
      serverTotalOmset={serverTotalOmset}
      serverTotalPiutang={serverTotalPiutang}
      initialTab={itemsOnly ? 'ITEMS' : 'INVOICE'}
      embedded={itemsOnly}
      showItemsTab={false}
    />
  )
}

