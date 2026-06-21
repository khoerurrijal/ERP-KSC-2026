'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Box, Users, Package, FileText } from 'lucide-react'

export default function MasterDataLayout({ children }) {
  const pathname = usePathname()

  const tabs = [
    { name: 'Produk', path: '/dashboard/master/products', icon: Box },
    { name: 'Pelanggan', path: '/dashboard/master/customers', icon: Users },
    { name: 'Supplier', path: '/dashboard/master/suppliers', icon: Package },
    { name: 'Karyawan', path: '/dashboard/master/employees', icon: Users },
    { name: 'Public Pricelist', path: '/pricelist', icon: FileText, external: true },
  ]

  return (
    <div className="space-y-6 animate-in fade-in zoom-in-95 duration-500 pb-20">
      {/* Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-white/10 pb-2">
        {tabs.map(tab => {
          const isActive = pathname.startsWith(tab.path)
          const Icon = tab.icon
          return (
            <Link
              key={tab.path}
              href={tab.path}
              target={tab.external ? "_blank" : undefined}
              rel={tab.external ? "noopener noreferrer" : undefined}
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
