import { createClient } from '@/utils/supabase/server'
import PurchaseOrderWizard from '@/components/PurchaseOrderWizard'

export const dynamic = 'force-dynamic'

export default async function NewPurchaseOrderPage() {
  const supabase = await createClient()

  // Fetch real data
  const { data: suppliers } = await supabase.from('suppliers').select('*')
  const { data: products } = await supabase.from('products').select('*')
  const { data: workshops } = await supabase.from('workshops').select('*')
  const { data: settings } = await supabase.from('system_settings').select('*')
  const dropdownConfig = settings?.find(s => s.key === 'dropdown_config')?.value || {}

  return (
    <div className="min-h-[80vh]">
      <PurchaseOrderWizard 
        suppliers={suppliers || []} 
        products={products || []} 
        workshops={workshops || []}
        dropdownConfig={dropdownConfig}
      />
    </div>
  )
}
