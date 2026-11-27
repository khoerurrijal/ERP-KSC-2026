'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, Loader2 } from 'lucide-react'
import { advanceUnpaidSalesOrderToProduction } from '@/app/dashboard/production/actions'

const formatDate = date => date
  ? new Date(`${date}T00:00:00`).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })
  : '-'

export default function DashboardNewOrders({ orders = [] }) {
  const router = useRouter()
  const [pendingOrderId, setPendingOrderId] = useState(null)
  const [isPending, startTransition] = useTransition()

  const handleAdvance = order => {
    setPendingOrderId(order.id)
    startTransition(async () => {
      const result = await advanceUnpaidSalesOrderToProduction(order.id)
      setPendingOrderId(null)
      if (!result.success) {
        window.alert(result.error)
        return
      }
      router.refresh()
    })
  }

  return (
    <section className="rounded-xl border border-amber-400/20 bg-amber-400/[0.04] p-3" aria-label="Pesanan belum lunas berstatus baru masuk">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-bold text-foreground">Pesanan Baru Masuk</h3>
          <p className="text-[11px] text-foreground/55">Belum lunas · pilih yang memang diminta diproses</p>
        </div>
        <span className="rounded-full bg-amber-400/10 px-2 py-1 text-xs font-bold text-amber-300">{orders.length}</span>
      </div>

      {orders.length === 0 ? (
        <p className="rounded-lg border border-white/5 bg-white/[0.03] px-3 py-3 text-xs text-foreground/50">Tidak ada pesanan belum lunas yang menunggu keputusan proses.</p>
      ) : (
        <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
          {orders.map(order => {
            const pending = isPending && pendingOrderId === order.id
            return (
              <article key={order.id} className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-background/50 p-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">{order.customerName}</p>
                  <p className="mt-0.5 text-[11px] text-foreground/55">
                    {formatDate(order.date)} · {order.itemCount} item sablon Baru Masuk
                  </p>
                  {order.products?.length > 0 && <p className="mt-1 truncate text-[11px] text-foreground/45">{order.products.join(', ')}</p>}
                </div>
                <button
                  type="button"
                  onClick={() => handleAdvance(order)}
                  disabled={isPending}
                  title="Ubah item sablon Baru Masuk menjadi Siap Proses"
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-bold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-wait disabled:opacity-50"
                >
                  {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowRight className="h-3.5 w-3.5" />}
                  Siap Proses
                </button>
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}
