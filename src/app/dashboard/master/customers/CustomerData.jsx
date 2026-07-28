import { createClient } from '@/utils/supabase/server'
import CustomersClient from './CustomersClient'

export default async function CustomerData({ searchParams = {} }) {
  const supabase = await createClient()

  const page = parseInt(searchParams.page || '1', 10)
  const pageSize = parseInt(searchParams.pageSize || '50', 10)
  const search = searchParams.search || ''

  let query = supabase
    .from('customers')
    .select('*', { count: 'exact' })

  if (search) {
    query = query.or(`name.ilike.%${search}%,phone.ilike.%${search}%,customer_code.ilike.%${search}%`)
  }

  query = query.order('created_at', { ascending: false })

  const start = (page - 1) * pageSize
  const end = start + pageSize - 1
  query = query.range(start, end)

  const [settingsRes, customersRes] = await Promise.all([
    supabase.from('system_settings').select('*').eq('key', 'dropdown_config').single(),
    query
  ])

  const dropdownConfig = settingsRes.data?.value || {}
  const customers = customersRes.data || []
  const totalCount = customersRes.count || 0

  return (
    <CustomersClient
      initialCustomers={customers}
      totalCount={totalCount}
      page={page}
      pageSize={pageSize}
      error={customersRes.error?.message}
      dropdownConfig={dropdownConfig}
      searchParams={searchParams}
    />
  )
}
