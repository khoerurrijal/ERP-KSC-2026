import { Suspense } from 'react'
import { Boxes, Loader2 } from 'lucide-react'
import InventoryData from './InventoryData'
import MutasiPage from './mutasi/page'
import InventoryTabsClient from './InventoryTabsClient'

export const dynamic = 'force-dynamic'

function InventorySkeleton() {
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Boxes className="w-6 h-6 text-green-400" />
            Inventory
          </h1>
          <p className="text-sm text-foreground/60 mt-1">Memuat data stok gudang...</p>
        </div>
      </header>
      <div className="glass-card p-8 flex flex-col items-center justify-center gap-4 min-h-[400px]">
        <Loader2 className="w-10 h-10 text-green-400 animate-spin" />
        <p className="text-foreground/50 text-sm animate-pulse">Mengambil data produk & pipeline...</p>
      </div>
    </div>
  )
}

export default async function InventoryPage({ searchParams }) {
  const resolvedSearchParams = await Promise.resolve(searchParams || {})
  const activeTab = resolvedSearchParams.tab === 'mutations' ? 'mutations' : 'stock'
  const content = activeTab === 'mutations'
    ? await MutasiPage({ searchParams: resolvedSearchParams })
    : (
      <Suspense key={JSON.stringify(resolvedSearchParams)} fallback={<InventorySkeleton />}>
        <InventoryData searchParams={resolvedSearchParams} />
      </Suspense>
    )

  return (
    <InventoryTabsClient activeTab={activeTab}>{content}</InventoryTabsClient>
  )
}
