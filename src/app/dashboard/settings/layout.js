'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Settings, Wallet, Users } from 'lucide-react'

export default function SettingsLayout({ children }) {
  const pathname = usePathname()

  const tabs = [
    { name: 'Sistem Konfigurasi', path: '/dashboard/settings', icon: Settings, exact: true },
    { name: 'Skema Gaji', path: '/dashboard/settings/salary-schemas', icon: Users, exact: false },
  ]

  return (
    <div className="space-y-6 animate-in fade-in zoom-in-95 duration-500 pb-20">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Settings className="w-6 h-6 text-primary" />
            Pengaturan Aplikasi
          </h1>
          <p className="text-sm text-foreground/60 mt-1">Konfigurasi seluruh parameter, harga, dan skema aplikasi.</p>
        </div>
      </header>

      {/* Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-white/10 pb-2">
        {tabs.map(tab => {
          const isActive = tab.exact ? pathname === tab.path : pathname.startsWith(tab.path)
          const Icon = tab.icon
          return (
            <Link
              key={tab.path}
              href={tab.path}
              className={`flex items-center gap-2 pb-2 px-4 text-sm font-bold transition-all border-b-2 ${
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

      <div className="pt-2">
        {children}
      </div>
    </div>
  )
}
