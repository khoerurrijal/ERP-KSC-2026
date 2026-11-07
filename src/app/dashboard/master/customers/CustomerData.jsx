import { createClient } from '@/utils/supabase/server'
import CustomersClient from './CustomersClient'
import { numericTokenPattern } from '@/utils/search'

export default async function CustomerData({ searchParams = {} }) {
  const supabase = await createClient()

  const page = parseInt(searchParams.page || '1', 10)
  const pageSize = parseInt(searchParams.pageSize || '50', 10)
  const search = String(searchParams.search || '').replace(/[(),"]/g, ' ').trim()

  let query = supabase
    .from('customers')
    .select('*', { count: 'exact' })

  if (search) {
    const numericPattern = numericTokenPattern(search)
    const phoneFilter = numericPattern && search.length < 4
      ? `phone.imatch."${numericPattern}"`
      : `phone.ilike.%${search}%`
    const customerCodeFilter = numericPattern
      ? `customer_code.imatch."${numericPattern}"`
      : `customer_code.ilike.%${search}%`
    query = query.or(numericPattern
      ? `name.imatch."${numericPattern}",${phoneFilter},${customerCodeFilter}`
      : `name.ilike.%${search}%,${phoneFilter},${customerCodeFilter}`)
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
  const customers = (customersRes.data || []).map(customer => ({
    ...customer,
    city: customer.city || customer.address || ''
  }))
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
