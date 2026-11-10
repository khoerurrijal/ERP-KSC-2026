import { createClient } from '@/utils/supabase/server'
import ProductionTable from '@/components/ProductionTable'
import { handleAutoStatusUpdate } from './actions'

export default async function ProductionData({ mode = 'production', embedded = false, searchParams = {} } = {}) {
  const supabase = await createClient()
  const search = String(searchParams.search || '').replace(/[(),\"]/g, ' ').trim()

  if (mode === 'status') {
    const { data: paidDeliveryItems, error: paidItemsError } = await supabase
      .from('sales_items')
      .select('id, sales_orders!inner(payment_status)')
      .eq('sales_orders.payment_status', 'LUNAS')
      .in('status', ['DIKIRIM', 'SUDAH DIAMBIL'])
      .in('order_type', ['SABLON', 'POLOS', 'PRINTING'])
      .limit(10000)

    if (!paidItemsError && paidDeliveryItems?.length) {
      for (const item of paidDeliveryItems) {
        await handleAutoStatusUpdate(item.id)
      }
    }
  }
  
  const { data: { user } } = await supabase.auth.getUser()
  const userEmail = user?.email?.toLowerCase() || ''

  let matchedOrderIds = []
  let matchedProductCodes = []
  if (search && mode === 'production') {
    const [customersResult, productsResult] = await Promise.all([
      supabase.from('customers').select('customer_code').or(`name.ilike.%${search}%,customer_code.ilike.%${search}%`),
      supabase.from('products').select('product_code').or(`name.ilike.%${search}%,product_code.ilike.%${search}%`)
    ])
    matchedProductCodes = (productsResult.data || []).map(product => product.product_code).filter(Boolean)

    const customerCodes = (customersResult.data || []).map(customer => customer.customer_code).filter(Boolean)
    if (customerCodes.length) {
      const { data: customerOrders } = await supabase.from('sales_orders').select('id').in('customer_code', customerCodes)
      matchedOrderIds.push(...(customerOrders || []).map(order => order.id).filter(Boolean))
    }
    matchedOrderIds = [...new Set(matchedOrderIds)]
  }

  let productionItemsQuery = supabase
    .from('sales_items')
    .select(`
      id,
      product_code,
      qty,
      unit_multiplier,
      status,
      mockup_url,
      order_type,
      notes,
      sales_orders (id, invoice_number, date, notes, payment_status, marketplace_receipt, customers (name)),
      products (name, workshop_code),
      production_logs (qty_processed)
    `)
    .order('id', { ascending: false })

  if (search && mode === 'production') {
    const searchFilters = [
      `product_code.ilike.%${search}%`,
      `notes.ilike.%${search}%`,
      `status.ilike.%${search}%`,
      ...(matchedProductCodes.length ? [`product_code.in.(${matchedProductCodes.join(',')})`] : []),
      ...(matchedOrderIds.length ? [`so_id.in.(${matchedOrderIds.join(',')})`] : [])
    ]
    productionItemsQuery = productionItemsQuery.or(searchFilters.join(','))
  } else if (mode === 'production') {
    productionItemsQuery = productionItemsQuery.in('status', ['SIAP PROSES', 'PROSES', 'Proses'])
  } else {
    productionItemsQuery = productionItemsQuery.in('status', ['SIAP PROSES', 'PROSES', 'Proses'])
  }
  productionItemsQuery = productionItemsQuery.limit(search && mode === 'production' ? 50000 : 500)

  const [
    { data: settingsData },
    { data: operatorsData },
    { data: rawItems }
  ] = await Promise.all([
    supabase.from('system_settings').select('value').eq('key', 'user_roles').single(),
    supabase.from('employees').select('id, full_name, salary_schemas(role_name)').eq('is_active', true),
    productionItemsQuery
  ])

  const userRoles = settingsData?.value || []
  let userRole = 'Operator'
  let currentUserName = ''
  
  const matchedUser = userRoles.find(u => {
    const inputEmail = (u.email || '').trim().toLowerCase()
    return inputEmail === userEmail || `${inputEmail}@kingsablon.com` === userEmail
  })
  
  if (matchedUser) {
    userRole = matchedUser.role
  }

  const operators = (operatorsData || []).filter(o => 
    o.salary_schemas?.role_name?.toLowerCase().includes('operator')
  ).map(o => ({
    id: o.id,
    full_name: o.full_name,
    role_name: o.salary_schemas?.role_name
  }))

  const productionJobs = (rawItems || []).map(item => ({
    id: item.id,
    so_id: item.sales_orders?.id,
    order_type: item.order_type,
    qty_target: item.qty * (item.unit_multiplier || 1) * (/2\s*warna|warna\s*ke-?2/i.test(item.notes || '') ? 2 : 1),
    sales_order_items: {
      qty: item.qty,
      sales_orders: { 
        invoice_number: item.sales_orders?.invoice_number,
        payment_status: item.sales_orders?.payment_status,
        marketplace_receipt: item.sales_orders?.marketplace_receipt,
        customers: { name: item.sales_orders?.customers?.name }
      },
      products: { 
        name: item.products?.name,
        product_name: item.products?.name
      }
    },
    order_date: item.sales_orders?.date,
    target_date: (() => {
      if (!item.sales_orders?.date) return null
      const orderDate = new Date(item.sales_orders.date)
      const soNotes = (item.sales_orders.notes || '').toLowerCase()
      const itemNotes = (item.notes || '').toLowerCase()
      const isFastTrack = soNotes.includes('fast track') || itemNotes.includes('fast_track') || itemNotes.includes('fast track')
      const targetDate = new Date(orderDate)
      targetDate.setDate(targetDate.getDate() + (isFastTrack ? 1 : 4))
      return targetDate.toISOString()
    })(),
    is_fast_track: (item.sales_orders?.notes || '').toLowerCase().includes('fast track') || (item.notes || '').toLowerCase().includes('fast_track') || (item.notes || '').toLowerCase().includes('fast track'),
    is_two_color: /2\s*warna|warna\s*ke-?2/i.test(item.notes || ''),
    notes: item.notes,
    status: item.status || 'BARU MASUK',
    item_status: item.status || 'BARU MASUK',
    mockup_url: item.mockup_url,
    qty_processed: (item.production_logs || []).reduce((acc, log) => acc + (log.qty_processed || 0), 0)
  }))

  const matchedOperator = operators.find(o => o.full_name?.toLowerCase().includes(userEmail.split('@')[0].toLowerCase()))
  if (matchedOperator) {
    currentUserName = matchedOperator.full_name
  } else if (matchedUser && matchedUser.email) {
    currentUserName = matchedUser.email
  }

  return (
    <ProductionTable 
      productionJobs={productionJobs} 
      operators={operators} 
      currentUser={userEmail} 
      userRole={userRole} 
      currentUserName={currentUserName} 
      initialSearch={search}
      initialTab={mode === 'status' ? 'SO' : 'PRODUKSI'}
      hideTabs={mode === 'production' || embedded}
      hideHeader={embedded}
      title={mode === 'production' ? 'Produksi' : 'Status Pesanan'}
    />
  )
}
