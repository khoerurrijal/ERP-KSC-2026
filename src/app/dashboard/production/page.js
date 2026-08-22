import { Suspense } from 'react'
import { Factory, Loader2 } from 'lucide-react'
import ProductionData from './ProductionData'

export const dynamic = 'force-dynamic'

function ProductionSkeleton() {
  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Factory className="w-6 h-6 text-purple-400" />
            Produksi
          </h1>
          <p className="text-sm text-foreground/60 mt-1">Memuat tracking produksi...</p>
        </div>
      </header>
      <div className="glass-card p-6 flex flex-col items-center justify-center gap-3 min-h-[280px]">
        <Loader2 className="w-10 h-10 text-purple-400 animate-spin" />
        <p className="text-foreground/50 text-sm animate-pulse">Mengambil data produksi...</p>
      </div>
    </div>
  )
}

export default function ProductionPage() {
  return (
    <Suspense fallback={<ProductionSkeleton />}>
      <ProductionData />
    </Suspense>
  )
}
