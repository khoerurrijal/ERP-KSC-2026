import { createClient } from '@/utils/supabase/server'
import PurchaseOrderWizard from '@/components/PurchaseOrderWizard'
import { notFound } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function EditPurchaseOrderPage({ params }) {
  const supabase = await createClient()
  const resolvedParams = await params
  const id = resolvedParams.id

  // Fetch real data
  const { data: suppliers } = await supabase.from('suppliers').select('*')
  const { data: products } = await supabase.from('products').select('*')
  const { data: workshops } = await supabase.from('workshops').select('*')
  const { data: settings } = await supabase.from('system_settings').select('*')
  const dropdownConfig = settings?.find(s => s.key === 'dropdown_config')?.value || {}

  // Fetch PO Data
  const { data: po } = await supabase
    .from('purchase_orders')
    .select('*, purchase_items(*)')
    .eq('id', id)
    .single()

  if (!po) {
    notFound()
  }

  // Transform items to match Wizard state
  const mappedItems = po.purchase_items.map((item, index) => {
    const product = products.find(p => p.product_code === item.product_code)
    const workshopId = workshops.find(w => w.code === po.workshop_code)?.id || ''
    return {
      id: item.id || Date.now() + index,
      workshop_id: workshopId,
      category: product?.category || '',
      product_id: item.product_code,
      product_search: product?.name || '',
      qty: item.qty,
      unit: item.unit || product?.unit || 'PCS',
      unit_multiplier: item.unit_multiplier || 1,
      unit_cost: item.unit_price
    }
  })

  const initialData = {
    id: po.id,
    po_number: po.po_number,
    date: po.date,
    supplier: po.supplier,
    notes: po.notes || '',
    status: po.status,
    payment_method: po.payment_method,
    items: mappedItems
  }

  return (
    <div className="min-h-[80vh]">
      <PurchaseOrderWizard 
        suppliers={suppliers || []} 
        products={products || []} 
        workshops={workshops || []}
        initialData={initialData}
        dropdownConfig={dropdownConfig}
      />
    </div>
  )
}
