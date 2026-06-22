'use client'

import React, { useState } from 'react'
import { Package, Truck, CheckCircle2, Clock, Check, ChevronDown, AlertCircle, Printer, Settings, PackageOpen, CreditCard } from 'lucide-react'

const STATUS_STEPS = [
  { key: 'BARU MASUK', label: 'Baru Masuk', icon: PackageOpen },
  { key: 'SIAP PROSES', label: 'Siap Proses', icon: Clock },
  { key: 'PROSES', label: 'Diproses', icon: Settings },
  { key: 'SIAP KIRIM', label: 'Menunggu Lunas', icon: CreditCard }, 
  { key: 'SIAP KIRIM_ACTUAL', label: 'Siap Kirim', icon: PackageOpen }, 
  { key: 'DIKIRIM', label: 'Dikirim', icon: Truck }, 
  { key: 'SELESAI', label: 'Selesai', icon: CheckCircle2 }
]

export default function TrackClient({ order, logs, settings, employees }) {
  const storeName = settings?.store_name || 'KING SABLON'
  
  const paymentStatus = order.payment_status || 'BELUM LUNAS'
  const items = order.sales_items || []
  
  const amountPaid = order.dp_amount || 0
  const totalAmount = order.total_amount || 0
  const sisa = totalAmount - amountPaid

  const [expandedItems, setExpandedItems] = useState(items.length === 1 ? [items[0].id] : [])

  const toggleExpand = (id) => {
    if (items.length === 1) return 
    if (expandedItems.includes(id)) {
      setExpandedItems(expandedItems.filter(i => i !== id))
    } else {
      setExpandedItems([...expandedItems, id])
    }
  }

  const getEmployeeName = (id) => {
    const emp = employees?.find(e => e.id === id)
    return emp?.full_name || 'Tim Produksi'
  }

  const getStepState = (stepKey, stepLabel, currentStatus) => {
    const status = (currentStatus || 'BARU MASUK').toUpperCase()

    if (stepLabel === 'Menunggu Lunas') {
      if (paymentStatus === 'LUNAS') return 'passed'
      else {
        if (['SIAP KIRIM', 'DIKIRIM', 'SUDAH DIAMBIL'].includes(status)) return 'active-blinking'
        if (status === 'SELESAI') return 'passed'
        return 'future'
      }
    }

    const statusOrder = ['BARU MASUK', 'SIAP PROSES', 'PROSES', 'SUDAH JADI', 'SIAP KIRIM', 'DIKIRIM', 'SUDAH DIAMBIL', 'SELESAI']
    let currentIdx = statusOrder.indexOf(status)
    if (currentIdx === -1) currentIdx = 0 
    
    let actualStepKey = stepKey === 'SIAP KIRIM_ACTUAL' ? 'SIAP KIRIM' : stepKey
    let targetIdx = statusOrder.indexOf(actualStepKey)
    if (actualStepKey === 'DIKIRIM') {
      targetIdx = Math.max(statusOrder.indexOf('DIKIRIM'), statusOrder.indexOf('SUDAH DIAMBIL'))
    }

    if (currentIdx > targetIdx) return 'passed'
    if (currentIdx === targetIdx) {
       if (status === 'SUDAH DIAMBIL' && actualStepKey === 'DIKIRIM') return 'active'
       if (status === actualStepKey) return 'active'
       return 'passed'
    }
    return 'future'
  }

  return (
    <div className="min-h-screen bg-transparent text-white flex justify-center pb-20">
      <div className="w-full max-w-md bg-black/40 backdrop-blur-3xl min-h-screen shadow-2xl relative flex flex-col border-x border-white/10">
        
        {/* Header */}
        <div className="p-8 bg-gradient-to-b from-primary/10 to-transparent flex flex-col items-center justify-center text-center">
          <div className="w-32 h-32 mb-2 flex items-center justify-center">
            <img 
              src="/logo.png" 
              alt="Logo" 
              className="max-w-full max-h-full object-contain filter drop-shadow-[0_0_15px_rgba(212,175,55,0.4)]" 
            />
          </div>
          {/* Sembunyikan text title karena logo sudah punya text King Sablon */}
          <h1 className="text-lg font-bold tracking-tight sr-only">{storeName}</h1>
          <p className="text-sm text-foreground/70 font-medium">Lacak Pesanan Anda</p>
        </div>

        <div className="px-6 -mt-4 relative z-10 space-y-4">
          
          {/* Card Info Utama */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5 backdrop-blur-md">
            <div className="flex justify-between items-start mb-4">
              <div>
                <p className="text-xs text-foreground/50 uppercase font-bold tracking-wider mb-1">Nomor Pesanan</p>
                <p className="font-bold text-foreground text-lg">{order.invoice_number}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-foreground/50 uppercase font-bold tracking-wider mb-1">Tanggal</p>
                <p className="font-semibold text-foreground/90 text-sm">{new Date(order.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
              </div>
            </div>
            <div className="pt-4 border-t border-white/10 flex justify-between items-center">
              <div>
                <p className="text-xs text-foreground/50 uppercase font-bold tracking-wider mb-1">Atas Nama</p>
                <p className="font-semibold text-foreground/90 flex items-center gap-2">
                  {order.customers?.name || 'Pelanggan'}
                </p>
              </div>
              <div className="text-right flex flex-col items-end">
                <p className="text-xs text-foreground/50 uppercase font-bold tracking-wider mb-1">Pembayaran</p>
                <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-1 rounded-full ${paymentStatus === 'LUNAS' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                  {paymentStatus}
                </span>
              </div>
            </div>
            {paymentStatus !== 'LUNAS' && order.payment_url && (
              <div className="pt-4 mt-4 border-t border-white/10">
                <a href={order.payment_url} target="_blank" rel="noopener noreferrer" className="w-full flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white py-3 rounded-xl font-bold transition-all shadow-lg shadow-red-500/20">
                  <CreditCard className="w-5 h-5" />
                  Bayar Sekarang via DOKU
                </a>
              </div>
            )}
            {paymentStatus !== 'LUNAS' && !order.payment_url && (
              <div className="pt-4 mt-4 border-t border-white/10">
                <p className="text-xs text-foreground/50 uppercase font-bold tracking-wider mb-3 text-center">Pilih Nominal Pembayaran</p>
                <div className="flex gap-2">
                  {amountPaid === 0 && (
                    <button 
                      onClick={async (e) => {
                        const btn = e.currentTarget;
                        btn.disabled = true;
                        btn.innerHTML = 'Memproses...';
                        try {
                          const res = await fetch('/api/doku/checkout', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ orderId: order.id, amount: totalAmount / 2 })
                          });
                          const data = await res.json();
                          if (data.success) window.location.href = data.payment_url;
                          else alert('Gagal memproses pembayaran: ' + data.error);
                        } catch(err) {
                          alert('Terjadi kesalahan sistem.');
                        }
                        btn.disabled = false;
                        btn.innerHTML = 'Bayar DP 50%';
                      }}
                      className="flex-1 flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 text-white py-3 rounded-xl font-bold transition-all text-xs"
                    >
                      Bayar DP 50%
                    </button>
                  )}
                  <button 
                    onClick={async (e) => {
                      const btn = e.currentTarget;
                      btn.disabled = true;
                      btn.innerHTML = 'Memproses...';
                      try {
                        const res = await fetch('/api/doku/checkout', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ orderId: order.id, amount: sisa })
                        });
                        const data = await res.json();
                        if (data.success) window.location.href = data.payment_url;
                        else alert('Gagal memproses pembayaran: ' + data.error);
                      } catch(err) {
                        alert('Terjadi kesalahan sistem.');
                      }
                      btn.disabled = false;
                      btn.innerHTML = 'Bayar Lunas';
                    }}
                    className="flex-1 flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white py-3 rounded-xl font-bold transition-all shadow-lg shadow-red-500/20 text-xs"
                  >
                    <CreditCard className="w-4 h-4" />
                    Bayar Lunas
                  </button>
                </div>
              </div>
            )}
          </div>

          <h2 className="font-bold text-foreground mt-8 mb-2">Status Produk ({items.length} Item)</h2>
          
          <div className="space-y-4">
            {items.map((item, idx) => {
              const targetQty = item.qty * (item.unit_multiplier || 1)
              const itemLogs = logs.filter(l => l.job_id === item.id)
              const completedQty = itemLogs.reduce((sum, l) => sum + Number(l.qty_processed || 0), 0)
              const itemStatus = (item.status || 'BARU MASUK').toUpperCase()
              const isPolos = item.order_type?.toUpperCase() === 'POLOS'
              
              const isExpanded = expandedItems.includes(item.id)

              // Tentukan Mini Status untuk saat dicollapse
              let miniStatusColor = 'text-primary'
              let miniStatusText = itemStatus
              if (['SIAP KIRIM', 'DIKIRIM', 'SUDAH DIAMBIL', 'SELESAI'].includes(itemStatus)) {
                 miniStatusColor = 'text-green-400'
              } else if (itemStatus === 'PROSES' && targetQty > 0) {
                 const pct = Math.min(100, Math.round((completedQty / targetQty) * 100))
                 miniStatusText = `PROSES (${pct}%)`
              }

              return (
                <div key={item.id} className="bg-white/5 border border-white/10 rounded-2xl p-5 backdrop-blur-md transition-all">
                  {/* Card Header (Clickable if items > 1) */}
                  <div 
                    className={`flex items-start justify-between ${items.length > 1 ? 'cursor-pointer group' : ''}`}
                    onClick={() => toggleExpand(item.id)}
                  >
                    <div className="flex-1 pr-4">
                      <p className="font-semibold text-sm text-foreground/90">{item.products?.name || `Item ${idx+1}`}</p>
                      <p className="text-xs text-foreground/50 mt-1">{targetQty.toLocaleString('id-ID')} Pcs {isPolos ? '(Polos)' : ''}</p>
                      
                      {/* Mini Status */}
                      {!isExpanded && (
                        <div className="mt-2 inline-flex">
                          <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-white/5 ${miniStatusColor}`}>
                            {miniStatusText}
                          </span>
                        </div>
                      )}
                    </div>
                    {items.length > 1 && (
                      <div className="shrink-0 flex items-center justify-center w-8 h-8 rounded-full bg-white/5 group-hover:bg-white/10 transition-colors">
                        <ChevronDown className={`w-4 h-4 text-white/50 transition-transform duration-300 ${isExpanded ? 'rotate-180' : 'animate-[bounce_2s_infinite]'}`} />
                      </div>
                    )}
                  </div>

                  {/* Expanded Pipeline */}
                  {isExpanded && (
                    <div className="mt-4 pt-5 border-t border-white/5 animate-in slide-in-from-top-4 duration-300 fade-in">
                      <div className="relative pl-5 space-y-6 before:absolute before:inset-0 before:ml-[1.55rem] before:h-full before:w-px before:bg-gradient-to-b before:from-primary before:via-white/10 before:to-white/10">
                        {STATUS_STEPS.map((step) => {
                          // Bypass SIAP PROSES dan PROSES untuk jenis POLOS
                          if (isPolos && (step.key === 'SIAP PROSES' || step.key === 'PROSES')) return null;

                          const state = getStepState(step.key, step.label, itemStatus)
                          const Icon = step.icon

                          let iconColor = 'text-white/20'
                          let bgColor = 'bg-[#1b1f27] border-white/10'
                          let glow = ''

                          if (state === 'passed') {
                            iconColor = 'text-primary'
                            bgColor = 'bg-primary/20 border-primary/50'
                          } else if (state === 'active') {
                            iconColor = 'text-white'
                            bgColor = 'bg-primary border-primary'
                            glow = 'shadow-[0_0_12px_rgba(168,85,247,0.5)]'
                          } else if (state === 'active-blinking') {
                            iconColor = 'text-yellow-400'
                            bgColor = 'bg-yellow-500/20 border-yellow-500'
                            glow = 'shadow-[0_0_12px_rgba(234,179,8,0.5)] animate-pulse'
                          }

                          return (
                            <div key={step.key} className="relative flex items-start group">
                              <div className={`relative z-10 flex items-center justify-center w-6 h-6 rounded-full border shrink-0 translate-y-0.5 transition-colors ${bgColor} ${glow}`}>
                                {state === 'passed' ? <Check className={`w-3 h-3 ${iconColor}`} /> : <Icon className={`w-3 h-3 ${iconColor}`} />}
                              </div>
                              <div className="ml-4">
                                <h4 className={`text-sm font-bold ${state === 'future' ? 'text-foreground/30' : state === 'active-blinking' ? 'text-yellow-400' : 'text-foreground'}`}>
                                  {step.label}
                                </h4>

                                {/* Menunggu Lunas Alert */}
                                {state === 'active-blinking' && step.label === 'Menunggu Lunas' && sisa > 0 && (
                                  <div className="mt-2 bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-2.5 flex items-start gap-2 text-yellow-500">
                                    <AlertCircle className="w-4 h-4 shrink-0 translate-y-0.5" />
                                    <div>
                                      <span className="text-xs font-semibold block">Menunggu Pelunasan</span>
                                      <span className="text-[10px] opacity-80 block mt-0.5">Sisa tagihan: Rp {sisa.toLocaleString('id-ID')}</span>
                                    </div>
                                  </div>
                                )}

                                {/* Production Logs details */}
                                {step.key === 'PROSES' && (state === 'active' || state === 'passed') && (
                                  <div className="mt-2 space-y-2">
                                    {itemLogs.filter(l => l.qty_processed > 0).map((log, lIdx) => (
                                      <div key={lIdx} className="flex flex-col gap-0.5 bg-black/20 rounded border border-white/5 px-2.5 py-1.5 w-fit">
                                        <div className="flex items-center gap-1.5">
                                          <CheckCircle2 className="w-3 h-3 text-green-400 shrink-0" />
                                          <span className="text-[10px] text-foreground/50">{new Date(log.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}</span>
                                        </div>
                                        <p className="text-xs pl-5">
                                          <span className="font-semibold text-white">Disablon {Number(log.qty_processed).toLocaleString('id-ID')} Pcs</span>
                                          <span className="text-foreground/60"> oleh {getEmployeeName(log.employee_id)}</span>
                                        </p>
                                      </div>
                                    ))}
                                    {state === 'active' && completedQty < targetQty && (
                                      <div className="mt-2">
                                        <div className="flex justify-between text-[10px] text-foreground/50 mb-1">
                                          <span>Progres Sablon</span>
                                          <span>{completedQty.toLocaleString('id-ID')} / {targetQty.toLocaleString('id-ID')} Pcs</span>
                                        </div>
                                        <div className="w-full bg-white/10 rounded-full h-1 overflow-hidden">
                                          <div className="bg-primary h-1 rounded-full" style={{ width: `${Math.min(100, Math.max(0, (completedQty/targetQty)*100))}%` }}></div>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

        </div>
      </div>
    </div>
  )
}
