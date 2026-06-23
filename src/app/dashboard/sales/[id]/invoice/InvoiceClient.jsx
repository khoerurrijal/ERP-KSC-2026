'use client'

import { useRouter } from 'next/navigation'
import { Printer, ArrowLeft, Download, Crown, MapPin, Phone, Mail, CreditCard } from 'lucide-react'
import { useState, useMemo } from 'react'

export default function InvoiceClient({ order, storeConfig }) {
  const router = useRouter()
  const [isProcessing, setIsProcessing] = useState(false)
  const [isQrisOpen, setIsQrisOpen] = useState(false)

  if (!order) {
    return (
      <div className="p-8 text-center text-foreground/60">
        Data Invoice tidak ditemukan.
      </div>
    )
  }

  const invoiceId = order.invoice_number
  const dateStr = new Date(order.date).toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' })
  const sisaBayar = Number(order.total_amount) - Number(order.dp_amount || 0)



  const handlePrint = () => {
    window.print()
  }

  const handleDokuPayment = async (amount) => {
    setIsProcessing(true)
    try {
      const response = await fetch('/api/doku/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          orderId: order.id, 
          amount: amount
        }),
      })
      const data = await response.json()
      if (data.success && data.payment_url) {
        window.location.href = data.payment_url
      } else {
        alert('Gagal membuat pembayaran: ' + (data.error || 'Terjadi kesalahan'))
      }
    } catch (error) {
      alert('Terjadi kesalahan')
    } finally {
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
    wa_message_template: 'Halo berikut adalah invoice {invoice_number}',
    banks: [
      { bank_name: 'Bank BCA', account_number: '123-456-7890', account_name: 'PT KING SABLON NUSANTARA' },
      { bank_name: 'Bank Mandiri', account_number: '098-765-4321', account_name: 'PT KING SABLON NUSANTARA' }
    ]
  }

  const waTemplate = store.wa_message_template || 'Halo berikut adalah invoice {invoice_number}';
  const waText = waTemplate
    .replace(/{invoice_number}/g, invoiceId)
    .replace(/{customer_name}/g, order.customers?.name || 'Customer')
    .replace(/{total_amount}/g, Number(order.total_amount).toLocaleString('id-ID'))
    .replace(/{sisa_bayar}/g, sisaBayar.toLocaleString('id-ID'))
  const waUrl = `https://wa.me/?text=${encodeURIComponent(waText)}`

  return (
    <>
      {isQrisOpen && (
        <div className="fixed inset-0 z-[100] bg-black/90 flex flex-col items-center justify-center p-4 backdrop-blur-sm animate-in fade-in" onClick={() => setIsQrisOpen(false)}>
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

      <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in zoom-in-95 duration-500 pb-20 print:pb-0 print:space-y-0 print:w-full print:max-w-none print:m-0">

      {/* Tombol Aksi - Disembunyikan saat di-print */}
      <style dangerouslySetInnerHTML={{
        __html: `
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
        }
      `}} />

      <div className="flex flex-col sm:flex-row items-center justify-between mb-8 no-print gap-4 px-4 sm:px-0">
        <button onClick={() => router.back()} className="flex items-center gap-2 text-foreground/60 hover:text-primary transition-colors text-sm font-bold">
          <ArrowLeft className="w-4 h-4" /> Kembali
        </button>
        <div className="flex flex-wrap items-center gap-3">
          <a href={waUrl} target="_blank" rel="noopener noreferrer" className="bg-green-500/10 text-green-500 border border-green-500/20 hover:bg-green-500/20 h-10 px-4 rounded-xl text-sm font-bold flex items-center gap-2 transition-colors">
            <Phone className="w-4 h-4" /> Share WA
          </a>
          <button onClick={handlePrint} className="bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 rounded-xl text-sm font-bold flex items-center gap-2 transition-colors shadow-lg shadow-primary/20">
            <Printer className="w-4 h-4" /> Cetak Invoice
          </button>
        </div>
      </div>

      {/* KERTAS INVOICE */}
      <div className="glass-card bg-white text-black p-5 sm:p-8 md:p-12 relative overflow-hidden print:overflow-visible print:m-0 print:border-none rounded-3xl shadow-2xl mx-4 sm:mx-0" style={{ background: '#ffffff', color: '#1a202c', minHeight: 'auto' }}>

        {/* Dekorasi Pojok */}
        <div className="absolute -top-24 -right-24 w-64 h-64 bg-primary/10 rounded-full blur-3xl no-print" />

        <div className="flex flex-col md:flex-row justify-between items-start gap-6 md:gap-8 border-b border-gray-200 pb-6 md:pb-8 print:flex-row">
          <div>
            <div className="mb-2">
              <img src={store.logo_url || '/logo.png'} alt="Logo" className="h-12 sm:h-16 md:h-20 w-auto object-contain bg-transparent" />
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
              <p className="font-bold text-gray-900">{invoiceId}</p>
            </div>
            <div className="mt-2 space-y-1 text-sm">
              <p className="text-gray-500">Tanggal</p>
              <p className="font-bold text-gray-900">{dateStr}</p>
            </div>
          </div>
        </div>

        <div className="mt-8 mb-8 flex flex-col md:flex-row justify-between items-start gap-8 print:flex-row">
          <div>
            <p className="text-xs text-gray-500 uppercase font-bold tracking-widest mb-2">Ditagihkan Kepada:</p>
            <h3 className="text-lg font-bold text-gray-900">{order.customers?.name || 'Customer'}</h3>
            <p className="text-sm text-gray-600 mt-1 max-w-xs leading-relaxed">
              {order.customers?.address || 'Alamat tidak tersedia'}, {order.customers?.city}
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

        <div className="mt-8">
          {/* Mobile View */}
          <div className="md:hidden space-y-4">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest border-b border-gray-900 pb-2 mb-4">Detail Pesanan</h3>
            {(order.sales_items || []).map((item, idx) => (
              <div key={idx} className="flex justify-between items-start pb-4 border-b border-gray-100 last:border-0">
                <div className="pr-4">
                  <p className="font-bold text-gray-900 text-sm leading-tight">{item.products?.name || item.product_code}</p>
                  <p className="text-xs text-gray-500 mt-1">Order: {item.order_type}</p>
                  <p className="text-xs text-gray-400 mt-1">{Number(item.qty).toLocaleString('id-ID')} Pcs x Rp {Number(item.unit_price).toLocaleString('id-ID')}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-bold text-gray-900 text-sm">Rp {Number(item.total_price).toLocaleString('id-ID')}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop View */}
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
                {(order.sales_items || []).map((item, idx) => (
                  <tr key={idx}>
                    <td className="py-4">
                      <p className="font-bold text-gray-900">{item.products?.name || item.product_code}</p>
                      <p className="text-xs text-gray-500 mt-1">Order: {item.order_type}</p>
                    </td>
                    <td className="py-4 text-center font-medium text-gray-900">{Number(item.qty).toLocaleString('id-ID')}</td>
                    <td className="py-4 text-center text-gray-600">Pcs</td>
                    <td className="py-4 text-right text-gray-600">{Number(item.unit_price).toLocaleString('id-ID')}</td>
                    <td className="py-4 text-right font-bold text-gray-900">{Number(item.total_price).toLocaleString('id-ID')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-8 flex flex-col md:flex-row justify-between items-start gap-8 print:flex-row print:gap-4">
          <div className="w-full md:w-1/2 p-5 bg-gray-50 rounded-xl border border-gray-200 print:w-1/2">
            <h4 className="font-bold text-gray-900 mb-4 text-sm uppercase tracking-wider">Metode Pembayaran</h4>
            
            {order.payment_status !== 'LUNAS' && (
              <div className="mb-6 pb-6 border-b border-gray-200 no-print space-y-4">
                <p className="text-xs text-gray-500 font-bold uppercase tracking-widest">Pembayaran Digital Instan (QRIS):</p>
                
                <div 
                  className="bg-white p-4 rounded-xl border border-gray-200 text-center shadow-sm cursor-pointer hover:border-primary/50 transition-all group"
                  onClick={() => setIsQrisOpen(true)}
                >
                  <p className="text-sm font-bold text-gray-900 mb-3 group-hover:text-primary transition-colors">Scan QRIS untuk Membayar</p>
                  
                  <div className="w-48 h-48 mx-auto relative overflow-hidden rounded-xl border border-gray-100 bg-gray-50 shadow-inner">
                    <img src="/qris.png" alt="QRIS BCA" className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[140%] max-w-none mix-blend-multiply" />
                  </div>

                  <p className="text-xs text-gray-500 mt-3 font-semibold flex flex-col items-center gap-2">
                    <span>BCA Digital / Semua E-Wallet</span>
                    <span className="text-[10px] bg-primary/10 text-primary px-3 py-1 rounded-full">Klik untuk Perbesar & Unduh</span>
                  </p>
                </div>

                <p className="text-xs text-gray-500 font-bold uppercase tracking-widest pt-2">Atau Bayar via Virtual Account / Link:</p>
                {order.payment_url ? (
                  <a href={order.payment_url} target="_blank" rel="noopener noreferrer" className="w-full flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white py-3 rounded-xl font-bold transition-all shadow-lg shadow-red-500/20">
                    <CreditCard className="w-5 h-5" /> Lanjutkan Pembayaran (DOKU)
                  </a>
                ) : (
                  <div className="flex flex-col sm:flex-row gap-2">
                    <button 
                      disabled={isProcessing || Number(order.dp_amount) > 0}
                      onClick={() => handleDokuPayment(Number(order.total_amount) / 2)}
                      className="flex-1 flex items-center justify-center gap-2 bg-gray-800 hover:bg-gray-900 text-white py-2.5 rounded-xl font-bold transition-all text-sm disabled:opacity-50"
                    >
                      Bayar DP 50% (DOKU)
                    </button>
                    <button 
                      disabled={isProcessing}
                      onClick={() => handleDokuPayment(sisaBayar)}
                      className="flex-1 flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white py-2.5 rounded-xl font-bold transition-all shadow-lg shadow-red-500/20 text-sm disabled:opacity-50"
                    >
                      <CreditCard className="w-4 h-4" /> Bayar Lunas (DOKU)
                    </button>
                  </div>
                )}
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
                    onClick={() => {
                      navigator.clipboard.writeText(bank.account_number);
                      alert('Disalin: ' + bank.account_number);
                    }}
                    className="text-xs font-bold bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-md transition-colors no-print"
                  >
                    Salin
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="w-full md:w-1/3 space-y-3 print:w-1/2">
            <div className="flex justify-between items-center pt-2 border-b border-gray-200 pb-3">
              <span className="font-bold text-gray-900 text-lg">Total Tagihan</span>
              <span className="font-black text-gray-900 text-xl">Rp {Number(order.total_amount).toLocaleString('id-ID')}</span>
            </div>

            <div className="mt-4 pt-4 border-t-2 border-dashed border-gray-300 space-y-2">
              <div className="flex justify-between items-center text-sm text-green-700 font-medium">
                <span>Telah Dibayar (DP)</span>
                <span>- Rp {Number(order.dp_amount || 0).toLocaleString('id-ID')}</span>
              </div>
              {sisaBayar > 0 ? (
                <div className="flex justify-between items-center p-3 bg-red-50 rounded-lg text-red-700 font-bold">
                  <span>Sisa Pembayaran</span>
                  <span className="text-lg">Rp {sisaBayar.toLocaleString('id-ID')}</span>
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

        <div className="mt-8 md:mt-12 text-center border-t border-gray-200 pt-6 print:mt-8 print:pt-4">
          <p className="text-gray-500 text-sm">Terima kasih atas kepercayaan Anda kepada {store.store_name}.</p>
          <p className="text-gray-400 text-xs mt-1">Invoice ini dicetak secara otomatis oleh Sistem ERP {store.store_name}.</p>
        </div>

      </div>
    </>
  )
}
