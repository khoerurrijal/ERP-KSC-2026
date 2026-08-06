import { createClient } from '@/utils/supabase/server'
import ShippingConfirmationClient from './ShippingConfirmationClient'

export const dynamic = 'force-dynamic'

const DELIVERY_ORDER_TYPES = new Set(['SABLON', 'POLOS', 'PRINTING'])
const DELIVERY_READY_STATUSES = new Set(['SIAP KIRIM', 'SUDAH JADI', 'DIKIRIM', 'SUDAH DIAMBIL', 'SELESAI'])
const LEGACY_SERVICE_CODES = new Set(['SRV-FAST-TRACK', 'FAST-TRACK', 'SRV-2-WARNA', 'BIAYA-WARNA'])

const normalizeRelation = (value) => Array.isArray(value) ? value[0] : value

export default async function ShippingConfirmationPage({ embedded = false } = {}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: rolesData } = await supabase
    .from('system_settings')
    .select('value')
    .eq('key', 'user_roles')
    .single()

  const userEmail = user?.email?.toLowerCase() || ''
  const matchedUser = (rolesData?.value || []).find(role => {
    const inputEmail = (role.email || '').trim().toLowerCase()
    return inputEmail === userEmail || `${inputEmail}@kingsablon.com` === userEmail
  })
  const userRole = matchedUser?.role || 'Operator'

  if (!['Admin', 'Owner'].includes(userRole)) {
    return <ShippingConfirmationClient orders={[]} error="Hanya Admin/Owner yang dapat mengonfirmasi pengiriman." embedded={embedded} />
  }

  const { data: rawItems, error } = await supabase
    .from('sales_items')
    .select(`
      id,
      so_id,
      product_code,
      order_type,
      status,
      qty,
      unit,
      notes,
      sales_orders (id, invoice_number, date, payment_status, customers (name)),
      products (name, category)
    `)
    .order('so_id', { ascending: false })
    .limit(5000)

  if (error) {
    return <ShippingConfirmationClient orders={[]} error={error.message} embedded={embedded} />
  }

  const grouped = new Map()
  for (const item of rawItems || []) {
    const code = String(item.product_code || '').toUpperCase()
    const orderType = String(item.order_type || '').toUpperCase()
    const status = String(item.status || 'BARU MASUK').toUpperCase()
    if (LEGACY_SERVICE_CODES.has(code) || !DELIVERY_ORDER_TYPES.has(orderType) || status === 'BATAL') continue

    const order = normalizeRelation(item.sales_orders)
    if (!order?.id) continue

    if (!grouped.has(order.id)) {
      const customer = normalizeRelation(order.customers)
      grouped.set(order.id, {
        soId: order.id,
        invoiceNumber: order.invoice_number,
        orderDate: order.date,
        paymentStatus: order.payment_status || 'BELUM LUNAS',
        customerName: customer?.name || 'Pelanggan',
        items: []
      })
    }

    const product = normalizeRelation(item.products)
    grouped.get(order.id).items.push({
      id: item.id,
      productCode: item.product_code,
      productName: product?.name || item.product_code || 'Item',
      orderType,
      status,
      qty: item.qty,
      unit: item.unit || 'PCS',
      notes: item.notes || ''
    })
  }

  const orders = Array.from(grouped.values())
    .map(order => ({
      ...order,
      allReady: order.items.every(item => DELIVERY_READY_STATUSES.has(item.status)),
      pendingItems: order.items.filter(item => ['SIAP KIRIM', 'SUDAH JADI'].includes(item.status))
    }))
    .filter(order => order.allReady && order.pendingItems.length > 0)

  return <ShippingConfirmationClient orders={orders} embedded={embedded} />
}
