import { createClient } from '@/utils/supabase/server'
import TrackClient from './TrackClient'

export const dynamic = 'force-dynamic'

export default async function PublicTrackingPage({ params }) {
  const { id } = await params
  const supabase = await createClient()

  // Determine if ID is UUID or invoice_number
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
  const column = isUuid ? 'id' : 'invoice_number';

  // Find sales order by ID
  const { data: order, error } = await supabase
    .from('sales_orders')
    .select(`
      *,
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
      .select('*')
      .in('job_id', itemIds)
      .order('created_at', { ascending: false })
    if (data) logs = data
  }

  // Find company settings to get the brand logo/name
  const { data: settings } = await supabase
    .from('settings')
    .select('*')
    .limit(1)
    .single()

  // Find store config settings (banks, email, address, slogan, etc.)
  const { data: storeConfigData } = await supabase
    .from('system_settings')
    .select('value')
    .eq('key', 'store_config')
    .single()
  const storeConfig = storeConfigData?.value || null

  // Fetch employees for mapping names
  const { data: employees } = await supabase
    .from('employees')
    .select('id, full_name')

  return (
    <TrackClient 
      order={order} 
      logs={logs || []} 
      settings={settings || {}} 
      storeConfig={storeConfig} 
      employees={employees || []} 
    />
  )
}
