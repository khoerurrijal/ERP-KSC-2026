import { Suspense } from 'react'
import { Users, Loader2 } from 'lucide-react'
import CustomerData from './CustomerData'

export const dynamic = 'force-dynamic'

function CustomerSkeleton() {
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Users className="w-6 h-6 text-primary" /> Data Pelanggan
          </h1>
          <p className="text-sm text-foreground/60 mt-1">Memuat data pelanggan...</p>
        </div>
      </header>
      <div className="glass-card p-8 flex flex-col items-center justify-center gap-4 min-h-[400px]">
        <Loader2 className="w-10 h-10 text-primary animate-spin" />
        <p className="text-foreground/50 text-sm animate-pulse">Mengambil data master pelanggan...</p>
      </div>
    </div>
  )
}

export default async function CustomersPage({ searchParams }) {
  const resolvedSearchParams = await Promise.resolve(searchParams || {})
  return (
    <Suspense key={JSON.stringify(resolvedSearchParams)} fallback={<CustomerSkeleton />}>
      <CustomerData searchParams={resolvedSearchParams} />
    </Suspense>
  )
}
