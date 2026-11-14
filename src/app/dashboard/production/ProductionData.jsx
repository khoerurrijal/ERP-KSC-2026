import { createClient } from '@/utils/supabase/server'
import {
  getAutomaticProductionProgressQty,
  getProductionItemProgress,
  getRecalculatedProductionStatus,
  reconcileProductionColorPasses
} from '@/utils/productionColorPasses.mjs'
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

  const productionItemBaseSelection = `
      id,
      product_code,
      qty,
      unit_multiplier,
      status,
      mockup_url,
      order_type,
      notes,
      sales_orders (id, invoice_number, date, notes, payment_status, marketplace_receipt, customers (name)),
      products (name, workshop_code)
    `
  const productionItemSelection = `
      ${productionItemBaseSelection},
      production_logs (id, qty_processed, qty_defect, employee_id, notes, processed_date, created_at)
    `

  let productionItemsQuery = supabase
    .from('sales_items')
    .select(productionItemSelection)
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
    productionItemsQuery = productionItemsQuery.in('status', [
      'SIAP PROSES', 'PROSES', 'Proses', 'PROSES WARNA 1', 'PROSES WARNA 2'
    ])
  } else {
    productionItemsQuery = productionItemsQuery.in('status', [
      'SIAP PROSES', 'PROSES', 'Proses', 'PROSES WARNA 1', 'PROSES WARNA 2'
    ])
  }
  productionItemsQuery = productionItemsQuery.limit(search && mode === 'production' ? 50000 : 500)

  const staleReadyItemsQuery = mode === 'production' && !search
    ? supabase.from('sales_items')
      .select(`${productionItemBaseSelection}, production_logs!inner(id, qty_processed, qty_defect, employee_id, notes, processed_date, created_at)`)
      .eq('order_type', 'SABLON')
      .eq('status', 'SIAP KIRIM')
      .order('id', { ascending: false })
      .limit(500)
    : null

  const [
    { data: settingsData },
    { data: operatorsData },
    { data: activeRawItems },
    { data: staleReadyItems }
  ] = await Promise.all([
    supabase.from('system_settings').select('value').eq('key', 'user_roles').single(),
    supabase.from('employees').select('id, full_name, salary_schemas(role_name)').eq('is_active', true),
    productionItemsQuery,
    staleReadyItemsQuery || Promise.resolve({ data: [] })
  ])

  const rawItemsById = new Map()
  for (const item of [...(activeRawItems || []), ...(staleReadyItems || [])]) rawItemsById.set(item.id, item)
  const rawItems = [...rawItemsById.values()]

  const userRoles = settingsData?.value || []
  let userRole = 'Operator'
  
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

  const operatorIdentity = userEmail.split('@')[0].replace(/[^a-z0-9]/g, '')
  const matchedOperator = operatorIdentity
    ? operators.find(o => o.full_name?.toLowerCase().replace(/[^a-z0-9]/g, '').includes(operatorIdentity))
    : null
  const isOperatorAccount = ['operator', 'operator mesin'].includes(String(userRole).toLowerCase())
  const visibleOperators = isOperatorAccount
    ? (matchedOperator ? [matchedOperator] : [])
    : operators

  let productionHistory = []
  const canSeeProductionAccumulation = (
    ['Owner', 'Admin'].includes(userRole) || (isOperatorAccount && Boolean(matchedOperator))
  ) && mode === 'production' && !embedded
  if (canSeeProductionAccumulation) {
    let productionLogsQuery = supabase
      .from('production_logs')
      .select('id, job_id, employee_id, qty_processed, qty_defect, processed_date, created_at, notes')
      .order('created_at', { ascending: false })
      .limit(10000)
    if (isOperatorAccount) productionLogsQuery = productionLogsQuery.eq('employee_id', matchedOperator.id)
    const { data: rawLogs } = await productionLogsQuery

    const jobIds = [...new Set((rawLogs || []).map(log => log.job_id).filter(Boolean))]
    const employeeIds = [...new Set((rawLogs || []).map(log => log.employee_id).filter(Boolean))]
    const [{ data: historyItems }, { data: historyEmployees }] = await Promise.all([
      jobIds.length
        ? supabase.from('sales_items').select('id, product_code, order_type, qty, unit_multiplier, notes, sales_orders (invoice_number, customers (name)), products (name)').in('id', jobIds)
        : Promise.resolve({ data: [] }),
      employeeIds.length
        ? supabase.from('employees').select('id, full_name').in('id', employeeIds)
        : Promise.resolve({ data: [] })
    ])

    const historyReconciliation = reconcileProductionColorPasses(historyItems || [], rawLogs || [])
    const itemById = new Map((historyItems || []).map(item => [item.id, item]))
    const employeeById = new Map((historyEmployees || []).map(employee => [employee.id, employee.full_name]))
    productionHistory = (rawLogs || []).flatMap(log => {
      const item = itemById.get(log.job_id)
      const isTwoColor = /2\s*warna|warna\s*ke-?2/i.test(item?.notes || '')
      const effectiveQty = historyReconciliation.effectiveQtyByLogId.get(String(log.id)) ?? Number(log.qty_processed || 0)
      if (isTwoColor && effectiveQty === 0) return []
      return [{
        id: log.id,
        job_id: log.job_id,
        employee_id: log.employee_id || 'unassigned',
        employee_name: employeeById.get(log.employee_id) || (log.employee_id ? 'Karyawan tidak diketahui' : 'Tanpa operator'),
        qty_processed: effectiveQty,
        source_qty_processed: Number(log.qty_processed || 0),
        qty_defect: Number(log.qty_defect || 0),
        source_qty_defect: log.qty_defect ?? null,
        processed_date: log.processed_date,
        created_at: log.created_at,
        notes: log.notes ?? null,
        product_name: item?.products?.name || item?.product_code || 'Item dihapus',
        customer_name: item?.sales_orders?.customers?.name || '-',
        invoice_number: item?.sales_orders?.invoice_number || '',
        order_type: item?.order_type || '-',
        is_two_color: isTwoColor,
        color_pass: historyReconciliation.colorPassByLogId.get(String(log.id)) || null
      }]
    })
  }

  const itemProductionLogs = (rawItems || []).flatMap(item => (
    (item.production_logs || []).map(log => ({ ...log, job_id: item.id }))
  ))
  const productionColorReconciliation = reconcileProductionColorPasses(rawItems || [], itemProductionLogs)

  const productionJobs = (rawItems || []).map(item => {
    const isTwoColor = /2\s*warna|warna\s*ke-?2/i.test(item.notes || '')
    const qtyPerColorTarget = Number(item.qty || 0) * Number(item.unit_multiplier || 1)
    const productionLogs = item.production_logs || []
    const progress = getProductionItemProgress(item, productionLogs.map(log => ({ ...log, job_id: item.id })))
    const salesOrder = item.sales_orders || {}
    const customerName = salesOrder.customers?.name?.toLowerCase() || ''
    const isPaid = ['LUNAS', 'DP'].includes(salesOrder.payment_status)
    const isMarketplace = Boolean(salesOrder.marketplace_receipt?.trim()) ||
      ['shopee', 'tokopedia', 'tiktok', 'lazada'].some(name => customerName.includes(name))
    const calculatedStatus = item.order_type?.toUpperCase() === 'SABLON'
      ? getRecalculatedProductionStatus(item, productionLogs.map(log => ({ ...log, job_id: item.id })), {
        canProceed: isPaid || isMarketplace,
        currentStatus: item.status,
        forceRecalculate: true
      })
      : item.status || 'BARU MASUK'
    const rawActivityQty = productionLogs.reduce((total, log) => total + Number(log.qty_processed || 0), 0)

    return ({
    id: item.id,
    so_id: item.sales_orders?.id,
    order_type: item.order_type,
    qty_target: qtyPerColorTarget * (isTwoColor ? 2 : 1),
    qty_per_color_target: qtyPerColorTarget,
    qty_color_1: progress.qtyColorOne,
    qty_color_2: progress.qtyColorTwo,
    next_color_pass: progress.nextColorPass,
    qty_physical_completed: progress.qtyPhysicalCompleted,
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
    is_two_color: isTwoColor,
    notes: item.notes,
    status: calculatedStatus,
    item_status: calculatedStatus,
    mockup_url: item.mockup_url,
    qty_automatic_color_progress: getAutomaticProductionProgressQty(productionLogs),
    qty_processed: progress.qtyActivity,
    qty_raw_activity: rawActivityQty
  })
  }).filter(job => (
    mode !== 'production' || search || ['SIAP PROSES', 'PROSES', 'PROSES WARNA 1', 'PROSES WARNA 2'].includes(String(job.item_status).toUpperCase())
  ))

  return (
    <ProductionTable 
      productionJobs={productionJobs} 
      productionHistory={productionHistory}
      operators={visibleOperators}
      currentEmployeeId={matchedOperator?.id || ''}
      userRole={userRole} 
      initialSearch={search}
      initialTab={mode === 'status' ? 'SO' : 'PRODUKSI'}
      hideTabs={mode === 'production' || embedded}
      showAccumulationTab={canSeeProductionAccumulation}
      hideHeader={embedded}
      title={mode === 'production' ? 'Produksi' : 'Status Pesanan'}
    />
  )
}
