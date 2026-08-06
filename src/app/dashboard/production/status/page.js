import { Suspense } from 'react'
import ProductionData from '../ProductionData'
import SalesData from '../../sales/SalesData'
import ShippingConfirmationPage from '../shipping/page'
import StatusPesananClient from './StatusPesananClient'

export const dynamic = 'force-dynamic'

function StatusSkeleton() {
  return <div className="glass-card p-8 text-center text-foreground/50">Memuat status pesanan...</div>
}

export default async function StatusPesananPage({ searchParams }) {
  const params = await Promise.resolve(searchParams || {})
  const activeTab = ['shipping', 'orders', 'items'].includes(params.tab) ? params.tab : 'orders'

  let content
  if (activeTab === 'shipping') {
    content = await ShippingConfirmationPage({ embedded: true })
  } else if (activeTab === 'items') {
    content = await SalesData({ searchParams: params, itemsOnly: true })
  } else {
    content = await ProductionData({ mode: 'status', embedded: true })
  }

  return (
    <Suspense fallback={<StatusSkeleton />}>
      <StatusPesananClient activeTab={activeTab}>{content}</StatusPesananClient>
    </Suspense>
  )
}
