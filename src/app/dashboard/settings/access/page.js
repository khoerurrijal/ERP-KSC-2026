import { getSettings } from '../actions'
import SettingsClient from '../SettingsClient'
import SalarySchemaClient from '../salary-schemas/SalarySchemaClient'
import { createClient } from '@/utils/supabase/server'
import PengaturanClient from './PengaturanClient'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Pengaturan | King Sablon',
}

export default async function PengaturanPage({ searchParams }) {
  const params = await Promise.resolve(searchParams || {})
  const activeTab = params.tab === 'salary' ? 'salary' : 'access'
  const settings = await getSettings()

  if (activeTab === 'salary') {
    const supabase = await createClient()
    const { data: schemas } = await supabase
      .from('salary_schemas')
      .select('*')
      .order('created_at', { ascending: true })

    return (
      <PengaturanClient activeTab={activeTab}>
        <SalarySchemaClient initialSchemas={schemas || []} />
      </PengaturanClient>
    )
  }

  return (
    <PengaturanClient activeTab={activeTab}>
      <SettingsClient initialSettings={settings} onlyAccess hideHeader />
    </PengaturanClient>
  )
}
