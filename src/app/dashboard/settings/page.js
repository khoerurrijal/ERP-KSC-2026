import { getSettings } from './actions'
import SettingsClient from './SettingsClient'
import SalarySchemaClient from './salary-schemas/SalarySchemaClient'
import { createClient } from '@/utils/supabase/server'

export const dynamic = 'force-dynamic'
export const metadata = {
  title: 'Pengaturan Sistem | King Sablon',
}

const SETTINGS_TABS = new Set(['dropdowns', 'cashflow', 'pricelist', 'store', 'category_images', 'ai_agent', 'access', 'salary'])

export default async function SettingsPage({ searchParams }) {
  const params = await Promise.resolve(searchParams || {})
  const requestedTab = Array.isArray(params.tab) ? params.tab[0] : params.tab
  const activeTab = SETTINGS_TABS.has(requestedTab) ? requestedTab : 'dropdowns'

  if (activeTab === 'salary') {
    const supabase = await createClient()
    const { data: schemas } = await supabase
      .from('salary_schemas')
      .select('*')
      .order('created_at', { ascending: true })

    return <SalarySchemaClient initialSchemas={schemas || []} />
  }

  const settings = await getSettings()
  return (
    <SettingsClient
      key={activeTab}
      initialSettings={settings}
      initialTab={activeTab}
      onlyAccess={activeTab === 'access'}
      hideHeader
      hideTabs
    />
  )
}
