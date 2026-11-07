import { createClient } from '@/utils/supabase/server'
import SuppliersClient from './SuppliersClient'

export const metadata = {
  title: 'Data Supplier | King Sablon',
}

export default async function SuppliersPage({ searchParams }) {
  const supabase = await createClient()
  const resolvedParams = await Promise.resolve(searchParams || {})
  const search = String(resolvedParams.search || '').replace(/[(),"]/g, ' ').trim()

  let suppliersQuery = supabase
    .from('suppliers')
    .select('*')
    .order('created_at', { ascending: false })

  if (search) {
    suppliersQuery = suppliersQuery.or(`supplier_name.ilike.%${search}%,phone.ilike.%${search}%,address.ilike.%${search}%`)
  }

  const { data: suppliers, error } = await suppliersQuery

  return <SuppliersClient initialSuppliers={suppliers || []} error={error} initialSearch={search} />
}
