import { createAdminClient } from '@/utils/supabase/admin'
import {
  getProductionItemProgress,
  getRecalculatedProductionStatus,
  isTwoColorProductionJob,
  reconcileProductionColorPasses
} from '@/utils/productionColorPasses.mjs'
import TrackClient from './TrackClient'

export const dynamic = 'force-dynamic'

export default async function PublicTrackingPage({ params }) {
  const { id } = await params
  const supabase = createAdminClient()

  // Determine if ID is UUID or invoice_number
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
  const column = isUuid ? 'id' : 'invoice_number';

  // Find sales order by ID
  const { data: order, error } = await supabase
    .from('sales_orders')
    .select(`
      id,
      invoice_number,
      date,
      total_amount,
      dp_amount,
      payment_status,
      marketplace_receipt,
      customers (name, phone, address),
      sales_items (
        id,
        product_code,
        qty,
        unit_price,
        total_price,
        status,
        unit_multiplier,
        order_type,
        notes,
        products (name)
      )
    `)
    .eq(column, id)
    .single()

  if (error || !order) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black text-white p-8">
        <div className="max-w-md text-center">
          <h1 className="text-2xl font-bold mb-4 text-red-500">Pesanan Belum Ditemukan</h1>
          <p className="text-gray-400 mb-6">Link tracking tidak valid atau pesanan belum tersedia. Periksa kembali link dari invoice Anda.</p>
          <a href="/order" className="inline-flex items-center justify-center rounded-xl bg-yellow-500 px-5 py-3 font-semibold text-black hover:bg-yellow-400 transition-colors">
            Kembali ke halaman order
          </a>
        </div>
      </div>
    )
  }

  // Find production logs for this order's items
  const itemIds = order.sales_items?.map(i => i.id) || []
  let logs = []
  if (itemIds.length > 0) {
    const { data } = await supabase
      .from('production_logs')
      .select('id, job_id, employee_id, qty_processed, notes, processed_date, created_at')
      .in('job_id', itemIds)
      .order('created_at', { ascending: false })
    if (data) logs = data
  }

  const reconciliation = reconcileProductionColorPasses(order.sales_items || [], logs)
  const trackedItems = (order.sales_items || []).map(item => {
    const itemLogs = logs.filter(log => log.job_id === item.id)
    const progress = getProductionItemProgress(item, itemLogs)
    const customerName = order.customers?.name?.toLowerCase() || ''
    const canProceed = ['LUNAS', 'DP'].includes(order.payment_status) ||
      Boolean(order.marketplace_receipt?.trim()) ||
      ['shopee', 'tokopedia', 'tiktok', 'lazada'].some(name => customerName.includes(name))
    const { notes, ...publicItem } = item
    return {
      ...publicItem,
      is_two_color: isTwoColorProductionJob(item),
      production_progress: progress,
      display_status: item.order_type?.toUpperCase() === 'SABLON'
        ? getRecalculatedProductionStatus(item, itemLogs, {
          canProceed,
          currentStatus: item.status,
          forceRecalculate: true
        })
        : item.status
    }
  })
  const trackingLogs = logs.map(log => ({
    id: log.id,
    job_id: log.job_id,
    employee_id: log.employee_id,
    qty_processed: log.qty_processed,
    effective_qty: reconciliation.effectiveQtyByLogId.get(String(log.id)) ?? Number(log.qty_processed || 0),
    color_pass: reconciliation.colorPassByLogId.get(String(log.id)) || null,
    created_at: log.created_at
  }))

  // Find store config settings (banks, email, address, slogan, etc.)
  const { data: storeConfigData } = await supabase
    .from('system_settings')
    .select('value')
    .eq('key', 'store_config')
    .single()
  const storeConfig = storeConfigData?.value || null

  return (
    <TrackClient 
      order={{ ...order, sales_items: trackedItems }}
      logs={trackingLogs}
      settings={storeConfig || {}}
      storeConfig={storeConfig}
    />
  )
}
