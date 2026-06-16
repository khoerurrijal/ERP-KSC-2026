'use client'

import { useRouter } from 'next/navigation'
import { Printer, ArrowLeft, Download, Crown, MapPin, Phone, Mail } from 'lucide-react'

export default function InvoiceClient({ order, storeConfig }) {
  const router = useRouter()

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
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in zoom-in-95 duration-500 pb-20 print:pb-0 print:space-y-0 print:w-full print:max-w-none print:m-0">

      {/* Tombol Aksi - Disembunyikan saat di-print */}
      <style dangerouslySetInnerHTML={{
        __html: `
        @media print {
          @page { size: A4 portrait; margin: 10mm; }
          .no-print, aside, nav, header { display: none !important; }
          main { margin: 0 !important; padding: 0 !important; max-width: none !important; width: 100% !important; flex: none !important; }
          body, html { background-color: white !important; margin: 0 !important; padding: 0 !important; width: 100% !important; zoom: 0.8; }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          .glass-card { border: none !important; box-shadow: none !important; background: white !important; color: black !important; min-height: auto !important; overflow: visible !important; padding: 1.5rem !important; }
          .text-foreground { color: black !important; }
          .text-foreground\\/60 { color: #4a5568 !important; }
          .border-white\\/10 { border-color: #e2e8f0 !important; }
          .bg-white\\/5 { background-color: transparent !important; }
        }
      `}} />

      <div className="flex items-center justify-between mb-8 no-print">
        <button onClick={() => router.back()} className="flex items-center gap-2 text-foreground/60 hover:text-primary transition-colors text-sm">
          <ArrowLeft className="w-4 h-4" /> Kembali ke Sales
        </button>
        <div className="flex items-center gap-3">
          <a href={waUrl} target="_blank" rel="noopener noreferrer" className="btn-secondary bg-green-500/10 text-green-400 border-green-500/20 hover:bg-green-500/20 h-10 px-4 text-sm flex items-center gap-2">
            <Phone className="w-4 h-4" /> Share WA
          </a>
          <button onClick={handlePrint} className="btn-primary h-10 px-4 text-sm flex items-center gap-2">
            <Printer className="w-4 h-4" /> Print Invoice
          </button>
        </div>
      </div>

      {/* KERTAS INVOICE */}
      <div className="glass-card bg-white text-black p-8 md:p-12 relative overflow-hidden print:overflow-visible print:m-0 print:border-none" style={{ background: '#ffffff', color: '#1a202c', minHeight: 'auto' }}>

        {/* Dekorasi Pojok */}
        <div className="absolute -top-24 -right-24 w-64 h-64 bg-primary/10 rounded-full blur-3xl no-print" />

        <div className="flex flex-col md:flex-row justify-between items-start gap-8 border-b border-gray-200 pb-8 print:flex-row">
          <div>
            <div className="mb-2">
              <img src={store.logo_url || '/logo.png'} alt="Logo" className="h-16 md:h-20 w-auto object-contain bg-transparent" />
            </div>
            <p className="text-sm text-gray-500 font-medium tracking-widest uppercase mt-4">{store.slogan}</p>

            <div className="mt-4 space-y-1 text-xs text-gray-600">
              <p className="flex items-center gap-2"><MapPin className="w-3 h-3" /> {store.address}</p>
              <p className="flex items-center gap-2"><Phone className="w-3 h-3" /> {store.phone}</p>
              <p className="flex items-center gap-2"><Mail className="w-3 h-3" /> {store.email}</p>
            </div>
          </div>

          <div className="text-right">
            <h2 className="text-4xl font-black text-gray-200 uppercase tracking-widest">INVOICE</h2>
            <div className="mt-4 space-y-1 text-sm">
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
          <table className="w-full text-left border-collapse">
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
                    <p className="text-xs text-gray-500 mt-1">Order: {item.order_type} {item.mockup_url ? `(Mockup Tersedia)` : ''}</p>
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

        <div className="mt-8 flex flex-col md:flex-row justify-between items-start gap-8 print:flex-row print:gap-4">
          <div className="w-full md:w-1/2 p-4 bg-gray-50 rounded-xl border border-gray-200 print:w-1/2">
            <h4 className="font-bold text-gray-900 mb-2 text-sm uppercase tracking-wider">Metode Pembayaran / Transfer</h4>
            <div className="space-y-3">
              {(store.banks || []).map((bank, idx) => (
                <div key={idx} className={idx > 0 ? "pt-2 border-t border-gray-200" : ""}>
                  <p className="text-xs text-gray-500 font-bold">{bank.bank_name}</p>
                  <p className="font-medium text-gray-900 text-lg tracking-wider">{bank.account_number}</p>
                  <p className="text-xs text-gray-500">A/N: {bank.account_name}</p>
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
    </div>
  )
}
