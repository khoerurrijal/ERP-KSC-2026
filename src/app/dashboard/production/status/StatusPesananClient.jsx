'use client'

import Link from 'next/link'
import { ClipboardCheck, ListChecks, PackageCheck } from 'lucide-react'

const tabs = [
  { key: 'shipping', label: 'Konfirmasi Pengiriman', icon: PackageCheck },
  { key: 'orders', label: 'Status Pesanan', icon: ListChecks },
  { key: 'items', label: 'Ubah Status', icon: ClipboardCheck },
]

export default function StatusPesananClient({ activeTab = 'orders', children }) {
  return (
    <div className="space-y-6 animate-in fade-in zoom-in-95 duration-500 pb-20">
      <header>
        <h1 className="text-2xl font-bold text-foreground">Status Pesanan</h1>
        <p className="text-sm text-foreground/60 mt-1">Pantau dan perbarui status pesanan dari produksi sampai pengiriman.</p>
      </header>

      <nav className="flex flex-wrap items-center gap-2 border-b border-white/10 pb-2">
        {tabs.map(tab => {
          const Icon = tab.icon
          return (
            <Link
              key={tab.key}
              href={`/status-pesanan?tab=${tab.key}`}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-bold border-b-2 transition-all ${activeTab === tab.key ? 'text-primary border-primary' : 'text-foreground/50 border-transparent hover:text-foreground'}`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </Link>
          )
        })}
      </nav>

      <div>{children}</div>
    </div>
  )
}
