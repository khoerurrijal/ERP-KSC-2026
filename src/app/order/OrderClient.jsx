'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'

export default function OrderClient({ products, matrix }) {
  const router = useRouter()
  
  // State 1: Calculator
  const [selectedProduct, setSelectedProduct] = useState('')
  const [qty, setQty] = useState(1000)
  
  // Add-ons
  const [isFastTrack, setIsFastTrack] = useState(false)
  const [isDesignService, setIsDesignService] = useState(false)
  const [isTwoColor, setIsTwoColor] = useState(false)

  // State 2: Modal Checkout
  const [showModal, setShowModal] = useState(false)
  const [brandName, setBrandName] = useState('')
  const [waNumber, setWaNumber] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // State 3: Success Screen
  const [invoiceData, setInvoiceData] = useState(null)

  // Computed Properties
  const activeProduct = useMemo(() => products.find(p => p.id === selectedProduct), [selectedProduct, products])
  
  const minQty = activeProduct?.category === 'CUP PET' ? 1000 : 500
  const isQtyValid = qty >= minQty

  const pricing = useMemo(() => {
    if (!activeProduct || !isQtyValid) return { unitPrice: 0, subtotal: 0, grandTotal: 0 }

    let sablonCost = 0
    const catMatrix = matrix[activeProduct.category]
    
    if (catMatrix) {
      if (qty >= 10000) sablonCost = catMatrix.qty_10000 || catMatrix.qty_5000 || 0
      else if (qty >= 5000) sablonCost = catMatrix.qty_5000 || catMatrix.qty_2000 || 0
      else if (qty >= 2000) sablonCost = catMatrix.qty_2000 || catMatrix.qty_1000 || 0
      else sablonCost = catMatrix.qty_1000 || catMatrix.qty_500 || 0
    }

    let unitPrice = activeProduct.base_price + sablonCost
    if (isTwoColor) unitPrice += 250 // Biaya 2 warna

    let subtotal = unitPrice * qty
    let grandTotal = subtotal

    if (isFastTrack) grandTotal += 100000 // Fast track flat 100rb
    if (isDesignService) grandTotal += 50000 // Jasa desain flat 50rb

    return { unitPrice, subtotal, grandTotal }
  }, [activeProduct, qty, isQtyValid, matrix, isFastTrack, isDesignService, isTwoColor])

  const formatRp = (num) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(num)

  const handleCheckout = async (e) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      const res = await fetch('/api/public-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brandName,
          whatsappNumber: waNumber,
          productId: activeProduct.id,
          productName: activeProduct.name,
          qty,
          fastTrack: isFastTrack,
          designService: isDesignService,
          twoColor: isTwoColor,
          pricePerItem: pricing.unitPrice,
          subtotal: pricing.subtotal,
          grandTotal: pricing.grandTotal
        })
      })

      const data = await res.json()
      if (data.success) {
        setInvoiceData(data)
        setShowModal(false)
      } else {
        alert("Gagal membuat pesanan: " + data.error)
      }
    } catch (err) {
      alert("Terjadi kesalahan jaringan.")
    } finally {
      setIsSubmitting(false)
    }
  }

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text)
    alert('Disalin: ' + text)
  }

  // --- VIEW: SUCCESS SCREEN ---
  if (invoiceData) {
    const waText = \`Halo kak Ina, saya sudah order via Website.
Invoice: *\${invoiceData.invoice}*
Nama Brand: *\${brandName}*
Total Tagihan: *\${formatRp(invoiceData.grandTotal)}*

Berikut saya lampirkan bukti transfernya. 🙏\`;
    const waLink = \`https://wa.me/6282121316926?text=\${encodeURIComponent(waText)}\`;

    return (
      <div className="bg-card p-6 rounded-2xl shadow-xl border border-border/50 text-center animate-in fade-in zoom-in duration-300">
        <div className="w-16 h-16 bg-green-500/20 text-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
        </div>
        <h2 className="text-2xl font-bold mb-1">Pesanan Berhasil!</h2>
        <p className="text-foreground/60 mb-6">Selesaikan pembayaran agar pesanan segera diproses.</p>
        
        <div className="bg-primary/5 rounded-xl p-4 mb-6 text-left border border-primary/10">
          <p className="text-sm text-foreground/60">Nomor Invoice</p>
          <p className="text-xl font-mono font-bold text-primary mb-3">{invoiceData.invoice}</p>
          
          <p className="text-sm text-foreground/60">Total Tagihan (Termasuk Kode Unik)</p>
          <p className="text-3xl font-black text-primary mb-1">{formatRp(invoiceData.grandTotal)}</p>
          <p className="text-xs text-foreground/50 mb-4">* Terdapat 3 angka acak di belakang untuk verifikasi otomatis.</p>
        </div>

        <div className="bg-primary/5 rounded-xl p-4 mb-6 text-left border border-primary/10">
          <p className="text-sm text-foreground/60 mb-2">Simpan Link Pelacakan Pesanan Anda:</p>
          <div className="flex gap-2">
            <input type="text" readOnly value={`https://erpkscv1.vercel.app/track/${invoiceData.invoice}`} className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-xs font-mono" />
            <button onClick={() => copyToClipboard(`https://erpkscv1.vercel.app/track/${invoiceData.invoice}`)} className="px-3 py-2 bg-secondary rounded-lg text-xs font-bold">Copy</button>
          </div>
        </div>

        <div className="space-y-4 mb-6 text-left">
          <h3 className="font-semibold">Transfer ke Rekening Berikut:</h3>
          
          <div className="bg-background rounded-lg p-3 flex justify-between items-center border border-border">
            <div>
              <p className="font-bold text-blue-600">BCA</p>
              <p className="font-mono">6930 2401 07</p>
              <p className="text-xs text-foreground/60">a/n Khoerur Rijal</p>
            </div>
            <button onClick={() => copyToClipboard('6930240107')} className="px-4 py-2 bg-secondary rounded-lg text-sm font-semibold hover:bg-secondary/80">Copy</button>
          </div>

          <div className="bg-background rounded-lg p-3 flex justify-between items-center border border-border">
            <div>
              <p className="font-bold text-blue-800">MANDIRI</p>
              <p className="font-mono">900 0020 3650 95</p>
              <p className="text-xs text-foreground/60">a/n Khoerur Rijal</p>
            </div>
            <button onClick={() => copyToClipboard('9000020365095')} className="px-4 py-2 bg-secondary rounded-lg text-sm font-semibold hover:bg-secondary/80">Copy</button>
          </div>
        </div>

        <a href={waLink} target="_blank" rel="noreferrer" className="w-full flex items-center justify-center gap-2 bg-[#25D366] hover:bg-[#20bd5a] text-white py-4 rounded-xl font-bold text-lg transition-colors">
          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.582 2.128 2.182-.573c.978.58 1.911.928 3.145.929 3.178 0 5.767-2.587 5.768-5.766.001-3.187-2.575-5.77-5.764-5.771zm3.392 8.244c-.144.405-.837.774-1.17.824-.299.045-.677.063-1.092-.069-.252-.08-.575-.187-.988-.365-1.739-.751-2.874-2.502-2.961-2.617-.087-.116-.708-.94-.708-1.793s.448-1.273.607-1.446c.159-.173.346-.217.462-.217l.332.006c.106.005.249-.04.39.298.144.347.491 1.2.534 1.287.043.087.072.188.014.304-.058.116-.087.188-.173.289l-.26.304c-.087.086-.177.18-.076.354.101.174.449.741.964 1.201.662.591 1.221.774 1.394.86s.274.072.376-.043c.101-.116.433-.506.549-.68.116-.173.231-.145.39-.087s1.011.477 1.184.564c.173.087.289.129.332.202.043.073.043.423-.101.827z"/></svg>
          Konfirmasi via WhatsApp
        </a>
      </div>
    )
  }

  // --- VIEW: CALCULATOR ---
  return (
    <>
      <div className="bg-card p-4 sm:p-6 rounded-2xl shadow-xl border border-border/50">
        <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
          <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm">1</span>
          Pilih Produk
        </h2>
        
        <select 
          className="w-full p-3 bg-background border border-input rounded-xl mb-6 focus:ring-2 focus:ring-primary/50 outline-none transition-all"
          value={selectedProduct}
          onChange={(e) => setSelectedProduct(e.target.value)}
        >
          <option value="">-- Silakan Pilih Cup --</option>
          {products.map(p => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>

        {activeProduct && (
          <div className="animate-in fade-in slide-in-from-top-2 duration-300">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm">2</span>
              Jumlah & Tambahan
            </h2>
            
            <div className="mb-4">
              <label className="block text-sm text-foreground/70 mb-1">Jumlah Pemesanan (Pcs)</label>
              <input 
                type="number" 
                className="w-full p-3 bg-background border border-input rounded-xl focus:ring-2 focus:ring-primary/50 outline-none text-lg font-bold"
                value={qty}
                onChange={(e) => setQty(Number(e.target.value))}
                min="0"
                step="500"
              />
              {!isQtyValid && (
                <p className="text-red-500 text-xs mt-1 font-semibold">Minimal pemesanan untuk {activeProduct.category} adalah {minQty} pcs.</p>
              )}
            </div>

            <div className="space-y-3 mb-6 bg-secondary/30 p-4 rounded-xl border border-border">
              <label className="flex items-start gap-3 cursor-pointer group">
                <div className="relative flex items-center mt-1">
                  <input type="checkbox" className="w-5 h-5 rounded border-gray-300 text-primary focus:ring-primary" checked={isTwoColor} onChange={(e) => setIsTwoColor(e.target.checked)} />
                </div>
                <div>
                  <p className="font-semibold text-sm group-hover:text-primary transition-colors">Sablon 2 Warna</p>
                  <p className="text-xs text-foreground/60">+ Rp 250 / pcs</p>
                </div>
              </label>

              <label className="flex items-start gap-3 cursor-pointer group">
                <div className="relative flex items-center mt-1">
                  <input type="checkbox" className="w-5 h-5 rounded border-gray-300 text-primary focus:ring-primary" checked={isFastTrack} onChange={(e) => setIsFastTrack(e.target.checked)} />
                </div>
                <div>
                  <p className="font-semibold text-sm group-hover:text-primary transition-colors">Fast Track (1-3 Hari)</p>
                  <p className="text-xs text-foreground/60">+ Rp 100.000 (Maksimal 1.000 pcs pertama)</p>
                </div>
              </label>

              <label className="flex items-start gap-3 cursor-pointer group">
                <div className="relative flex items-center mt-1">
                  <input type="checkbox" className="w-5 h-5 rounded border-gray-300 text-primary focus:ring-primary" checked={isDesignService} onChange={(e) => setIsDesignService(e.target.checked)} />
                </div>
                <div>
                  <p className="font-semibold text-sm group-hover:text-primary transition-colors">Jasa Desain Logo</p>
                  <p className="text-xs text-foreground/60">+ Rp 50.000 (Jika belum punya desain)</p>
                </div>
              </label>
            </div>
          </div>
        )}
      </div>

      {/* STICKY BOTTOM BAR */}
      {activeProduct && (
        <div className="fixed bottom-0 left-0 w-full bg-card border-t border-border shadow-[0_-10px_30px_rgba(0,0,0,0.1)] p-4 z-50 animate-in slide-in-from-bottom-10">
          <div className="max-w-xl mx-auto flex items-center justify-between gap-4">
            <div>
              <p className="text-xs text-foreground/60 font-medium">Total Harga</p>
              {isQtyValid ? (
                <p className="text-2xl font-black text-primary leading-none">{formatRp(pricing.grandTotal)}</p>
              ) : (
                <p className="text-sm font-bold text-red-500">Qty Kurang</p>
              )}
            </div>
            <button 
              onClick={() => setShowModal(true)}
              disabled={!isQtyValid}
              className="bg-primary text-primary-foreground px-6 py-3 rounded-xl font-bold hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95"
            >
              Lanjut Pesan
            </button>
          </div>
        </div>
      )}

      {/* MODAL CHECKOUT */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-card w-full max-w-md rounded-2xl shadow-2xl p-6 relative animate-in zoom-in-95 duration-200">
            <button onClick={() => setShowModal(false)} className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-secondary text-foreground/60 hover:text-foreground">✕</button>
            
            <h2 className="text-xl font-black mb-1">Data Pemesan</h2>
            <p className="text-sm text-foreground/60 mb-6">Isi data di bawah ini untuk menerbitkan Invoice.</p>

            <form onSubmit={handleCheckout}>
              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-sm font-semibold mb-1">Nama Brand / Usaha</label>
                  <input 
                    type="text" 
                    required 
                    placeholder="Contoh: Kopi Nangkring"
                    className="w-full p-3 bg-background border border-input rounded-xl focus:ring-2 focus:ring-primary/50 outline-none"
                    value={brandName}
                    onChange={e => setBrandName(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1">Nomor WhatsApp</label>
                  <input 
                    type="tel" 
                    required 
                    placeholder="08xxxx"
                    className="w-full p-3 bg-background border border-input rounded-xl focus:ring-2 focus:ring-primary/50 outline-none"
                    value={waNumber}
                    onChange={e => setWaNumber(e.target.value)}
                  />
                </div>
              </div>

              <div className="bg-primary/5 rounded-xl p-4 mb-6 text-sm">
                <div className="flex justify-between mb-1"><span>{activeProduct.name} x {qty}</span><span>{formatRp(pricing.subtotal)}</span></div>
                {isTwoColor && <div className="flex justify-between mb-1 text-foreground/60"><span>Sablon 2 Warna</span><span>Termasuk</span></div>}
                {isFastTrack && <div className="flex justify-between mb-1 text-foreground/60"><span>Fast Track</span><span>+ 100.000</span></div>}
                {isDesignService && <div className="flex justify-between mb-1 text-foreground/60"><span>Jasa Desain</span><span>+ 50.000</span></div>}
                <div className="border-t border-border mt-2 pt-2 flex justify-between font-bold text-primary">
                  <span>Grand Total</span><span>{formatRp(pricing.grandTotal)}</span>
                </div>
              </div>

              <button 
                type="submit" 
                disabled={isSubmitting}
                className="w-full bg-primary text-primary-foreground py-4 rounded-xl font-bold hover:bg-primary/90 transition-all active:scale-95 flex justify-center items-center"
              >
                {isSubmitting ? 'Memproses...' : 'Buat Pesanan Sekarang'}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
