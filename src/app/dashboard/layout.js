import Sidebar from '@/components/Sidebar'
import PermissionGuard from '@/components/PermissionGuard'
import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'

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
    "Operator": ["dashboard", "produksi"]
  }

  const rolePermissions = settingsData?.find(d => d.key === 'role_permissions')?.value || defaultPermissions
  const userRoles = settingsData?.find(d => d.key === 'user_roles')?.value || []

  // Find user role (default Operator)
  const userEmail = user.email?.toLowerCase() || ''
  const matchedUser = userRoles.find(u => u.email === userEmail)
  const userRole = matchedUser ? matchedUser.role : 'Operator'

  const allowedMenus = rolePermissions[userRole] || []

  return (
    <div className="min-h-screen bg-background text-foreground flex">
      {/* Sidebar */}
      <Sidebar allowedMenus={allowedMenus} userRole={userRole} />

      {/* Main Content Area */}
      <main className="flex-1 ml-64 p-8 relative min-h-screen overflow-x-hidden">
        {/* Background decorations for main area */}
        <div className="fixed top-[-5%] left-[20%] w-[50%] h-[50%] bg-primary/5 rounded-full blur-[150px] pointer-events-none" />
        <div className="fixed bottom-[-5%] right-[-5%] w-[40%] h-[40%] bg-accent/5 rounded-full blur-[150px] pointer-events-none" />
        
        <div className="relative z-10 max-w-6xl mx-auto">
          <PermissionGuard allowedMenus={allowedMenus} userRole={userRole}>
            {children}
          </PermissionGuard>
        </div>
      </main>
    </div>
  )
}
