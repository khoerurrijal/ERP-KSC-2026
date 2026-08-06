'use client'

import Link from 'next/link'
import { Boxes, History } from 'lucide-react'

const tabs = [
  { key: 'stock', label: 'Stok', icon: Boxes },
  { key: 'mutations', label: 'Riwayat Mutasi', icon: History },
]

export default function InventoryTabsClient({ activeTab = 'stock', children }) {
  return (
    <div className="space-y-6">
      <nav className="flex flex-wrap items-center gap-2 border-b border-white/10 pb-2">
        {tabs.map(tab => {
          const Icon = tab.icon
          const href = tab.key === 'stock' ? '/inventory' : '/inventory?tab=mutations'
          return (
            <Link
              key={tab.key}
              href={href}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-bold border-b-2 transition-all ${activeTab === tab.key ? 'text-primary border-primary' : 'text-foreground/50 border-transparent hover:text-foreground'}`}
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
