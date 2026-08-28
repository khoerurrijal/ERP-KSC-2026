export async function requireAdminOrOwner(supabase) {
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

  if (!['ADMIN', 'OWNER'].includes(String(userRole).toUpperCase())) {
    throw new Error('Hanya Admin/Owner yang dapat melakukan tindakan ini.')
  }

  return { user, role: userRole }
}
