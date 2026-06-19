import { createClient } from '@/utils/supabase/server'
import LoansClient from './LoansClient'

export const metadata = {
  title: 'Kasbon & Pinjaman | King Sablon',
}

export default async function LoansPage() {
  const supabase = await createClient()

  const { data: employees } = await supabase
    .from('employees')
    .select('id, full_name, is_active')
    .eq('is_active', true)
    .order('full_name', { ascending: true })

  const { data: loans, error } = await supabase
    .from('employee_loans')
    .select('*, employees(full_name)')
    .order('created_at', { ascending: false })

  const { data: settings } = await supabase.from('system_settings').select('*').eq('key', 'dropdown_config').single()
  const dropdownConfig = settings?.value || {}

  return <LoansClient employees={employees || []} initialLoans={loans || []} error={error} dropdownConfig={dropdownConfig} />
}
