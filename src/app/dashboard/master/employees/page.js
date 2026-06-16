import { createClient } from '@/utils/supabase/server'
import EmployeesClient from './EmployeesClient'

export const metadata = {
  title: 'Data Karyawan | King Sablon',
}

export default async function EmployeesPage() {
  const supabase = await createClient()

  // Fetch employees
  const { data: employees } = await supabase
    .from('employees')
    .select('*, salary_schemas(*)')
    .order('created_at', { ascending: false })

  // Fetch salary schemas for dropdown
  const { data: schemas } = await supabase
    .from('salary_schemas')
    .select('id, role_name')
    .order('created_at', { ascending: true })

  return <EmployeesClient initialEmployees={employees || []} schemas={schemas || []} />
}
