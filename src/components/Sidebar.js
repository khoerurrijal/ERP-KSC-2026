'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Users, Package, ShoppingCart, TrendingUp, Settings, LogOut, Box, Factory, Wallet, ChevronDown, ChevronRight, FileText, ShoppingBag, ShieldCheck, PackageCheck, Inbox, Sun, Moon, PanelLeftClose, PanelLeftOpen } from 'lucide-react'
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
      { name: 'Sales Order', path: '/sales', icon: FileText, key: 'penjualan' },
      { name: 'Pesanan Masuk', path: '/dashboard/order-requests', icon: Inbox, key: 'penjualan' },
      { name: 'Marketplace', path: '/marketplace', icon: ShoppingBag, key: 'marketplace' },
      { name: 'Produksi', path: '/production', icon: Factory, key: 'produksi' },
      { name: 'Status Pesanan', path: '/status-pesanan', icon: PackageCheck, key: 'produksi' },
    ]
  },
  {
    name: 'Gudang',
    icon: ShoppingCart,
    key: 'gudang', // Group level key
    subItems: [
      { name: 'Inventory', path: '/inventory', icon: Package },
      { name: 'Purchase Order', path: '/purchases', icon: ShoppingCart },
    ]
  },
  {
    name: 'Keuangan',
    icon: Wallet,
    key: 'keuangan', // Group level key
    subItems: [
      { name: 'Buku Besar', path: '/transactions', icon: TrendingUp },
      { name: 'Kasbon & Pinjaman', path: '/finance/loans', icon: Wallet },
      { name: 'Rekap Gaji', path: '/payroll', icon: Users },
    ]
  },
  {
    name: 'Master Data',
    icon: Box,
    key: 'master_data',
    subItems: [
      { name: 'Produk', path: '/master/products', icon: Box },
      { name: 'Pelanggan', path: '/master/customers', icon: Users },
      { name: 'Supplier', path: '/master/suppliers', icon: Package },
      { name: 'Karyawan', path: '/master/employees', icon: Users },
    ]
  },
  {
    name: 'System',
    icon: Settings,
    subItems: [
      { name: 'Laporan', path: '/report', icon: FileText, key: 'laporan' },
      { name: 'AI Audit', path: '/audit', icon: ShieldCheck, key: 'audit' },
      { name: 'Pengaturan', path: '/settings', icon: Settings, key: 'pengaturan' },
      { name: 'Sistem Konfigurasi', path: '/system-config', icon: Settings, key: 'pengaturan' },
    ]
  }
]

export default function Sidebar({ allowedMenus = [], userRole = '', isMobile = false, isOperatorOnly = false, isCollapsed = false, onToggleCollapse = () => {} }) {
  const pathname = usePathname()
  const [isMobileOpen, setIsMobileOpen] = useState(false)
  const sidebarRef = useRef(null)
  
  // Filter menu based on allowedMenus
  const filteredMenus = MENU_GROUPS.map(group => {
    if (group.roles && !group.roles.includes(userRole)) return null
    if (!group.subItems) {
      if (group.key && !allowedMenus.includes(group.key)) return null
      return group
    }
    if (group.key && !allowedMenus.includes(group.key)) {
      return null
    }
    const filteredSubItems = group.subItems.filter(sub => {
      if (sub.roles && !sub.roles.includes(userRole)) return false
      if (sub.key && !allowedMenus.includes(sub.key)) return false
      return true
    })
    if (filteredSubItems.length === 0) return null
    return { ...group, subItems: filteredSubItems }
  }).filter(Boolean)

  const activeGroupName = filteredMenus.find(group =>
    group.subItems?.some(sub => pathname === sub.path || pathname.startsWith(sub.path + '/'))
  )?.name || null
  const [openGroupKey, setOpenGroupKey] = useState(activeGroupName)

  useEffect(() => {
    if (activeGroupName) setOpenGroupKey(activeGroupName)
  }, [activeGroupName])

  useEffect(() => {
    if (!isCollapsed || !openGroupKey) return undefined

    const handleClickOutside = (event) => {
      if (sidebarRef.current && !sidebarRef.current.contains(event.target)) {
        setOpenGroupKey(null)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isCollapsed, openGroupKey])

  useEffect(() => {
    if (!isMobile || !isMobileOpen) return undefined

    const handleClickOutside = (event) => {
      if (sidebarRef.current && !sidebarRef.current.contains(event.target)) {
        setIsMobileOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isMobile, isMobileOpen])

  const toggleGroup = (groupName) => {
    setOpenGroupKey(current => current === groupName ? null : groupName)
  }

  const handleToggleCollapse = () => {
    if (!isCollapsed) setOpenGroupKey(null)
    onToggleCollapse()
  }

  // (The isOperatorOnly block has been removed since Topbar handles it)

  if (isMobile) {
    return (
      <div ref={sidebarRef} className="fixed top-0 left-0 w-full z-50 bg-background/80 backdrop-blur-xl border-b border-white/10">
        <div className="flex items-center justify-between p-4">
          <div className="flex shrink-0">
            <img src="/logo.png" alt="Logo Light" className="h-8 object-contain drop-shadow-md block dark:hidden" />
            <img src="/logo-dark.png" alt="Logo Dark" className="h-8 object-contain drop-shadow-md hidden dark:block" />
          </div>
          <button onClick={() => setIsMobileOpen(!isMobileOpen)} className="p-2 bg-white/5 border border-white/10 rounded-xl text-foreground">
            <div className="w-5 h-0.5 bg-current mb-1" />
            <div className="w-5 h-0.5 bg-current mb-1" />
            <div className="w-5 h-0.5 bg-current" />
          </button>
        </div>
        {isMobileOpen && (
          <div className="absolute top-full left-0 w-full h-[calc(100vh-64px)] bg-background/95 backdrop-blur-2xl flex flex-col overflow-y-auto border-t border-white/10 animate-in slide-in-from-top-4 p-4">
            <div className="flex-1 space-y-2">
              {filteredMenus.map((group, idx) => (
                <MenuGroup key={idx} group={group} pathname={pathname} onClick={() => setIsMobileOpen(false)} isOpen={openGroupKey === group.name} onToggle={() => toggleGroup(group.name)} />
              ))}
            </div>
             <div className="mt-8 pt-4 border-t border-white/10 pb-10 flex justify-center text-xs text-foreground/40">
               King Sablon Cup Master ERP
             </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <aside ref={sidebarRef} className={`h-screen fixed left-0 top-0 glass-panel flex flex-col z-50 overflow-visible transition-[width] duration-300 ${isCollapsed ? 'w-16' : 'w-64'}`}>
      <div className={`relative flex ${isCollapsed ? 'flex-col items-center gap-2 p-3' : 'items-center justify-center p-6 pb-2'}`}>
        <div className={`${isCollapsed ? 'h-8 w-8' : 'w-full max-w-[130px]'} transition-all duration-300 cursor-pointer hover:scale-105`}>
          <img 
            src="/logo.png" 
            alt="King Sablon Logo Light" 
            className="h-full w-full object-contain drop-shadow-[0_0_12px_rgba(255,255,255,0.6)] hover:drop-shadow-[0_0_20px_rgba(255,255,255,0.9)] block dark:hidden"
          />
          <img 
            src="/logo-dark.png" 
            alt="King Sablon Logo Dark" 
            className="h-full w-full object-contain drop-shadow-[0_0_12px_rgba(255,255,255,0.6)] hover:drop-shadow-[0_0_20px_rgba(255,255,255,0.9)] hidden dark:block"
          />
        </div>
      </div>

      <div className={`flex-1 overflow-y-auto py-2 space-y-2 ${isCollapsed ? 'px-2' : 'px-3'}`}>
        {filteredMenus.map((group, idx) => (
          <MenuGroup
            key={idx}
            group={group}
            pathname={pathname}
            isCollapsed={isCollapsed}
            isOpen={openGroupKey === group.name}
            onClick={isCollapsed ? () => setOpenGroupKey(null) : undefined}
            onToggle={() => toggleGroup(group.name)}
          />
        ))}
      </div>

      <div className={`border-t border-card-border mt-auto text-xs text-foreground/40 text-center ${isCollapsed ? 'p-2' : 'p-4'}`}>
        <button
          type="button"
          onClick={handleToggleCollapse}
          aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="mx-auto mb-2 flex rounded-lg p-2 text-foreground/60 transition-colors hover:bg-white/10 hover:text-foreground"
        >
          {isCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
        </button>
        {isCollapsed ? <span title="King Sablon Cup Master ERP">v1</span> : <>King Sablon Cup Master ERP<br/>v1.0</>}
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

function MenuGroup({ group, pathname, onClick, isOpen = false, onToggle = () => {}, isCollapsed = false }) {
  const hasSubItems = !!group.subItems
  
  // Check if any subitem is active
  const isAnySubActive = hasSubItems && group.subItems.some(sub => pathname === sub.path || pathname.startsWith(sub.path + '/'))
  const isDirectActive = !hasSubItems && (group.exact ? pathname === group.path : pathname.startsWith(group.path))
  
  const Icon = group.icon

  if (!hasSubItems) {
    return (
      <Link
        href={group.path}
        onClick={onClick}
        title={isCollapsed ? group.name : undefined}
        className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
          isCollapsed ? 'justify-center px-2' : ''
        } ${
          isDirectActive
            ? 'bg-primary/20 text-primary font-medium'
            : 'text-foreground/70 hover:bg-white/5 hover:text-foreground'
        }`}
      >
        <Icon className="w-5 h-5" />
        <span className={isCollapsed ? 'sr-only' : ''}>{group.name}</span>
      </Link>
    )
  }

  return (
    <div className="space-y-1">
      <button
        onClick={onToggle}
        title={isCollapsed ? group.name : undefined}
        aria-label={isCollapsed ? group.name : undefined}
        className={`w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl transition-all ${
          isCollapsed ? 'justify-center px-2' : ''
        } ${
          isAnySubActive && !isOpen
            ? 'text-primary font-medium'
            : 'text-foreground/80 hover:bg-white/5 hover:text-foreground'
        }`}
      >
        <div className="flex items-center gap-3">
          <Icon className={`w-5 h-5 ${isAnySubActive ? 'text-primary' : ''}`} />
          <span className={isCollapsed ? 'sr-only' : ''}>{group.name}</span>
        </div>
        {!isCollapsed && (isOpen ? <ChevronDown className="w-4 h-4 opacity-50" /> : <ChevronRight className="w-4 h-4 opacity-50" />)}
      </button>

      {isOpen && (
        <div className={`${isCollapsed ? 'absolute left-full top-0 z-[60] ml-2 min-w-52 rounded-xl border border-white/10 bg-background/95 p-2 shadow-2xl backdrop-blur-xl' : 'pl-11 pr-2 pb-2'} space-y-1`}>
          {group.subItems.map((sub, idx) => {
            const SubIcon = sub.icon
            const isSubActive = pathname === sub.path || pathname.startsWith(sub.path + '/')
            return (
              <Link
                key={idx}
                href={sub.path}
                onClick={onClick}
                title={isCollapsed ? sub.name : undefined}
                className={`flex items-center gap-3 rounded-lg text-sm transition-all ${isCollapsed ? 'px-3 py-2' : 'px-3 py-2'} ${
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
