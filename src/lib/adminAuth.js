import { createAdminClient } from '@/utils/supabase/admin'
import { createClient as createServerClient } from '@/utils/supabase/server'

export async function getCurrentUserRole(supabase) {
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) throw new Error('Sesi login tidak ditemukan.')

  const { data: rolesData, error: rolesError } = await supabase
    .from('system_settings')
    .select('value')
    .eq('key', 'user_roles')
    .single()

  if (rolesError) throw rolesError

  const userEmail = user.email?.toLowerCase() || ''
  const matchedUser = (rolesData?.value || []).find(role => {
    const inputEmail = (role.email || '').trim().toLowerCase()
    return inputEmail === userEmail || `${inputEmail}@kingsablon.com` === userEmail
  })
  const userRole = matchedUser?.role || 'Operator'

  return { user, role: String(userRole).trim().toUpperCase() }
}

export async function requireRole(supabase, allowedRoles, message = 'Anda tidak memiliki izin untuk melakukan tindakan ini.') {
  const { user, role } = await getCurrentUserRole(supabase)
  const normalizedRoles = allowedRoles.map(value => String(value).trim().toUpperCase())

  if (!normalizedRoles.includes(role)) {
    throw new Error(message)
  }

  return { user, role }
}

export async function requireAdminOrOwner(supabase) {
  return requireRole(supabase, ['ADMIN', 'OWNER'], 'Hanya Admin/Owner yang dapat melakukan tindakan ini.')
}

export async function createAuthorizedAdminClient(allowedRoles, message) {
  const userSupabase = await createServerClient()
  const access = await requireRole(userSupabase, allowedRoles, message)

  return {
    supabase: createAdminClient(),
    ...access,
  }
}
