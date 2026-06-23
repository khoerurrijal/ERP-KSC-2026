import { createClient } from '@/utils/supabase/server'
import ProductionTable from '@/components/ProductionTable'

export const dynamic = 'force-dynamic'

export default async function ProductionPage() {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  const userEmail = user?.email?.toLowerCase() || ''

  // Determine user role and name
  const { data: settingsData } = await supabase.from('system_settings').select('value').eq('key', 'user_roles').single()
  const userRoles = settingsData?.value || []
  
  let userRole = 'Operator'
  let currentUserName = ''
  
  const matchedUser = userRoles.find(u => {
    const inputEmail = (u.email || '').trim().toLowerCase()
    return inputEmail === userEmail || `${inputEmail}@kingsablon.com` === userEmail
  })
  
  if (matchedUser) {
    userRole = matchedUser.role
    // Assuming we don't have full name in user_roles, we will try to match with operators list later
  }

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
      notes,
      sales_orders (id, invoice_number, status, date, notes, customers (name)),
      products (name, workshop_code),
      production_logs (qty_processed)
    `)
    .or('status.in.("BARU MASUK","SIAP PROSES","PROSES","SUDAH JADI","SIAP KIRIM","DIKIRIM","SUDAH DIAMBIL","SELESAI","TERKIRIM","Proses"),status.is.null')
    .order('id', { ascending: false })
    .limit(10000)

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
    order_date: item.sales_orders?.date,
    target_date: (() => {
      if (!item.sales_orders?.date) return null
      const orderDate = new Date(item.sales_orders.date)
      const soNotes = (item.sales_orders.notes || '').toLowerCase()
      const itemNotes = (item.notes || '').toLowerCase()
      const isFastTrack = soNotes.includes('fast track') || itemNotes.includes('fast_track') || itemNotes.includes('fast track')
      const targetDate = new Date(orderDate)
      targetDate.setDate(targetDate.getDate() + (isFastTrack ? 1 : 4)) // +1 fast track, +4 reguler (3-5 hari, di-average 4)
      return targetDate.toISOString()
    })(),
    is_fast_track: (item.sales_orders?.notes || '').toLowerCase().includes('fast track') || (item.notes || '').toLowerCase().includes('fast_track') || (item.notes || '').toLowerCase().includes('fast track'),
    notes: item.notes,
    status: item.sales_orders?.status, // This is SO status
    item_status: item.status || 'Proses', // This is Item status
    mockup_url: item.mockup_url, // Added mockup_url
    qty_processed: (item.production_logs || []).reduce((acc, log) => acc + (log.qty_processed || 0), 0)
  }))
  
  // Try to match currentUserName if they are an operator
  const matchedOperator = operators.find(o => o.full_name?.toLowerCase().includes(userEmail.split('@')[0].toLowerCase()))
  if (matchedOperator) {
    currentUserName = matchedOperator.full_name
  } else if (matchedUser && matchedUser.email) {
    currentUserName = matchedUser.email
  }

  return <ProductionTable productionJobs={productionJobs} operators={operators} currentUser={userEmail} userRole={userRole} currentUserName={currentUserName} />
}
