'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Users, Package, ShoppingCart, TrendingUp, Settings, LogOut, Box, Factory, Wallet, ChevronDown, ChevronRight, FileText, ShoppingBag } from 'lucide-react'

const MENU_GROUPS = [
  {
    name: 'Dashboard',
    path: '/dashboard',
    icon: LayoutDashboard,
    exact: true,
    key: 'dashboard'
  },
  {
    name: 'Penjualan',
    icon: TrendingUp,
    subItems: [
      { name: 'Sales Order', path: '/dashboard/sales', icon: FileText, key: 'penjualan' },
      { name: 'Marketplace', path: '/dashboard/marketplace', icon: ShoppingBag, key: 'marketplace' },
      { name: 'Produksi', path: '/dashboard/production', icon: Factory, key: 'produksi' },
      { name: 'Public Pricelist', path: '/pricelist', icon: FileText, key: 'pricelist' },
    ]
  },
  {
    name: 'Gudang',
    icon: ShoppingCart,
    key: 'gudang', // Group level key
    subItems: [
      { name: 'Inventory', path: '/dashboard/inventory', icon: Package },
      { name: 'Purchase Order', path: '/dashboard/purchases', icon: ShoppingCart },
    ]
  },
  {
    name: 'Keuangan',
    icon: Wallet,
    key: 'keuangan', // Group level key
    subItems: [
      { name: 'Buku Besar', path: '/dashboard/transactions', icon: TrendingUp },
      { name: 'Kasbon & Pinjaman', path: '/dashboard/finance/loans', icon: Wallet },
      { name: 'Rekap Gaji', path: '/dashboard/payroll', icon: Users },
    ]
  },
  {
    name: 'Master Data',
    path: '/dashboard/master/products',
    icon: Box,
    exact: false,
    key: 'master_data'
  },
  {
    name: 'System',
    icon: Settings,
    subItems: [
      { name: 'Laporan', path: '/dashboard/report', icon: FileText, key: 'laporan' },
      { name: 'Pengaturan', path: '/dashboard/settings', icon: Settings, key: 'pengaturan' },
    ]
  }
]

export default function Sidebar({ allowedMenus = [], userRole = '' }) {
  const pathname = usePathname()
  
  // Filter menu based on allowedMenus
  const filteredMenus = MENU_GROUPS.map(group => {
    // If it's a direct menu with a key, check if key is allowed
    if (!group.subItems) {
      if (group.key && !allowedMenus.includes(group.key)) return null
      return group
    }
    
    // If the whole group has a key (like gudang, keuangan)
    if (group.key && !allowedMenus.includes(group.key)) {
      return null
    }

    // Otherwise, check subitems
    const filteredSubItems = group.subItems.filter(sub => {
      if (sub.key && !allowedMenus.includes(sub.key)) return false
      return true
    })

    if (filteredSubItems.length === 0) return null

    return { ...group, subItems: filteredSubItems }
  }).filter(Boolean)

  return (
    <aside className="w-64 h-screen fixed left-0 top-0 glass-panel flex flex-col z-50">
      <div className="p-6 pb-2 flex justify-center">
        <img 
          src="/logo.png" 
          alt="King Sablon Logo" 
          className="w-full max-w-[130px] h-auto object-contain drop-shadow-[0_0_12px_rgba(255,255,255,0.6)] hover:drop-shadow-[0_0_20px_rgba(255,255,255,0.9)] hover:scale-105 transition-all duration-300 cursor-pointer" 
        />
      </div>

      <div className="flex-1 overflow-y-auto py-2 px-3 space-y-2">
        {filteredMenus.map((group, idx) => (
          <MenuGroup key={idx} group={group} pathname={pathname} />
        ))}
      </div>

      <div className="p-4 border-t border-card-border mt-auto">
        {userRole && (
          <div className="mb-4 px-4 py-2 bg-primary/10 rounded-xl border border-primary/20 text-center">
            <span className="text-xs text-foreground/60 block mb-1">Login sebagai:</span>
            <span className="text-sm font-bold text-primary">{userRole}</span>
          </div>
        )}
        <form action="/auth/signout" method="post">
          <button type="submit" className="flex items-center gap-3 px-4 py-3 w-full rounded-xl text-red-400 hover:bg-red-400/10 transition-all font-medium justify-center">
            <LogOut className="w-5 h-5" />
            <span>Sign Out</span>
          </button>
        </form>
      </div>
    </aside>
  )
}

function MenuGroup({ group, pathname }) {
  const hasSubItems = !!group.subItems
  
  // Check if any subitem is active
  const isAnySubActive = hasSubItems && group.subItems.some(sub => pathname === sub.path || pathname.startsWith(sub.path + '/'))
  const isDirectActive = !hasSubItems && (group.exact ? pathname === group.path : pathname.startsWith(group.path))
  
  // By default, open if any subitem is active
  const [isOpen, setIsOpen] = useState(isAnySubActive)
  const Icon = group.icon

  if (!hasSubItems) {
    return (
      <Link
        href={group.path}
        prefetch={false}
        className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
          isDirectActive
            ? 'bg-primary/20 text-primary font-medium'
            : 'text-foreground/70 hover:bg-white/5 hover:text-foreground'
        }`}
      >
        <Icon className="w-5 h-5" />
        <span>{group.name}</span>
      </Link>
    )
  }

  return (
    <div className="space-y-1">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl transition-all ${
          isAnySubActive && !isOpen
            ? 'text-primary font-medium'
            : 'text-foreground/80 hover:bg-white/5 hover:text-foreground'
        }`}
      >
        <div className="flex items-center gap-3">
          <Icon className={`w-5 h-5 ${isAnySubActive ? 'text-primary' : ''}`} />
          <span>{group.name}</span>
        </div>
        {isOpen ? <ChevronDown className="w-4 h-4 opacity-50" /> : <ChevronRight className="w-4 h-4 opacity-50" />}
      </button>

      {isOpen && (
        <div className="pl-11 pr-2 space-y-1 pb-2">
          {group.subItems.map((sub, idx) => {
            const SubIcon = sub.icon
            const isSubActive = pathname === sub.path || pathname.startsWith(sub.path + '/')
            return (
              <Link
                key={idx}
                href={sub.path}
                prefetch={false}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all ${
                  isSubActive
                    ? 'bg-primary/20 text-primary font-medium'
                    : 'text-foreground/60 hover:bg-white/5 hover:text-foreground'
                }`}
              >
                <SubIcon className="w-4 h-4" />
                <span>{sub.name}</span>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
