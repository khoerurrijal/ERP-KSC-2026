'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Banknote, Bot, Image as ImageIcon, ListPlus, Percent, ShieldCheck, Store, Wallet } from 'lucide-react'
import { useRoleAccess } from '@/components/RoleAccessContext'

const TABS = [
  { key: 'dropdowns', label: 'Dropdown Form', icon: ListPlus },
  { key: 'cashflow', label: 'Alur Kas', icon: Banknote },
  { key: 'pricelist', label: 'Pricelist & Margin', icon: Percent },
  { key: 'store', label: 'Informasi Toko', icon: Store },
  { key: 'category_images', label: 'Gambar Kategori', icon: ImageIcon },
  { key: 'ai_agent', label: 'AI & Chatbot', icon: Bot },
  { key: 'access', label: 'Akses & Pengguna', icon: ShieldCheck },
  { key: 'salary', label: 'Skema Gaji', icon: Wallet },
]

export default function SettingsLayout({ children }) {
  const searchParams = useSearchParams()
  const { canAccess } = useRoleAccess()
  const activeTab = searchParams.get('tab') || 'dropdowns'
  const visibleTabs = TABS.filter(({ key }) => canAccess(`settings.${key}`))

  return (
    <div className="space-y-4 pb-8">
      <nav aria-label="Bagian pengaturan" className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-8">
        {visibleTabs.map(({ key, label, icon: Icon }) => {
          const isActive = activeTab === key
          return (
            <Link
              key={key}
              href={`/settings?tab=${key}`}
              aria-current={isActive ? 'page' : undefined}
              className={`flex min-h-11 items-center justify-center gap-2 rounded-xl border px-2 py-2 text-center text-xs font-semibold transition-colors sm:text-sm ${
                isActive
                  ? 'border-primary/50 bg-primary/10 text-primary'
                  : 'border-card-border bg-card/50 text-foreground/65 hover:border-primary/30 hover:text-foreground'
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{label}</span>
            </Link>
          )
        })}
      </nav>
      {children}
    </div>
  )
}
