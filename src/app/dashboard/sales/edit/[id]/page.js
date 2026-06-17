import { createClient } from '@/utils/supabase/server'
import SalesOrderWizard from '@/components/SalesOrderWizard'
import { redirect } from 'next/navigation'

export default async function EditSalesOrderPage({ params }) {
  const supabase = await createClient()

  // 1. Fetch Sales Order
  const { data: so, error: soErr } = await supabase.from('sales_orders').select('*').eq('id', params.id).single()
  
  if (soErr || !so) {
    redirect('/dashboard/sales')
  }

  // Ensure only DP / BELUM LUNAS can be edited
  if (so.payment_status === 'LUNAS') {
    redirect('/dashboard/sales') // Or display an error page
  }

  // 2. Fetch Items
  const { data: items } = await supabase.from('sales_items').select('*').eq('so_id', params.id)
  so.items = items || []

  // 3. Fetch dependencies for Wizard
  const [{ data: customers }, { data: products }, { data: workshops }, { data: settings }] = await Promise.all([
    supabase.from('customers').select('*').order('name'),
    supabase.from('products').select('*').order('name'),
    supabase.from('workshops').select('*'),
    supabase.from('system_settings').select('*')
  ])

  const dropdownConfig = settings?.find(s => s.key === 'dropdown_config')?.value || {}
  const jasaSablonStr = settings?.find(s => s.key === 'jasa_sablon_price')?.value || "250"
  const jasaSablon = parseFloat(jasaSablonStr)

  return (
    <SalesOrderWizard 
      customers={customers || []} 
      products={products || []} 
      workshops={workshops || []} 
      initialData={so}
      dropdownConfig={dropdownConfig}
      jasaSablon={jasaSablon}
    />
  )
}
