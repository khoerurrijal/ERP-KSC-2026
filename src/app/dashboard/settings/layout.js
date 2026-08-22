'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Settings, Users } from 'lucide-react'

export default function SettingsLayout({ children }) {
  const pathname = usePathname()
  const tabs = [
    { name: 'Sistem Konfigurasi', path: '/system-config', icon: Settings, exact: true },
    { name: 'Pengaturan', path: '/settings', icon: Users, exact: false },
  ]

  return (
    <div className="space-y-4 animate-in fade-in zoom-in-95 duration-500 pb-12">
      <div className="flex items-center gap-1 border-b border-white/10 pb-1 overflow-x-auto hide-scrollbar">
        {tabs.map(tab => {
          const isActive = tab.exact ? pathname === tab.path : pathname.startsWith(tab.path)
          const Icon = tab.icon
          return (
            <Link
              key={tab.path}
              href={tab.path}
              className={`flex items-center gap-2 pb-2 px-3 sm:px-4 text-xs sm:text-sm font-bold whitespace-nowrap transition-all border-b-2 ${
                isActive 
                  ? 'text-primary border-primary' 
                  : 'text-foreground/50 border-transparent hover:text-foreground hover:border-white/20'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.name}
            </Link>
          )
        })}
      </div>

      <div>
        {children}
      </div>
    </div>
  )
}
