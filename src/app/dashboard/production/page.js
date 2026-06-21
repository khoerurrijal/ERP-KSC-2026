import { createClient } from '@/utils/supabase/server'
import ProductionTable from '@/components/ProductionTable'

export const dynamic = 'force-dynamic'

export default async function ProductionPage() {
  const supabase = await createClient()
  const user = { email: 'admin@kingsablon.com' }

  // Fetch employees who are operators
  const { data: operatorsData } = await supabase
    .from('employees')
    .select('id, full_name, salary_schemas(role_name)')
    .eq('is_active', true)
  
  const operators = (operatorsData || []).filter(o => 
    o.salary_schemas?.role_name?.toLowerCase().includes('operator')
  ).map(o => ({
    id: o.id,
    full_name: o.full_name,
    role_name: o.salary_schemas?.role_name
  }))

  // Fetch sales_items where order_type = SABLON
  const { data: rawItems } = await supabase
    .from('sales_items')
    .select(`
      id,
      qty,
      unit_multiplier,
      status,
      mockup_url,
      order_type,
      sales_orders (id, invoice_number, status, date, customers (name)),
      products (name, workshop_code),
      production_logs (qty_processed)
    `)
    .in('order_type', ['SABLON', 'PRINTING'])
    .or('status.in.(BARU MASUK,SIAP PROSES,PROSES,SUDAH JADI,SIAP KIRIM,DIKIRIM,SUDAH DIAMBIL,SELESAI,TERKIRIM,Proses),status.is.null')
    .order('id', { ascending: false })
    .limit(500)

  // Transform to match UI structure
  const productionJobs = (rawItems || []).map(item => ({
    id: item.id,
    so_id: item.sales_orders?.id,
    order_type: item.order_type,
    qty_target: item.qty * (item.unit_multiplier || 1),
    sales_order_items: {
      qty: item.qty,
      sales_orders: { 
        invoice_number: item.sales_orders?.invoice_number,
        customers: { name: item.sales_orders?.customers?.name }
      },
      products: { 
        name: item.products?.name,
        product_name: item.products?.name
      }
    },
    target_date: item.sales_orders?.date,
    status: item.sales_orders?.status, // This is SO status
    item_status: item.status || 'Proses', // This is Item status
    qty_processed: (item.production_logs || []).reduce((acc, log) => acc + (log.qty_processed || 0), 0)
  }))

  return (
    <ProductionTable productionJobs={productionJobs} operators={operators} currentUser={user.email} />
  )
}
