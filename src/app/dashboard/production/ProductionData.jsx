import { createClient } from '@/utils/supabase/server'
import ProductionTable from '@/components/ProductionTable'

export default async function ProductionData() {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  const userEmail = user?.email?.toLowerCase() || ''

  const [
    { data: settingsData },
    { data: operatorsData },
    { data: rawItems }
  ] = await Promise.all([
    supabase.from('system_settings').select('value').eq('key', 'user_roles').single(),
    supabase.from('employees').select('id, full_name, salary_schemas(role_name)').eq('is_active', true),
    supabase
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
  ])

  const userRoles = settingsData?.value || []
  let userRole = 'Operator'
  let currentUserName = ''
  
  const matchedUser = userRoles.find(u => {
    const inputEmail = (u.email || '').trim().toLowerCase()
    return inputEmail === userEmail || `${inputEmail}@kingsablon.com` === userEmail
  })
  
  if (matchedUser) {
    userRole = matchedUser.role
  }

  const operators = (operatorsData || []).filter(o => 
    o.salary_schemas?.role_name?.toLowerCase().includes('operator')
  ).map(o => ({
    id: o.id,
    full_name: o.full_name,
    role_name: o.salary_schemas?.role_name
  }))

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
      targetDate.setDate(targetDate.getDate() + (isFastTrack ? 1 : 4))
      return targetDate.toISOString()
    })(),
    is_fast_track: (item.sales_orders?.notes || '').toLowerCase().includes('fast track') || (item.notes || '').toLowerCase().includes('fast_track') || (item.notes || '').toLowerCase().includes('fast track'),
    notes: item.notes,
    status: item.status || 'BARU MASUK',
    item_status: item.status || 'BARU MASUK',
    mockup_url: item.mockup_url,
    qty_processed: (item.production_logs || []).reduce((acc, log) => acc + (log.qty_processed || 0), 0)
  }))

  const matchedOperator = operators.find(o => o.full_name?.toLowerCase().includes(userEmail.split('@')[0].toLowerCase()))
  if (matchedOperator) {
    currentUserName = matchedOperator.full_name
  } else if (matchedUser && matchedUser.email) {
    currentUserName = matchedUser.email
  }

  return (
    <ProductionTable 
      productionJobs={productionJobs} 
      operators={operators} 
      currentUser={userEmail} 
      userRole={userRole} 
      currentUserName={currentUserName} 
    />
  )
}
