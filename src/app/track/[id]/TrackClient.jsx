'use client'

import React, { useState } from 'react'
import { Package, Truck, CheckCircle2, Clock, Check, ChevronDown, AlertCircle, Printer, Settings, PackageOpen, CreditCard, XCircle, Download, MapPin, Phone, Mail, Navigation } from 'lucide-react'

const STATUS_STEPS = [
  { key: 'BARU MASUK', label: 'Baru Masuk', icon: PackageOpen },
  { key: 'SIAP PROSES', label: 'Siap Proses', icon: Clock },
  { key: 'PROSES', label: 'Diproses', icon: Settings },
  { key: 'SIAP KIRIM', label: 'Menunggu Lunas', icon: CreditCard }, 
  { key: 'SIAP KIRIM_ACTUAL', label: 'Siap Kirim', icon: PackageOpen }, 
  { key: 'DIKIRIM', label: 'Dikirim', icon: Truck }, 
  { key: 'SELESAI', label: 'Selesai', icon: CheckCircle2 }
]

export default function TrackClient({ order, logs, settings, storeConfig, employees }) {
  const storeName = settings?.store_name || 'KING SABLON'
  
  const paymentStatus = order.payment_status || 'BELUM LUNAS'
  const items = order.sales_items || []
  
  const amountPaid = order.dp_amount || 0
  const totalAmount = order.total_amount || 0
  const sisa = totalAmount - amountPaid

  const [activeTab, setActiveTab] = useState('tracking') // 'tracking' or 'invoice'
  const [expandedItems, setExpandedItems] = useState(items.length === 1 ? [items[0].id] : [])
  const [isQrisOpen, setIsQrisOpen] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)

  const [scale, setScale] = useState(1)
  const [invoiceHeight, setInvoiceHeight] = useState(0)
  const containerRef = React.useRef(null)
  const invoiceRef = React.useRef(null)

  React.useEffect(() => {
    if (activeTab !== 'invoice') return;
    const handleResize = () => {
      if (containerRef.current && invoiceRef.current) {
        const parentWidth = containerRef.current.parentElement.getBoundingClientRect().width;
        // Padding/Margin horizontal spacing is about 32px
        const targetWidth = parentWidth - 32;
        const newScale = (targetWidth / 794) * 0.90; // Scale relative to 794px width, shrunk 10% more for spacing
        setScale(Math.min(1, newScale));
        setInvoiceHeight(invoiceRef.current.scrollHeight);
      }
    };
    
    // Run after a short delay to ensure rendering is complete
    const timer = setTimeout(handleResize, 100);
    
    window.addEventListener('resize', handleResize);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', handleResize);
    };
  }, [activeTab]);

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

  const handlePrint = () => {
    window.print()
  }

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text)
    alert('Disalin: ' + text)
  }

  const handleDokuPayment = async (amount) => {
    setIsProcessing(true)
    try {
      const res = await fetch('/api/doku/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: order.id, amount })
      });
      const data = await res.json();
      if (data.success) {
        window.location.href = data.payment_url;
      } else {
        alert('Gagal memproses pembayaran: ' + data.error);
        setIsProcessing(false)
      }
    } catch(err) {
      alert('Terjadi kesalahan sistem.');
      setIsProcessing(false)
    }
  }

  const store = storeConfig || {
    store_name: 'KING SABLON',
    slogan: 'Pusat Sablon Cup Plastik Terbaik',
    address: 'Jl. Industri Raya No. 45, Jakarta Pusat',
    phone: '0812-3456-7890',
    email: 'billing@kingsablon.com',
    logo_url: '/logo.png',
    banks: [
      { bank_name: 'Bank BCA', account_number: '123-456-7890', account_name: 'PT KING SABLON NUSANTARA' },
      { bank_name: 'Bank Mandiri', account_number: '098-765-4321', account_name: 'PT KING SABLON NUSANTARA' }
    ]
  }

  const invoiceId = order.invoice_number
  const dateStr = new Date(order.date).toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' })

  return (
    <>
      {isQrisOpen && (
        <div className="fixed inset-0 z-[1200] bg-black/90 flex flex-col items-center justify-center p-4 backdrop-blur-sm animate-in fade-in" onClick={event => event.target === event.currentTarget && setIsQrisOpen(false)}>
          <img src="/qris.png" alt="QRIS Full" className="max-w-full max-h-[60vh] object-contain rounded-xl bg-white p-2" />
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <a href="/qris.png" download="QRIS-KingSablon.png" className="bg-primary text-primary-foreground hover:bg-primary/90 px-6 py-3 rounded-full font-bold flex items-center gap-2 shadow-lg shadow-primary/20" onClick={e => e.stopPropagation()}>
              <Download className="w-5 h-5" /> Simpan QRIS
            </a>
            <button className="bg-white/10 text-white hover:bg-white/20 px-6 py-3 rounded-full font-bold" onClick={() => setIsQrisOpen(false)}>
              Tutup
            </button>
          </div>
        </div>
      )}

      {/* Print styles */}
      <style dangerouslySetInnerHTML={{
        __html: `
        @media screen and (max-width: 767px) {
          .invoice-scaled-wrapper {
            height: auto !important;
            overflow: visible !important;
          }
          .invoice-scaled-element {
            position: static !important;
            transform: none !important;
            width: 100% !important;
          }
        }

        @media print {
          @page { size: A4 portrait; margin: 10mm; }
          .no-print, aside, nav, header { display: none !important; }
          main { margin: 0 !important; padding: 0 !important; max-width: none !important; width: 100% !important; flex: none !important; }
          body, html { background-color: white !important; margin: 0 !important; padding: 0 !important; width: 100% !important; }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          .glass-card { border: none !important; box-shadow: none !important; background: white !important; color: black !important; min-height: auto !important; overflow: visible !important; padding: 1.5rem !important; }
          .text-foreground { color: black !important; }
          .text-foreground\\/60 { color: #4a5568 !important; }
          .border-white\\/10 { border-color: #e2e8f0 !important; }
          .bg-white\\/5 { background-color: transparent !important; }

          /* Reset scaled views during print */
          .invoice-scaled-wrapper {
            height: auto !important;
            overflow: visible !important;
          }
          .invoice-scaled-element {
            transform: none !important;
            width: 100% !important;
          }
        }
      `}} />

      <div className="min-h-screen bg-transparent text-white flex justify-center pb-20 print:pb-0 overflow-x-hidden">
        <div className="w-full max-w-md bg-black/40 backdrop-blur-3xl min-h-screen shadow-2xl relative flex flex-col border-x border-white/10 print:border-none print:bg-white print:max-w-none print:shadow-none print:min-h-0 overflow-x-hidden">
          
          {/* Header */}
          <div className="p-5 sm:p-8 bg-gradient-to-b from-primary/10 to-transparent flex flex-col items-center justify-center text-center no-print">
            <div className="w-24 h-24 sm:w-32 sm:h-32 mb-2 flex items-center justify-center">
              <img 
                src="/logo.png" 
                alt="Logo" 
                className="max-w-full max-h-full object-contain filter drop-shadow-[0_0_15px_rgba(212,175,55,0.4)]" 
              />
            </div>
            <h1 className="text-lg font-bold tracking-tight sr-only">{storeName}</h1>
            <p className="text-sm text-foreground/70 font-medium">Lacak Pesanan Anda</p>
          </div>

          {/* Navigation Tabs */}
          <div className="flex border-b border-white/10 px-4 sm:px-6 mb-5 sm:mb-6 no-print">
            <button 
              onClick={() => setActiveTab('tracking')}
              className={`flex-1 pb-3 text-sm font-bold border-b-2 transition-all ${activeTab === 'tracking' ? 'border-primary text-primary' : 'border-transparent text-foreground/50 hover:text-foreground/80'}`}
            >
              Lacak Pesanan
            </button>
            <button 
              onClick={() => setActiveTab('invoice')}
              className={`flex-1 pb-3 text-sm font-bold border-b-2 transition-all ${activeTab === 'invoice' ? 'border-primary text-primary' : 'border-transparent text-foreground/50 hover:text-foreground/80'}`}
            >
              Invoice & Pembayaran
            </button>
          </div>

          {activeTab === 'tracking' ? (
            <div className="px-4 sm:px-6 -mt-3 sm:-mt-4 relative z-10 space-y-4 no-print">
              
              {/* Card Info Utama */}
              <div className="bg-white/5 border border-white/10 rounded-2xl p-4 sm:p-5 backdrop-blur-md">
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
                {/* Removed DOKU payment section from tracking view */}
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
                    <div key={item.id} className="bg-white/5 border border-white/10 rounded-2xl p-4 sm:p-5 backdrop-blur-md transition-all">
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
                          {itemStatus === 'BATAL' ? (
                            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-red-400 flex items-center gap-3">
                              <XCircle className="w-5 h-5 shrink-0" />
                              <div>
                                <p className="font-bold text-sm">Pesanan Dibatalkan</p>
                                <p className="text-xs opacity-80">Item ini telah dibatalkan dari sistem operasional.</p>
                              </div>
                            </div>
                          ) : (
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
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

            </div>
          ) : (
            /* Tab Invoice View */
            <div className="space-y-4 px-3 sm:px-6">
              
              <div className="flex justify-end mb-4 no-print">
                <button onClick={handlePrint} className="bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-colors shadow-lg shadow-primary/20 w-full sm:w-auto">
                  <Printer className="w-4 h-4" /> Unduh PDF
                </button>
              </div>

              {/* SCALED CONTAINER FOR SMARTPHONE HIGH FIDELITY PREVIEW */}
              <div 
                ref={containerRef} 
                className="invoice-scaled-wrapper overflow-hidden w-full relative no-print" 
                style={{ height: `${invoiceHeight * scale}px` }}
              >
                <div 
                  ref={invoiceRef}
                  className="invoice-scaled-element absolute left-1/2 transition-transform duration-300"
                  style={{ 
                    transform: `translateX(-50%) scale(${scale})`, 
                    transformOrigin: 'top center',
                    width: '794px' // A4 proportional desktop width
                  }}
                >
                  
                  {/* KERTAS INVOICE */}
                  <div className="glass-card bg-white text-black p-4 sm:p-8 relative overflow-hidden rounded-2xl sm:rounded-3xl shadow-2xl" style={{ background: '#ffffff', color: '#1a202c', minHeight: 'auto' }}>

                    {/* Dekorasi Pojok */}
                    <div className="absolute -top-24 -right-24 w-64 h-64 bg-primary/10 rounded-full blur-3xl no-print" />

                    <div className="flex flex-col md:flex-row justify-between items-start gap-6 md:gap-8 border-b border-gray-200 pb-6 md:pb-8">
                      <div>
                        <div className="mb-2">
                          <img src={store.logo_url || '/logo.png'} alt="Logo" className="h-16 w-auto object-contain bg-transparent" />
                        </div>
                        <p className="text-xs sm:text-sm text-gray-500 font-medium tracking-widest uppercase mt-4">{store.slogan}</p>

                        <div className="mt-4 space-y-1 text-xs text-gray-600">
                          <p className="flex items-center gap-2"><MapPin className="w-3 h-3 shrink-0" /> {store.address}</p>
                          <p className="flex items-center gap-2"><Phone className="w-3 h-3 shrink-0" /> {store.phone}</p>
                          <p className="flex items-center gap-2"><Mail className="w-3 h-3 shrink-0" /> {store.email}</p>
                        </div>
                      </div>

                      <div className="text-left md:text-right w-full md:w-auto mt-4 md:mt-0">
                        <h2 className="text-3xl md:text-4xl font-black text-gray-200 uppercase tracking-widest">INVOICE</h2>
                        <div className="mt-2 md:mt-4 space-y-1 text-sm">
                          <p className="text-gray-500">Nomor Faktur</p>
                          <p className="font-bold text-gray-900">{order.invoice_number}</p>
                        </div>
                        <div className="mt-2 space-y-1 text-sm">
                          <p className="text-gray-500">Tanggal</p>
                          <p className="font-bold text-gray-900">{dateStr}</p>
                        </div>
                      </div>
                    </div>

                    <div className="mt-6 sm:mt-8 mb-6 sm:mb-8 flex flex-col md:flex-row justify-between items-start gap-5 md:gap-8">
                      <div>
                        <p className="text-xs text-gray-500 uppercase font-bold tracking-widest mb-2">Ditagihkan Kepada:</p>
                        <h3 className="text-lg font-bold text-gray-900">{order.customers?.name || 'Customer'}</h3>
                        <p className="text-sm text-gray-600 mt-1 max-w-xs leading-relaxed">
                          {order.customers?.address || 'Alamat tidak tersedia'}{order.customers?.city ? `, ${order.customers.city}` : ''}
                        </p>
                        <p className="text-sm text-gray-600 mt-1">Telp: {order.customers?.phone || '-'}</p>
                      </div>
                      <div className="text-left md:text-right">
                        <p className="text-xs text-gray-500 uppercase font-bold tracking-widest mb-2">Status Pembayaran:</p>
                        <div className={`inline-block px-4 py-1.5 rounded-full font-bold text-sm border ${order.payment_status === 'LUNAS' ? 'bg-green-100 text-green-700 border-green-200' : 'bg-yellow-100 text-yellow-700 border-yellow-200'}`}>
                          {order.payment_status === 'LUNAS' ? 'LUNAS' : `BELUM LUNAS (${order.payment_status})`}
                        </div>
                      </div>
                    </div>

                    <div className="mt-6 sm:mt-8">
                      {/* Mobile item cards */}
                      <div className="md:hidden space-y-3">
                        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest border-b border-gray-900 pb-2 mb-3">Detail Pesanan</h3>
                        {items.map((item, idx) => (
                          <div key={idx} className="flex justify-between items-start gap-3 pb-3 border-b border-gray-100 last:border-0">
                            <div className="min-w-0">
                              <p className="font-bold text-gray-900 text-sm leading-tight break-words">{item.products?.name || item.product_code}</p>
                              <p className="text-xs text-gray-500 mt-1">{item.order_type} · {(item.qty * (item.unit_multiplier || 1)).toLocaleString('id-ID')} Pcs</p>
                              <p className="text-xs text-gray-400 mt-1">Rp {Number(item.unit_price).toLocaleString('id-ID')} / Pcs</p>
                            </div>
                            <p className="font-bold text-gray-900 text-sm text-right shrink-0">Rp {Number(item.total_price).toLocaleString('id-ID')}</p>
                          </div>
                        ))}
                      </div>

                      {/* Desktop table */}
                      <div className="hidden md:block overflow-x-auto">
                        <table className="w-full text-left border-collapse min-w-[500px]">
                          <thead>
                            <tr className="border-b-2 border-gray-900">
                              <th className="py-3 font-bold text-gray-900 text-sm">Deskripsi Pesanan</th>
                              <th className="py-3 font-bold text-gray-900 text-sm text-center">Qty</th>
                              <th className="py-3 font-bold text-gray-900 text-sm text-center">Satuan</th>
                              <th className="py-3 font-bold text-gray-900 text-sm text-right">Harga (Rp)</th>
                              <th className="py-3 font-bold text-gray-900 text-sm text-right">Subtotal (Rp)</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {items.map((item, idx) => (
                              <tr key={idx}>
                                <td className="py-4">
                                  <p className="font-bold text-gray-900">{item.products?.name || item.product_code}</p>
                                  <p className="text-xs text-gray-500 mt-1">Order: {item.order_type}</p>
                                </td>
                                <td className="py-4 text-center font-medium text-gray-900">{(item.qty * (item.unit_multiplier || 1)).toLocaleString('id-ID')}</td>
                                <td className="py-4 text-center text-gray-600">Pcs</td>
                                <td className="py-4 text-right text-gray-600">{Number(item.unit_price).toLocaleString('id-ID')}</td>
                                <td className="py-4 text-right font-bold text-gray-900">{Number(item.total_price).toLocaleString('id-ID')}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    <div className="mt-8 flex flex-col md:flex-row justify-between items-start gap-8 md:gap-4">
                      <div className="w-full md:w-1/2 p-5 bg-gray-50 rounded-xl border border-gray-200">
                        <h4 className="font-bold text-gray-900 mb-4 text-sm uppercase tracking-wider">Metode Pembayaran</h4>
                        
                        {order.payment_status !== 'LUNAS' && (
                          <div className="mb-6 pb-6 border-b border-gray-200 space-y-4">
                            <p className="text-xs text-gray-500 font-bold uppercase tracking-widest">Pembayaran Digital Instan (QRIS):</p>
                            
                            <div 
                              className="bg-white p-3 rounded-xl border border-gray-200 text-center shadow-sm cursor-pointer hover:border-primary/50 transition-all group"
                              onClick={() => setIsQrisOpen(true)}
                            >
                              <p className="text-xs font-bold text-gray-900 mb-2 group-hover:text-primary transition-colors">Scan QRIS untuk Membayar</p>
                              
                              <div className="w-32 h-32 mx-auto relative overflow-hidden rounded-xl border border-gray-100 bg-gray-50 shadow-inner">
                                <img src="/qris.png" alt="QRIS BCA" className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[140%] max-w-none mix-blend-multiply" />
                              </div>

                              <p className="text-[10px] text-gray-500 mt-2 font-semibold flex flex-col items-center gap-1.5">
                                <span>BCA Digital / Semua E-Wallet</span>
                                <span className="text-[9px] bg-primary/10 text-primary px-2.5 py-0.5 rounded-full">Klik untuk Perbesar & Unduh</span>
                              </p>
                            </div>
                          </div>
                        )}

                        <div className="space-y-4">
                          <p className="text-xs text-gray-500 font-bold mb-1">Atau Transfer Manual Rekening:</p>
                          {(store.banks || []).map((bank, idx) => (
                            <div key={idx} className="flex items-center justify-between bg-white p-3 rounded-lg border border-gray-100 shadow-sm">
                              <div>
                                <p className="text-xs text-blue-600 font-bold">{bank.bank_name}</p>
                                <p className="font-bold text-gray-900 text-lg tracking-widest my-0.5">{bank.account_number}</p>
                                <p className="text-xs text-gray-500">A/N: {bank.account_name}</p>
                              </div>
                              <button 
                                onClick={() => copyToClipboard(bank.account_number)}
                                className="text-xs font-bold bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-md transition-colors"
                              >
                                Salin
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="w-full md:w-1/3 space-y-3">
                        <div className="flex justify-between items-center pt-2 border-b border-gray-200 pb-3">
                          <span className="font-bold text-gray-900 text-lg">Total Tagihan</span>
                          <span className="font-black text-gray-900 text-xl">Rp {Number(order.total_amount).toLocaleString('id-ID')}</span>
                        </div>

                        <div className="mt-4 pt-4 border-t-2 border-dashed border-gray-300 space-y-2">
                          <div className="flex justify-between items-center text-sm text-green-700 font-medium">
                            <span>Telah Dibayar (DP)</span>
                            <span>- Rp {Number(order.dp_amount || 0).toLocaleString('id-ID')}</span>
                          </div>
                          {sisa > 0 ? (
                            <div className="flex justify-between items-center p-3 bg-red-50 rounded-lg text-red-700 font-bold">
                              <span>Sisa Pembayaran</span>
                              <span className="text-lg">Rp {sisa.toLocaleString('id-ID')}</span>
                            </div>
                          ) : (
                            <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg text-green-700 font-bold">
                              <span>Sisa Pembayaran</span>
                              <span className="text-lg">Rp 0 (LUNAS)</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="mt-8 md:mt-12 text-center border-t border-gray-200 pt-6">
                      <p className="text-gray-500 text-sm">Terima kasih atas kepercayaan Anda kepada {store.store_name}.</p>
                      <p className="text-gray-400 text-xs mt-1">Invoice digital ini diterbitkan secara otomatis dan sah.</p>
                    </div>

                  </div>

                </div>
              </div>

              {/* NATIVE FULL-SIZE INVOICE ONLY FOR PRINTING (Hidden on Screen) */}
              <div className="hidden print:block print:w-full">
                {/* KERTAS INVOICE */}
                <div className="glass-card bg-white text-black p-12 relative overflow-visible border-none rounded-none shadow-none" style={{ background: '#ffffff', color: '#1a202c', minHeight: 'auto' }}>
                  <div className="flex flex-row justify-between items-start gap-8 border-b border-gray-200 pb-8">
                    <div>
                      <div className="mb-2">
                        <img src={store.logo_url || '/logo.png'} alt="Logo" className="h-20 w-auto object-contain bg-transparent" />
                      </div>
                      <p className="text-sm text-gray-500 font-medium tracking-widest uppercase mt-4">{store.slogan}</p>

                      <div className="mt-4 space-y-1 text-xs text-gray-600">
                        <p className="flex items-center gap-2"><MapPin className="w-3 h-3 shrink-0" /> {store.address}</p>
                        <p className="flex items-center gap-2"><Phone className="w-3 h-3 shrink-0" /> {store.phone}</p>
                        <p className="flex items-center gap-2"><Mail className="w-3 h-3 shrink-0" /> {store.email}</p>
                      </div>
                    </div>

                    <div className="text-right">
                      <h2 className="text-4xl font-black text-gray-200 uppercase tracking-widest">INVOICE</h2>
                      <div className="mt-4 space-y-1 text-sm">
                        <p className="text-gray-500">Nomor Faktur</p>
                        <p className="font-bold text-gray-900">{order.invoice_number}</p>
                      </div>
                      <div className="mt-2 space-y-1 text-sm">
                        <p className="text-gray-500">Tanggal</p>
                        <p className="font-bold text-gray-900">{dateStr}</p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-8 mb-8 flex flex-row justify-between items-start gap-8">
                    <div>
                      <p className="text-xs text-gray-500 uppercase font-bold tracking-widest mb-2">Ditagihkan Kepada:</p>
                      <h3 className="text-lg font-bold text-gray-900">{order.customers?.name || 'Customer'}</h3>
                      <p className="text-sm text-gray-600 mt-1 max-w-xs leading-relaxed">
                        {order.customers?.address || 'Alamat tidak tersedia'}{order.customers?.city ? `, ${order.customers.city}` : ''}
                      </p>
                      <p className="text-sm text-gray-600 mt-1">Telp: {order.customers?.phone || '-'}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-500 uppercase font-bold tracking-widest mb-2">Status Pembayaran:</p>
                      <div className={`inline-block px-4 py-1.5 rounded-full font-bold text-sm border ${order.payment_status === 'LUNAS' ? 'bg-green-100 text-green-700 border-green-200' : 'bg-yellow-100 text-yellow-700 border-yellow-200'}`}>
                        {order.payment_status === 'LUNAS' ? 'LUNAS' : `BELUM LUNAS (${order.payment_status})`}
                      </div>
                    </div>
                  </div>

                  <div className="mt-8">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse min-w-[500px]">
                        <thead>
                          <tr className="border-b-2 border-gray-900">
                            <th className="py-3 font-bold text-gray-900 text-sm">Deskripsi Pesanan</th>
                            <th className="py-3 font-bold text-gray-900 text-sm text-center">Qty</th>
                            <th className="py-3 font-bold text-gray-900 text-sm text-center">Satuan</th>
                            <th className="py-3 font-bold text-gray-900 text-sm text-right">Harga (Rp)</th>
                            <th className="py-3 font-bold text-gray-900 text-sm text-right">Subtotal (Rp)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {items.map((item, idx) => (
                            <tr key={idx}>
                              <td className="py-4">
                                <p className="font-bold text-gray-900">{item.products?.name || item.product_code}</p>
                                <p className="text-xs text-gray-500 mt-1">Order: {item.order_type}</p>
                              </td>
                              <td className="py-4 text-center font-medium text-gray-900">{(item.qty * (item.unit_multiplier || 1)).toLocaleString('id-ID')}</td>
                              <td className="py-4 text-center text-gray-600">Pcs</td>
                              <td className="py-4 text-right text-gray-600">{Number(item.unit_price).toLocaleString('id-ID')}</td>
                              <td className="py-4 text-right font-bold text-gray-900">{Number(item.total_price).toLocaleString('id-ID')}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="mt-8 flex flex-row justify-between items-start gap-4">
                    <div className="w-1/2 p-5 bg-gray-50 rounded-xl border border-gray-200">
                      <h4 className="font-bold text-gray-900 mb-4 text-sm uppercase tracking-wider">Metode Pembayaran</h4>
                      <div className="space-y-4">
                        <p className="text-xs text-gray-500 font-bold mb-1">Transfer Manual Rekening:</p>
                        {(store.banks || []).map((bank, idx) => (
                          <div key={idx} className="flex items-center justify-between bg-white p-3 rounded-lg border border-gray-100 shadow-sm">
                            <div>
                              <p className="text-xs text-blue-600 font-bold">{bank.bank_name}</p>
                              <p className="font-bold text-gray-900 text-lg tracking-widest my-0.5">{bank.account_number}</p>
                              <p className="text-xs text-gray-500">A/N: {bank.account_name}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="w-1/2 space-y-3">
                      <div className="flex justify-between items-center pt-2 border-b border-gray-200 pb-3">
                        <span className="font-bold text-gray-900 text-lg">Total Tagihan</span>
                        <span className="font-black text-gray-900 text-xl">Rp {Number(order.total_amount).toLocaleString('id-ID')}</span>
                      </div>

                      <div className="mt-4 pt-4 border-t-2 border-dashed border-gray-300 space-y-2">
                        <div className="flex justify-between items-center text-sm text-green-700 font-medium">
                          <span>Telah Dibayar (DP)</span>
                          <span>- Rp {Number(order.dp_amount || 0).toLocaleString('id-ID')}</span>
                        </div>
                        {sisa > 0 ? (
                          <div className="flex justify-between items-center p-3 bg-red-50 rounded-lg text-red-700 font-bold">
                            <span>Sisa Pembayaran</span>
                            <span className="text-lg">Rp {sisa.toLocaleString('id-ID')}</span>
                          </div>
                        ) : (
                          <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg text-green-700 font-bold">
                            <span>Sisa Pembayaran</span>
                            <span className="text-lg">Rp 0 (LUNAS)</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="mt-12 text-center border-t border-gray-200 pt-6">
                    <p className="text-gray-500 text-sm">Terima kasih atas kepercayaan Anda kepada {store.store_name}.</p>
                    <p className="text-gray-400 text-xs mt-1">Invoice digital ini diterbitkan secara otomatis dan sah.</p>
                  </div>
                </div>
              </div>

            </div>
          )}

        </div>
      </div>
    </>
  )
}
