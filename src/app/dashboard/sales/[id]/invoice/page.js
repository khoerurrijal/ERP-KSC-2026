import { createClient } from '@/utils/supabase/server'
import InvoiceClient from './InvoiceClient'
import { notFound } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function InvoicePage({ params }) {
  const supabase = await createClient()
  const { id } = await params
  
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
    .eq('id', id)
    .single()

  if (error || !order) {
    console.error('Error fetching invoice:', error)
    notFound()
  }

  const { data: settings } = await supabase
    .from('system_settings')
    .select('value')
    .eq('key', 'store_config')
    .single()

  const storeConfig = settings?.value || null

  return <InvoiceClient order={order} storeConfig={storeConfig} />
}
