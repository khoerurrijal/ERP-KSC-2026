import { Suspense } from 'react'
import { TrendingUp, Loader2 } from 'lucide-react'
import SalesData from './SalesData'

export const dynamic = 'force-dynamic'

function SalesSkeleton() {
  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white uppercase tracking-tight flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-primary" /> Transaksi Penjualan
          </h1>
          <p className="text-sm text-foreground/60 mt-1">Memuat data penjualan...</p>
        </div>
      </header>
      <div className="glass-card p-6 flex flex-col items-center justify-center gap-3 min-h-[280px]">
        <Loader2 className="w-10 h-10 text-primary animate-spin" />
        <p className="text-foreground/50 text-sm animate-pulse">Mengambil data invoice & item penjualan...</p>
      </div>
    </div>
  )
}

export default async function SalesPage({ searchParams }) {
  const resolvedSearchParams = await Promise.resolve(searchParams || {})
  return (
    <Suspense key={JSON.stringify(resolvedSearchParams)} fallback={<SalesSkeleton />}>
      <SalesData searchParams={resolvedSearchParams} />
    </Suspense>
  )
}
