import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import AuditClient from './AuditClient'
import { runAuditScan } from './audit'

export const dynamic = 'force-dynamic'

export default async function AuditPage() {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) redirect('/login')

  const { data: rolesData } = await supabase
    .from('system_settings')
    .select('value')
    .eq('key', 'user_roles')
    .single()

  const userEmail = user.email?.toLowerCase() || ''
  const matchedUser = (rolesData?.value || []).find(role => {
    const inputEmail = (role.email || '').trim().toLowerCase()
    return inputEmail === userEmail || `${inputEmail}@kingsablon.com` === userEmail
  })
  const userRole = matchedUser?.role || 'Operator'

  if (!['Admin', 'Owner'].includes(userRole)) {
    redirect('/production')
  }

  const report = await runAuditScan(supabase)
  return <AuditClient initialReport={report} />
}
