import { createClient } from '@/utils/supabase/server'
import CustomersClient from './CustomersClient'

export default async function CustomersPage() {
  const supabase = await createClient()
  
  const { data: customers, error } = await supabase
    .from('customers')
    .select('*')
    .order('created_at', { ascending: false })

  return <CustomersClient initialCustomers={customers || []} error={error} />
}
