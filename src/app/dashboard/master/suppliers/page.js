import { createClient } from '@/utils/supabase/server'
import SuppliersClient from './SuppliersClient'

export const metadata = {
  title: 'Data Supplier | King Sablon',
}

export default async function SuppliersPage() {
  const supabase = await createClient()

  const { data: suppliers, error } = await supabase
    .from('suppliers')
    .select('*')
    .order('created_at', { ascending: false })

  return <SuppliersClient initialSuppliers={suppliers || []} error={error} />
}
