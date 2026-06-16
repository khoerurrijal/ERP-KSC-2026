'use client'

import { usePathname } from 'next/navigation'
import { ShieldAlert } from 'lucide-react'

export default function PermissionGuard({ allowedMenus, userRole, children }) {
  const pathname = usePathname()

  // Map route prefixes to menu keys
  const routeMap = {
    '/dashboard/sales': 'penjualan',
    '/dashboard/marketplace': 'marketplace',
    '/dashboard/production': 'produksi',
    '/dashboard/inventory': 'gudang',
    '/dashboard/purchases': 'gudang',
    '/dashboard/transactions': 'keuangan',
    '/dashboard/finance': 'keuangan',
    '/dashboard/payroll': 'keuangan',
    '/dashboard/master': 'master_data',
    '/dashboard/report': 'laporan',
    '/dashboard/settings': 'pengaturan',
  }

  // Determine which menu key the current path belongs to
  let requiredMenuKey = null
  for (const prefix in routeMap) {
    if (pathname.startsWith(prefix)) {
      requiredMenuKey = routeMap[prefix]
      break
    }
  }

  // Dashboard is special
  if (pathname === '/dashboard') {
    requiredMenuKey = 'dashboard'
  }

  // If no specific menu key is required or the user has access
  if (!requiredMenuKey || allowedMenus.includes(requiredMenuKey)) {
    return children
  }

  // Access Denied State
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mb-6 border border-red-500/20">
        <ShieldAlert className="w-10 h-10 text-red-500" />
      </div>
      <h1 className="text-3xl font-black tracking-tight text-foreground mb-2">Akses Ditolak</h1>
      <p className="text-foreground/60 max-w-md mx-auto">
        Maaf, akun Anda ({userRole}) tidak memiliki izin untuk melihat halaman ini. Silakan hubungi Owner atau Admin untuk meminta akses.
      </p>
    </div>
  )
}
