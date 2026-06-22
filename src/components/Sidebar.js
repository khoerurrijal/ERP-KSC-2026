'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Users, Package, ShoppingCart, TrendingUp, Settings, LogOut, Box, Factory, Wallet, ChevronDown, ChevronRight, FileText, ShoppingBag, Sun, Moon } from 'lucide-react'
import { useTheme } from 'next-themes'

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

export default function Sidebar({ allowedMenus = [], userRole = '', isMobile = false, isOperatorOnly = false }) {
  const pathname = usePathname()
  const [isOpen, setIsOpen] = useState(false)
  
  // Filter menu based on allowedMenus
  const filteredMenus = MENU_GROUPS.map(group => {
    if (!group.subItems) {
      if (group.key && !allowedMenus.includes(group.key)) return null
      return group
    }
    if (group.key && !allowedMenus.includes(group.key)) {
      return null
    }
    const filteredSubItems = group.subItems.filter(sub => {
      if (sub.key && !allowedMenus.includes(sub.key)) return false
      return true
    })
    if (filteredSubItems.length === 0) return null
    return { ...group, subItems: filteredSubItems }
  }).filter(Boolean)

  if (isOperatorOnly) {
    return (
      <div className="relative">
        <button onClick={() => setIsOpen(!isOpen)} className="p-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-primary transition-colors flex items-center gap-2">
           <Users className="w-5 h-5" />
        </button>
        {isOpen && (
          <div className="absolute right-0 top-full mt-2 w-48 bg-background border border-white/10 rounded-xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2 p-2 flex flex-col gap-2">
            <div className="px-3 py-2 border-b border-white/10 mb-2">
              <span className="text-xs text-foreground/60 block">Login sebagai:</span>
              <span className="text-sm font-bold text-primary">{userRole}</span>
            </div>
            <ThemeToggle />
            <form action="/auth/signout" method="post">
              <button type="submit" className="flex items-center gap-3 px-3 py-2 w-full rounded-lg text-red-400 hover:bg-red-400/10 transition-all font-medium">
                <LogOut className="w-4 h-4" />
                <span>Sign Out</span>
              </button>
            </form>
          </div>
        )}
      </div>
    )
  }

  if (isMobile) {
    return (
      <div className="fixed top-0 left-0 w-full z-50 bg-background/80 backdrop-blur-xl border-b border-white/10">
        <div className="flex items-center justify-between p-4">
          <img src="/logo.png" alt="Logo" className="h-8 object-contain drop-shadow-md" />
          <button onClick={() => setIsOpen(!isOpen)} className="p-2 bg-white/5 border border-white/10 rounded-xl text-foreground">
            <div className="w-5 h-0.5 bg-current mb-1" />
            <div className="w-5 h-0.5 bg-current mb-1" />
            <div className="w-5 h-0.5 bg-current" />
          </button>
        </div>
        {isOpen && (
          <div className="absolute top-full left-0 w-full h-[calc(100vh-64px)] bg-background/95 backdrop-blur-2xl flex flex-col overflow-y-auto border-t border-white/10 animate-in slide-in-from-top-4 p-4">
            <div className="flex-1 space-y-2">
              {filteredMenus.map((group, idx) => (
                <MenuGroup key={idx} group={group} pathname={pathname} onClick={() => setIsOpen(false)} />
              ))}
            </div>
            <div className="mt-8 pt-4 border-t border-white/10 pb-10">
               <div className="mb-4 px-4 py-2 bg-primary/10 rounded-xl border border-primary/20 text-center">
                 <span className="text-xs text-foreground/60 block mb-1">Login sebagai:</span>
                 <span className="text-sm font-bold text-primary">{userRole}</span>
               </div>
               <ThemeToggle />
               <form action="/auth/signout" method="post" className="mt-2">
                 <button type="submit" className="flex items-center gap-3 px-4 py-3 w-full rounded-xl text-red-400 hover:bg-red-400/10 transition-all font-medium justify-center">
                   <LogOut className="w-5 h-5" />
                   <span>Sign Out</span>
                 </button>
               </form>
            </div>
          </div>
        )}
      </div>
    )
  }

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
        <ThemeToggle />
        <form action="/auth/signout" method="post" className="mt-2">
          <button type="submit" className="flex items-center gap-3 px-4 py-3 w-full rounded-xl text-red-400 hover:bg-red-400/10 transition-all font-medium justify-center">
            <LogOut className="w-5 h-5" />
            <span>Sign Out</span>
          </button>
        </form>
      </div>
    </aside>
  )
}


function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) return null

  const isDark = theme === 'dark' || (!theme && window.matchMedia('(prefers-color-scheme: dark)').matches)

  return (
    <button 
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      className="flex items-center gap-3 px-4 py-3 w-full rounded-xl hover:bg-white/5 transition-all font-medium text-foreground/80 hover:text-foreground mb-2"
    >
      {isDark ? <Sun className="w-5 h-5 text-yellow-500" /> : <Moon className="w-5 h-5 text-slate-800" />}
      <span>{isDark ? 'Light Mode' : 'Dark Mode'}</span>
    </button>
  )
}

function MenuGroup({ group, pathname, onClick }) {
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
        onClick={onClick}
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
                onClick={onClick}
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
