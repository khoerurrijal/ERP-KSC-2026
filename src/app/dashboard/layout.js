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
  const matchedUser = userRoles.find(u => {
    const inputEmail = (u.email || '').trim().toLowerCase()
    return inputEmail === userEmail || `${inputEmail}@kingsablon.com` === userEmail
  })
  const userRole = matchedUser ? matchedUser.role : 'Operator'

  const allowedMenus = rolePermissions[userRole] || []

  const isOperator = userRole === 'Operator'

  return (
    <div className={`min-h-screen bg-transparent text-foreground flex flex-col ${!isOperator ? 'md:flex-row' : ''}`}>
      {/* Sidebar - Hidden for Operators on all screens, responsive for others */}
      {!isOperator && (
        <>
          <div className="hidden md:block">
            <Sidebar allowedMenus={allowedMenus} userRole={userRole} />
          </div>
          {/* Mobile Topbar for non-operators could go here, or we let Sidebar handle mobile if we upgrade Sidebar */}
          <div className="md:hidden">
            <Sidebar allowedMenus={allowedMenus} userRole={userRole} isMobile={true} />
          </div>
        </>
      )}

      {/* Operator Mobile Header */}
      {isOperator && (
        <div className="w-full bg-background/80 backdrop-blur-md border-b border-white/10 p-4 sticky top-0 z-50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex shrink-0">
              <img src="/logo.png" alt="Logo Light" className="h-8 object-contain drop-shadow-md block dark:hidden" />
              <img src="/logo-dark.png" alt="Logo Dark" className="h-8 object-contain drop-shadow-md hidden dark:block" />
            </div>
            <span className="font-bold text-primary">Operator Panel</span>
          </div>
          <Sidebar allowedMenus={allowedMenus} userRole={userRole} isOperatorOnly={true} />
        </div>
      )}

      {/* Main Content Area */}
      <main className={`flex-1 relative min-h-screen overflow-x-hidden ${isOperator ? 'p-4' : 'p-4 md:p-8 md:ml-64 pt-20 md:pt-8'}`}>
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
