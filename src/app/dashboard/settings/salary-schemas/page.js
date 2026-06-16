import { createClient } from '@/utils/supabase/server'
import SalarySchemaClient from './SalarySchemaClient'

export const metadata = {
  title: 'Skema Gaji | King Sablon',
}

export default async function SalarySchemasPage() {
  const supabase = await createClient()

  const { data: schemas } = await supabase
    .from('salary_schemas')
    .select('*')
    .order('created_at', { ascending: true })

  return <SalarySchemaClient initialSchemas={schemas || []} />
}
