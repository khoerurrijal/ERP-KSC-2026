'use client'

import Link from 'next/link'
import { PackageSearch, Kanban, History } from 'lucide-react'

const tabs = [
  { key: 'table', label: 'Tabel Stok', icon: PackageSearch },
  { key: 'pipeline', label: 'Tracking Stok', icon: Kanban },
  { key: 'mutations', label: 'Riwayat Mutasi', icon: History },
]

export default function InventoryTabsClient({ activeTab = 'table', children }) {
  return (
    <div className="space-y-4">
      <nav className="flex items-center gap-1 border-b border-white/10 pb-1 overflow-x-auto hide-scrollbar">
        {tabs.map(tab => {
          const Icon = tab.icon
          const href = `/inventory?tab=${tab.key}`
          return (
            <Link
              key={tab.key}
              href={href}
              className={`flex items-center gap-2 px-3 sm:px-4 py-2 text-xs sm:text-sm font-bold border-b-2 transition-all whitespace-nowrap ${activeTab === tab.key ? 'text-primary border-primary' : 'text-foreground/50 border-transparent hover:text-foreground'}`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </Link>
          )
        })}
      </nav>
      {children}
    </div>
  )
}
