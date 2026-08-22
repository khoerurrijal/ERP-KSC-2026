'use client'

import Link from 'next/link'
import { ShieldCheck, Wallet } from 'lucide-react'

export default function PengaturanClient({ activeTab = 'access', children }) {
  const tabs = [
    { key: 'access', label: 'Akses & User', icon: ShieldCheck },
    { key: 'salary', label: 'Skema Gaji', icon: Wallet },
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-1 border-b border-white/10 pb-1 overflow-x-auto hide-scrollbar">
        {tabs.map(({ key, label, icon: Icon }) => (
          <Link
            key={key}
            href={`/settings?tab=${key}`}
            className={`flex items-center gap-2 pb-2 px-3 sm:px-4 text-xs sm:text-sm font-bold whitespace-nowrap transition-all border-b-2 ${
              activeTab === key
                ? 'text-primary border-primary'
                : 'text-foreground/50 border-transparent hover:text-foreground hover:border-white/20'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </Link>
        ))}
      </div>

      {children}
    </div>
  )
}
