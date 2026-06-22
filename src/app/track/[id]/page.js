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
      customers (name, phone),
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
          <h1 className="text-2xl font-bold mb-4 text-red-500">Pesanan Tidak Ditemukan</h1>
          <p className="text-gray-400 mb-2">ID: {id}</p>
          <p className="text-gray-500 text-sm">{error?.message || 'Data kosong'}</p>
          <pre className="text-left bg-white/10 p-4 rounded-xl mt-4 text-xs overflow-auto">
            {JSON.stringify(error, null, 2)}
          </pre>
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

  // Fetch employees for mapping names
  const { data: employees } = await supabase
    .from('employees')
    .select('id, full_name')

  return <TrackClient order={order} logs={logs || []} settings={settings || {}} employees={employees || []} />
}
