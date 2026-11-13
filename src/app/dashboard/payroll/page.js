import { createClient } from '@/utils/supabase/server'
import PayrollClient from './PayrollClient'

export const metadata = {
  title: 'Absen & Gaji | King Sablon',
}

export default async function PayrollPage() {
  const supabase = await createClient()
  const { data: settings } = await supabase.from('system_settings').select('*').eq('key', 'dropdown_config').single()
  const dropdownConfig = settings?.value || {}

  return <PayrollClient dropdownConfig={dropdownConfig} />
}
