import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'

export default async function Home() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    redirect('/login')
  }

  const { data: settingsData } = await supabase
    .from('system_settings')
    .select('value')
    .eq('key', 'user_roles')
    .single()
  const userRoles = Array.isArray(settingsData?.value) ? settingsData.value : []
  const userEmail = user.email?.toLowerCase() || ''
  const matchedUser = userRoles.find((entry) => {
    const configuredEmail = (entry.email || '').trim().toLowerCase()
    return configuredEmail === userEmail || `${configuredEmail}@kingsablon.com` === userEmail
  })
  const userRole = matchedUser?.role || 'Operator'

  redirect(['Operator', 'Operator Mesin'].includes(userRole) ? '/production' : '/dashboard')
}
