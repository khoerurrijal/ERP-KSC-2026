import { createClient } from '@/utils/supabase/server'
import PublicInvoiceClient from './PublicInvoiceClient'
import { notFound } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function PublicInvoicePage({ params }) {
  const supabase = await createClient()
  const { invoice_number } = await params
  
  const { data: order, error } = await supabase
    .from('sales_orders')
    .select(`
      *,
      customers (*),
      sales_items (
        *,
        products (name, category)
      )
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
