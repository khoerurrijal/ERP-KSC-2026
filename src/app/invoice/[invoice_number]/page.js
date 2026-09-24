import { createAdminClient } from '@/utils/supabase/admin'
import PublicInvoiceClient from './PublicInvoiceClient'
import { notFound } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function PublicInvoicePage({ params }) {
  const supabase = createAdminClient()
  const { invoice_number } = await params
  
  const { data: order, error } = await supabase
    .from('sales_orders')
    .select(`
      id,
      invoice_number,
      date,
      total_amount,
      dp_amount,
      payment_status,
      customers (name, phone, address),
      sales_items (product_code, qty, unit_price, total_price, order_type, products (name, category))
    `)
    .eq('invoice_number', invoice_number)
    .single()

  if (error || !order) {
    console.error('Error fetching public invoice:', error)
    notFound()
  }

  const { data: settings } = await supabase
    .from('system_settings')
    .select('value')
    .eq('key', 'store_config')
    .single()

  const storeConfig = settings?.value || null

  return <PublicInvoiceClient order={order} storeConfig={storeConfig} />
}
