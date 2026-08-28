import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { requireAdminOrOwner } from '@/lib/adminAuth'
import SalesOrderWizard from '@/components/SalesOrderWizard'

export const dynamic = 'force-dynamic'

export default async function CustomerOrderRequestReviewPage({ params }) {
  const resolvedParams = await params
  const supabase = await createClient()
  await requireAdminOrOwner(supabase)

  const [{ data: request, error: requestError }, { data: customers }, { data: products }, { data: workshops }, { data: settings }] = await Promise.all([
    supabase.from('customer_order_requests').select('*').eq('id', resolvedParams.id).single(),
    supabase.from('customers').select('*').order('name'),
    supabase.from('products').select('*, product_units(id, unit_name, multiplier)').order('name'),
    supabase.from('workshops').select('*').order('name'),
    supabase.from('system_settings').select('*')
  ])

  if (requestError || !request || request.sales_order_id) redirect('/dashboard/order-requests')

  const payload = request.payload || {}
  const requestItems = Array.isArray(payload.items) ? payload.items : []
  const initialItems = requestItems.map((item, index) => {
    const product = (products || []).find(candidate => candidate.product_code === item.productId)
    return {
      id: `request-${request.id}-${index}`,
      order_type: item.orderType || '',
      category: product?.category || '',
      product_id: item.productId || '',
      product_search: product?.name || item.productName || '',
      workshop_id: (workshops || []).find(workshop => workshop.code === product?.workshop_code)?.id || '',
      qty: item.qty || 1,
      unit: item.unit || 'PCS',
      unit_multiplier: item.unitMultiplier || 1,
      price: item.unitPrice || 0,
      isFastTrack: Boolean(item.isFastTrack),
      isTwoColor: Boolean(item.isTwoColor),
      printingColors: item.printingColors || '3 Warna',
      notes: item.notes || ''
    }
  })

  const initialData = {
    date: request.created_at?.slice(0, 10),
    customer_code: request.customer_code,
    notes: payload.notes || `Request ${request.request_number}`,
    dp_amount: 0,
    payment_method: 'TRANSFER',
    marketplace_receipt: '',
    designService: Boolean(payload.designService),
    items: initialItems
  }

  const dropdownConfig = settings?.find(setting => setting.key === 'dropdown_config')?.value || {}
  const pricelistConfig = settings?.find(setting => setting.key === 'pricelist_config')?.value || {}

  return (
    <div>
      <div className="max-w-4xl mx-auto mb-4 p-3 rounded-xl border border-amber-500/25 bg-amber-500/10 text-sm text-amber-200">
        Review {request.request_number}. Data belum masuk Sales Order sampai Admin menekan tombol konfirmasi.
      </div>
      <SalesOrderWizard
        customers={customers || []}
        products={products || []}
        workshops={workshops || []}
        initialData={initialData}
        requestId={request.id}
        dropdownConfig={dropdownConfig}
        pricelistConfig={pricelistConfig}
      />
    </div>
  )
}
