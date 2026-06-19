'use client'

import { Package, Truck, CheckCircle2, Clock, Check, ChevronRight, AlertCircle, Phone, Printer } from 'lucide-react'

export default function TrackClient({ order, logs, settings }) {
  const storeName = settings?.store_name || 'KING SABLON'
  
  // Hitung overall status
  // Logika sederhana: 
  // Jika semua item DRAFT/BARU MASUK -> Menunggu
  // Jika ada yg PROSES -> Diproses
  // Jika semua SUDAH JADI -> Siap Diambil/Kirim
  // Jika semua SELESAI/DIKIRIM -> Selesai
  const items = order.sales_items || []
  let globalStatus = 1 // 1: Masuk, 2: Proses, 3: Siap, 4: Selesai

  const allDone = items.every(i => ['SELESAI', 'DIKIRIM', 'SUDAH DIAMBIL'].includes(i.status))
  const allReady = items.every(i => ['SUDAH JADI', 'SELESAI', 'DIKIRIM', 'SUDAH DIAMBIL'].includes(i.status))
  const anyProcess = items.some(i => ['PROSES', 'SUDAH JADI'].includes(i.status)) || logs.length > 0

  if (allDone) globalStatus = 4
  else if (allReady) globalStatus = 3
  else if (anyProcess) globalStatus = 2

  const steps = [
    { id: 1, label: 'Pesanan Masuk', icon: Clock, desc: 'Pesanan telah kami terima' },
    { id: 2, label: 'Sedang Diproses', icon: Package, desc: 'Tim sedang memproduksi' },
    { id: 3, label: 'Siap Diambil/Kirim', icon: CheckCircle2, desc: 'Barang sudah jadi' },
    { id: 4, label: 'Selesai', icon: Truck, desc: 'Pesanan selesai' },
  ]

  // Pembayaran
  const amountPaid = order.amount_paid || 0
  const totalAmount = order.grand_total || order.total_amount || 0
  const sisa = totalAmount - amountPaid

  return (
    <div className="min-h-screen bg-[#0f1115] text-white flex justify-center pb-20">
      <div className="w-full max-w-md bg-[#13161c] min-h-screen shadow-2xl relative flex flex-col">
        
        {/* Header */}
        <div className="p-6 bg-gradient-to-b from-primary/20 to-transparent flex flex-col items-center justify-center text-center">
          <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center mb-4 ring-4 ring-primary/10">
            <Printer className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-xl font-bold tracking-tight">{storeName}</h1>
          <p className="text-sm text-foreground/60 mt-1">Lacak Pesanan Anda</p>
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
            <div className="pt-4 border-t border-white/10">
              <p className="text-xs text-foreground/50 uppercase font-bold tracking-wider mb-1">Atas Nama</p>
              <p className="font-semibold text-foreground/90 flex items-center gap-2">
                {order.customers?.name || 'Pelanggan'}
              </p>
            </div>
          </div>

          {/* Stepper Status */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-md">
            <h2 className="font-bold mb-6 text-foreground">Status Pesanan</h2>
            <div className="space-y-6 relative before:absolute before:inset-0 before:ml-[1.125rem] before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-primary before:via-white/10 before:to-white/10">
              {steps.map((step, idx) => {
                const isActive = globalStatus === step.id
                const isPassed = globalStatus > step.id
                const Icon = step.icon

                return (
                  <div key={step.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                    <div className={`flex items-center justify-center w-9 h-9 rounded-full border-4 border-[#13161c] bg-[#13161c] text-white shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10 transition-colors ${isActive ? 'bg-primary border-primary/20 text-white' : isPassed ? 'bg-primary border-primary text-white' : 'bg-white/10 border-white/5 text-foreground/40'}`}>
                      {isPassed ? <Check className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
                    </div>
                    <div className="w-[calc(100%-3rem)] md:w-[calc(50%-2.5rem)] ml-4 md:ml-0">
                      <div className={`p-4 rounded-xl border ${isActive ? 'border-primary/50 bg-primary/10 shadow-[0_0_15px_rgba(168,85,247,0.15)]' : 'border-white/5 bg-white/5'}`}>
                        <h3 className={`font-bold text-sm ${isActive || isPassed ? 'text-foreground' : 'text-foreground/40'}`}>{step.label}</h3>
                        {isActive && <p className="text-xs text-foreground/70 mt-1">{step.desc}</p>}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Item Progress */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5 backdrop-blur-md">
             <h2 className="font-bold mb-4 text-foreground">Detail Produk</h2>
             <div className="space-y-4">
                {items.map((item, idx) => {
                  const targetQty = item.qty * (item.unit_multiplier || 1)
                  
                  // Hitung dari log
                  const itemLogs = logs.filter(l => l.product_code === item.product_code)
                  const completedQty = itemLogs.filter(l => l.type === 'SELESAI').reduce((sum, l) => sum + Number(l.qty || 0), 0)
                  
                  let progressPercent = 0
                  if (item.status === 'DRAFT' || item.status === 'BARU MASUK') progressPercent = 0
                  else if (item.status === 'SUDAH JADI' || item.status === 'SELESAI' || item.status === 'DIKIRIM' || item.status === 'SUDAH DIAMBIL') progressPercent = 100
                  else {
                    progressPercent = Math.min(100, Math.round((completedQty / targetQty) * 100))
                    if (progressPercent === 0 && item.status === 'PROSES') progressPercent = 10 // Baru mulai
                  }

                  return (
                    <div key={idx} className="border-b border-white/5 pb-4 last:border-0 last:pb-0">
                      <div className="flex justify-between mb-2">
                        <span className="font-semibold text-sm text-foreground/90">{item.product_name}</span>
                        <span className="text-sm font-bold">{targetQty.toLocaleString('id-ID')} Pcs</span>
                      </div>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-[10px] uppercase font-bold tracking-wider text-primary">{item.status}</span>
                        <span className="text-[10px] text-foreground/50">{progressPercent}%</span>
                      </div>
                      <div className="w-full bg-white/10 rounded-full h-1.5 mb-1 overflow-hidden">
                        <div className="bg-primary h-1.5 rounded-full transition-all duration-1000 ease-out" style={{ width: `${progressPercent}%` }}></div>
                      </div>
                      {progressPercent > 0 && progressPercent < 100 && (
                        <p className="text-[10px] text-foreground/50 text-right mt-1">{completedQty.toLocaleString('id-ID')} / {targetQty.toLocaleString('id-ID')} Pcs selesai disablon</p>
                      )}
                    </div>
                  )
                })}
             </div>
          </div>

          {/* Tagihan */}
          <div className={`border rounded-2xl p-5 backdrop-blur-md ${sisa > 0 ? 'bg-yellow-500/10 border-yellow-500/20' : 'bg-green-500/10 border-green-500/20'}`}>
            <h2 className={`font-bold mb-4 flex items-center gap-2 ${sisa > 0 ? 'text-yellow-400' : 'text-green-400'}`}>
              <AlertCircle className="w-4 h-4" />
              Info Pembayaran
            </h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-foreground/70">
                <span>Total Tagihan</span>
                <span>Rp {totalAmount.toLocaleString('id-ID')}</span>
              </div>
              <div className="flex justify-between text-foreground/70">
                <span>Sudah Dibayar (DP)</span>
                <span>Rp {amountPaid.toLocaleString('id-ID')}</span>
              </div>
              <div className="pt-2 mt-2 border-t border-white/10 flex justify-between font-bold text-lg">
                <span className="text-foreground">Sisa Kekurangan</span>
                <span className={sisa > 0 ? 'text-yellow-400' : 'text-green-400'}>Rp {sisa.toLocaleString('id-ID')}</span>
              </div>
            </div>
            {sisa > 0 && (
              <p className="text-xs text-yellow-400/70 mt-3 text-center">Silakan siapkan pelunasan sebelum pesanan diambil atau dikirim.</p>
            )}
            {sisa <= 0 && (
              <p className="text-xs text-green-400/70 mt-3 text-center">Terima kasih, tagihan Anda sudah LUNAS.</p>
            )}
          </div>

        </div>

        <div className="mt-8 pb-8 text-center">
          <p className="text-xs text-foreground/30">Powered by King Sablon ERP</p>
        </div>

      </div>
    </div>
  )
}
