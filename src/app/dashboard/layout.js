import PermissionGuard from '@/components/PermissionGuard'
import DashboardClientLayout from '@/components/DashboardClientLayout'
import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { menuKeysFromPermissions, normalizeRolePermissions } from '@/utils/role-access'
import './employee-light.css'

export default async function DashboardLayout({ children }) {
  const supabase = await createClient()

  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) {
    redirect('/login')
  }

  // Get settings
  const { data: settingsData } = await supabase.from('system_settings').select('key, value').in('key', ['role_permissions', 'user_roles'])
  
  const defaultPermissions = {
    "Owner": ["dashboard", "penjualan", "marketplace", "produksi", "gudang", "keuangan", "master_data", "laporan", "audit", "pengaturan", "user_management"],
    "Admin": ["dashboard", "penjualan", "marketplace", "produksi", "gudang", "master_data", "audit"],
    "Operator": ["dashboard", "produksi", "gudang"],
    "Operator Mesin": ["production.queue"]
  }

  const rolePermissions = settingsData?.find(d => d.key === 'role_permissions')?.value || defaultPermissions
  const userRoles = settingsData?.find(d => d.key === 'user_roles')?.value || []

  // Find user role (default Operator)
  const userEmail = user.email?.toLowerCase() || ''
  const userName = user.email?.split('@')[0] || ''
  const matchedUser = userRoles.find(u => {
    const inputEmail = (u.email || '').trim().toLowerCase()
    return inputEmail === userEmail || `${inputEmail}@kingsablon.com` === userEmail
  })
  const userRole = matchedUser ? matchedUser.role : 'Operator'

  const configuredPermissions = rolePermissions[userRole] ?? defaultPermissions[userRole] ?? []
  const allowedPermissions = normalizeRolePermissions(configuredPermissions, userRole)
  if (['Admin', 'Owner'].includes(userRole) && !allowedPermissions.includes('audit.findings')) {
    allowedPermissions.push('audit.findings')
  }
  const allowedMenus = menuKeysFromPermissions(allowedPermissions)

  return (
    <DashboardClientLayout allowedMenus={allowedMenus} allowedPermissions={allowedPermissions} userRole={userRole} userName={userName}>
      <PermissionGuard allowedPermissions={allowedPermissions} userRole={userRole}>
        {children}
      </PermissionGuard>
    </DashboardClientLayout>
  )
}
