'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, CheckCircle2, PackageCheck, Truck, X } from 'lucide-react'
import { confirmInvoiceDelivery } from '@/app/dashboard/production/actions'

export default function ShippingConfirmationClient({ orders = [], error = '', embedded = false }) {
  const [loadingKey, setLoadingKey] = useState('')
  const [pendingConfirmation, setPendingConfirmation] = useState(null)
  const [completedOrderIds, setCompletedOrderIds] = useState(() => new Set())

  const handleConfirm = async () => {
    if (!pendingConfirmation) return
    const { order, status } = pendingConfirmation
    const key = `${order.soId}-${status}`
    setLoadingKey(key)
    const result = await confirmInvoiceDelivery(order.soId, status)
    setLoadingKey('')

    if (!result.success) {
      alert(result.error || 'Gagal mengonfirmasi pengiriman.')
      return
    }

    setCompletedOrderIds(previous => new Set([...previous, order.soId]))
    setPendingConfirmation(null)
  }

  const visibleOrders = orders.filter(order => !completedOrderIds.has(order.soId))

  return (
    <div className="space-y-4 animate-in fade-in zoom-in-95 duration-500 pb-12">
      {!embedded && <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <Link href="/production" className="text-xs text-foreground/50 hover:text-primary inline-flex items-center gap-1 mb-2">
            <ArrowLeft className="w-3 h-3" /> Kembali ke Produksi
          </Link>
        </div>
        <div className="px-3 py-2 rounded-lg bg-primary/10 border border-primary/20 text-xs text-primary font-bold">
          {visibleOrders.length} invoice siap diproses
        </div>
      </div>}

      {error && <div className="glass-card p-4 border border-red-500/30 text-red-400 text-sm">Gagal mengambil data: {error}</div>}

      {!error && visibleOrders.length === 0 && (
        <div className="glass-card p-12 text-center text-foreground/50">Belum ada invoice yang siap dikonfirmasi.</div>
      )}

      <div className="space-y-4">
        {visibleOrders.map(order => (
          <div key={order.soId} className="glass-card p-3 sm:p-4 space-y-3">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div>
                <p className="text-xs text-foreground/50 uppercase font-bold tracking-wider">Nama / Brand</p>
                <h2 className="text-lg font-bold text-primary">{order.customerName || 'Pelanggan'}</h2>
                <p className="text-xs text-foreground/60">Invoice: {order.invoiceNumber || '-'}</p>
                <p className="text-sm text-foreground/70">
                  Tanggal pesan: {order.orderDate ? new Date(order.orderDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : '-'} · {order.paymentStatus}
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  disabled={loadingKey !== ''}
                  onClick={() => setPendingConfirmation({ order, status: 'DIKIRIM', label: 'DIKIRIM' })}
                  className="px-3 py-2 rounded-lg bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 hover:bg-indigo-500/25 disabled:opacity-50 flex items-center justify-center gap-2 text-sm font-bold"
                >
                  <Truck className="w-4 h-4" />
                  {loadingKey === `${order.soId}-DIKIRIM` ? 'Memproses...' : 'Dikirim'}
                </button>
                <button
                  disabled={loadingKey !== ''}
                  onClick={() => setPendingConfirmation({ order, status: 'SUDAH DIAMBIL', label: 'SUDAH DIAMBIL' })}
                  className="px-3 py-2 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/25 disabled:opacity-50 flex items-center justify-center gap-2 text-sm font-bold"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  {loadingKey === `${order.soId}-SUDAH DIAMBIL` ? 'Memproses...' : 'Sudah Diambil'}
                </button>
              </div>
            </div>

            <div className="grid gap-2">
              {order.items.map(item => (
                <div key={item.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-lg bg-white/5 border border-white/10 px-3 py-2">
                  <div>
                    <p className="font-semibold text-sm text-foreground">{item.productName}</p>
                    <p className="text-xs text-foreground/50">{item.orderType} · {item.qty} {item.unit}</p>
                    {item.notes && <p className="text-[10px] text-foreground/50 italic whitespace-pre-line">{item.notes}</p>}
                  </div>
                  <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-purple-500/15 text-purple-300 border border-purple-500/20">{item.status}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {pendingConfirmation && (
        <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onMouseDown={event => event.target === event.currentTarget && setPendingConfirmation(null)}>
          <div className="w-full max-w-md glass-card border border-white/15 rounded-2xl p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4 mb-5">
              <div>
                <p className="text-xs text-primary uppercase font-bold tracking-wider">Konfirmasi Pengiriman</p>
                <h3 className="text-xl font-bold text-foreground mt-1">{pendingConfirmation.order.customerName || 'Pelanggan'}</h3>
              </div>
              <button
                onClick={() => setPendingConfirmation(null)}
                disabled={loadingKey !== ''}
                className="p-2 rounded-lg text-foreground/50 hover:text-foreground hover:bg-white/10 disabled:opacity-40"
                aria-label="Tutup konfirmasi"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="rounded-xl bg-white/5 border border-white/10 p-4 space-y-2 text-sm">
              <p className="text-foreground/70">Invoice: <span className="font-bold text-foreground">{pendingConfirmation.order.invoiceNumber || '-'}</span></p>
              <p className="text-foreground/70">Tanggal pesan: <span className="font-bold text-foreground">{pendingConfirmation.order.orderDate ? new Date(pendingConfirmation.order.orderDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : '-'}</span></p>
              <p className="text-foreground/70">Status pembayaran: <span className="font-bold text-foreground">{pendingConfirmation.order.paymentStatus}</span></p>
              <p className="text-foreground/70">Status baru: <span className="font-bold text-primary">{pendingConfirmation.label}</span></p>
            </div>

            <p className="text-sm text-foreground/60 mt-4">Semua barang dalam invoice ini akan diperbarui sekaligus.</p>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setPendingConfirmation(null)}
                disabled={loadingKey !== ''}
                className="btn-secondary px-4 py-2.5 text-sm disabled:opacity-40"
              >
                Batal
              </button>
              <button
                onClick={handleConfirm}
                disabled={loadingKey !== ''}
                className="btn-primary px-4 py-2.5 text-sm disabled:opacity-50"
              >
                {loadingKey !== '' ? 'Memproses...' : 'Ya, Konfirmasi'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
