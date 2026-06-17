import SalesOrderWizard from '@/components/SalesOrderWizard'
import { createClient } from '@/utils/supabase/server'

export const dynamic = 'force-dynamic'

export default async function NewSalesOrderPage() {
  const supabase = await createClient()
  const { data: customers } = await supabase.from('customers').select('*').order('name')
  const { data: products } = await supabase.from('products').select('*, product_units(id, unit_name, multiplier)').order('name')
  const { data: workshops } = await supabase.from('workshops').select('*').order('name')
  const { data: settings } = await supabase.from('system_settings').select('*')
  const dropdownConfig = settings?.find(s => s.key === 'dropdown_config')?.value || {}
  const jasaSablonStr = settings?.find(s => s.key === 'jasa_sablon_price')?.value || "250"
  const jasaSablon = parseFloat(jasaSablonStr)

  return (
    <div className="min-h-[80vh]">
      <SalesOrderWizard 
        customers={customers || []} 
        products={products || []} 
        workshops={workshops || []}
        dropdownConfig={dropdownConfig}
        jasaSablon={jasaSablon}
      />
    </div>
  )
}
