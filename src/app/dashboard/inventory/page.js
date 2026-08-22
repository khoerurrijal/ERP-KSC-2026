import { Suspense } from 'react'
import { Loader2 } from 'lucide-react'
import InventoryData from './InventoryData'
import MutasiPage from './mutasi/page'
import InventoryTabsClient from './InventoryTabsClient'

export const dynamic = 'force-dynamic'

function InventorySkeleton() {
  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      <div className="glass-card p-6 flex flex-col items-center justify-center gap-3 min-h-[280px]">
        <Loader2 className="w-10 h-10 text-green-400 animate-spin" />
        <p className="text-foreground/50 text-sm animate-pulse">Mengambil data produk & pipeline...</p>
      </div>
    </div>
  )
}

export default async function InventoryPage({ searchParams }) {
  const resolvedSearchParams = await Promise.resolve(searchParams || {})
  const activeTab = ['table', 'pipeline', 'mutations'].includes(resolvedSearchParams.tab) ? resolvedSearchParams.tab : 'table'
  const content = activeTab === 'mutations'
    ? await MutasiPage({ searchParams: resolvedSearchParams })
    : (
      <Suspense key={JSON.stringify(resolvedSearchParams)} fallback={<InventorySkeleton />}>
        <InventoryData searchParams={resolvedSearchParams} activeTab={activeTab} />
      </Suspense>
    )

  return (
    <InventoryTabsClient activeTab={activeTab}>{content}</InventoryTabsClient>
  )
}
