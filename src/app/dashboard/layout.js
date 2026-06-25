import PermissionGuard from '@/components/PermissionGuard'
import DashboardClientLayout from '@/components/DashboardClientLayout'
import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'

export default async function DashboardLayout({ children }) {
  const supabase = await createClient()

  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) {
    redirect('/login')
  }

  // Get settings
  const { data: settingsData } = await supabase.from('system_settings').select('key, value').in('key', ['role_permissions', 'user_roles'])
  
  const defaultPermissions = {
    "Owner": ["dashboard", "penjualan", "marketplace", "produksi", "gudang", "keuangan", "master_data", "laporan", "pengaturan", "user_management"],
    "Admin": ["dashboard", "penjualan", "marketplace", "produksi", "gudang", "master_data"],
    "Operator": ["dashboard", "produksi", "gudang"]
  }

  const rolePermissions = settingsData?.find(d => d.key === 'role_permissions')?.value || defaultPermissions
  const userRoles = settingsData?.find(d => d.key === 'user_roles')?.value || []

  // Find user role (default Operator)
  const userEmail = user.email?.toLowerCase() || ''
  const matchedUser = userRoles.find(u => {
    const inputEmail = (u.email || '').trim().toLowerCase()
    return inputEmail === userEmail || `${inputEmail}@kingsablon.com` === userEmail
  })
  const userRole = matchedUser ? matchedUser.role : 'Operator'

  const allowedMenus = rolePermissions[userRole] || []

  const isOperator = userRole === 'Operator'

  // Redirect Operator if they try to access the main /dashboard page
  const headersList = await headers()
  const currentPath = headersList.get('x-invoke-path') || ''
  if (isOperator && (currentPath === '/dashboard' || currentPath === '/dashboard/')) {
    redirect('/dashboard/production')
  }

  return (
    <DashboardClientLayout allowedMenus={allowedMenus} userRole={userRole}>
      <PermissionGuard allowedMenus={allowedMenus} userRole={userRole}>
        {children}
      </PermissionGuard>
    </DashboardClientLayout>
  )
}
