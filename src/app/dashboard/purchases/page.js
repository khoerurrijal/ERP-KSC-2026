import { createClient } from '@/utils/supabase/server'
import PurchasesClient from './PurchasesClient'

export default async function PurchasesPage({ searchParams }) {
  const supabase = await createClient()
  const resolvedParams = await searchParams
  const searchTerm = String(resolvedParams?.purchaseSearch || '').trim()
  const search = searchTerm.replace(/[(),"]/g, ' ').trim()
  
  const selectedMonth = resolvedParams?.month || (() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })()

  const [purchaseOrdersResult, rawItemsResult, suppliersResult, productsResult, workshopsResult, settingsResult] = await Promise.all([
    supabase
      .from('purchase_orders')
      .select(`
        *,
        purchase_items(id, product_code, qty, unit, unit_multiplier, unit_price, total_price)
      `)
      .limit(1000)
      .order('date', { ascending: false }),
    supabase
      .from('purchase_items')
      .select(`
        *,
        purchase_orders!inner(po_number, date, status, supplier),
        products(name)
      `)
      .order('id', { ascending: false })
      .limit(500),
    supabase.from('suppliers').select('*'),
    supabase.from('products').select('*, product_units(id, unit_name, multiplier)'),
    supabase.from('workshops').select('*'),
    supabase.from('system_settings').select('*').eq('key', 'dropdown_config').single()
  ])

  const summaryPOs = purchaseOrdersResult.data || []
  let allPOs = summaryPOs
  let purchaseItems = rawItemsResult.data || []

  if (search) {
    const [matchedProductsResult, matchedOrdersResult] = await Promise.all([
      supabase.from('products').select('product_code').ilike('name', `%${searchTerm}%`).limit(50000),
      supabase.from('purchase_orders').select('id').or(`po_number.ilike.%${search}%,supplier.ilike.%${search}%`).limit(50000)
    ])
    const matchedProductCodes = (matchedProductsResult.data || []).map(product => product.product_code).filter(Boolean)
    const itemSearchFilters = [
      `item_name.ilike.%${search}%`,
      `product_code.ilike.%${search}%`,
      ...(matchedProductCodes.length ? [`product_code.in.(${matchedProductCodes.join(',')})`] : [])
    ]
    const { data: directlyMatchedItems } = await supabase
      .from('purchase_items')
      .select('id, po_id')
      .or(itemSearchFilters.join(','))
      .limit(50000)

    const matchedOrderIds = [...new Set([
      ...(matchedOrdersResult.data || []).map(order => order.id),
      ...(directlyMatchedItems || []).map(item => item.po_id).filter(Boolean)
    ])]
    const directItemIds = [...new Set((directlyMatchedItems || []).map(item => item.id).filter(Boolean))]

    if (matchedOrderIds.length) {
      const { data: matchingPurchaseOrders } = await supabase
        .from('purchase_orders')
        .select(`*, purchase_items(id, product_code, qty, unit, unit_multiplier, unit_price, total_price)`)
        .in('id', matchedOrderIds)
        .order('date', { ascending: false })
        .limit(50000)
      allPOs = matchingPurchaseOrders || []

      const { data: purchaseItemsForMatchedOrders } = await supabase
        .from('purchase_items')
        .select(`*, purchase_orders!inner(po_number, date, status, supplier), products(name)`)
        .in('po_id', matchedOrderIds)
        .order('id', { ascending: false })
        .limit(50000)
      purchaseItems = purchaseItemsForMatchedOrders || []
    } else {
      allPOs = []
      purchaseItems = []
    }

    if (directItemIds.length) {
      const { data: directlyMatchedItemRows } = await supabase
        .from('purchase_items')
        .select(`*, purchase_orders!inner(po_number, date, status, supplier), products(name)`)
        .in('id', directItemIds)
        .order('id', { ascending: false })
        .limit(50000)
      const combinedItems = [...purchaseItems, ...(directlyMatchedItemRows || [])]
      purchaseItems = [...new Map(combinedItems.map(item => [item.id, item])).values()]
    }
  }
  const suppliers = suppliersResult.data || []
  const products = productsResult.data || []
  const workshops = workshopsResult.data || []

  // Hitung Laporan Ringkasan
  const summary = {
    beliGudang: 0,
    beliGlobal: 0,
    lunas: 0,
    tempo: 0
  }

  // Tempo (Seluruh Waktu)
  summary.tempo = summaryPOs
    .filter(o => o.status !== 'LUNAS' && o.payment_status !== 'LUNAS')
    .reduce((sum, o) => sum + Number(o.total_amount || 0), 0)

  // Filter khusus bulan ini untuk Lunas & Pembelian
  const thisMonthPOs = summaryPOs.filter(o => o.date && o.date.startsWith(selectedMonth))
  
  thisMonthPOs.forEach(o => {
    const amount = Number(o.total_amount || 0)
    
    // Total Pembelian Bulan Ini berdasarkan Workshop
    if (o.workshop_code === 'GUDANG') {
      summary.beliGudang += amount
    } else if (o.workshop_code === 'GLOBAL' || !o.workshop_code) { // Default global jika kosong
      summary.beliGlobal += amount
    }

    // Lunas Bulan Ini
    if (o.status === 'LUNAS' || o.payment_status === 'LUNAS') {
      summary.lunas += amount
    }
  })

  const dropdownConfig = settingsResult.data?.value || {}

  return <PurchasesClient purchaseOrders={allPOs} purchaseItems={purchaseItems} summary={summary} selectedMonth={selectedMonth} initialSearch={search} dropdownConfig={dropdownConfig} suppliers={suppliers} products={products} workshops={workshops} />
}
