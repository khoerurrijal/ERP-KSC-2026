'use client'

import { useState, useMemo } from 'react'
import CustomSelect from '@/components/CustomSelect'

export default function OrderClient({ products, matrix, dropdownConfig }) {
  // --- STATE ---
  const [cart, setCart] = useState([])
  const [isFastTrack, setIsFastTrack] = useState(false)
  const [isDesignService, setIsDesignService] = useState(false)

  // Product Selection Modal
  const [showProductModal, setShowProductModal] = useState(false)
  const [modalType, setModalType] = useState('SABLON') // SABLON | TUTUP
  const [modalCategory, setModalCategory] = useState('')
  const [modalProduct, setModalProduct] = useState('')
  const [modalQty, setModalQty] = useState(1000)
  const [modalIsTwoColor, setModalIsTwoColor] = useState(false)

  // Checkout Modal
  const [showCheckoutModal, setShowCheckoutModal] = useState(false)
  const [brandName, setBrandName] = useState('')
  const [waNumber, setWaNumber] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [invoiceData, setInvoiceData] = useState(null)

  const formatRp = (num) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(num)

  // --- DERIVED DATA ---
  const allCategories = useMemo(() => {
    const cats = [...new Set(products.map(p => p.category))].filter(Boolean)
    
    // Check mapping
    const mapping = dropdownConfig?.category_mapping || {}
    // We treat SABLON as 'Sablon' orderType and TUTUP as 'Polos'
    const getCats = (typeKey) => {
      // typeKey is either 'SABLON' or 'POLOS' (case insensitive mapping in dashboard was used)
      // the key in DB is usually 'Sablon' and 'Polos'
      const key = Object.keys(mapping).find(k => k.toUpperCase() === typeKey)
      if (key && mapping[key] && mapping[key].length > 0) {
        // Only return categories that actually have products
        return mapping[key].filter(c => cats.includes(c))
      }
      return []
    }

    const sablonCats = getCats('SABLON')
    const tutupCats = getCats('POLOS')

    return {
      sablon: sablonCats.length > 0 ? sablonCats : cats.filter(c => !c.toLowerCase().includes('tutup')),
      tutup: tutupCats.length > 0 ? tutupCats : cats.filter(c => c.toLowerCase().includes('tutup'))
    }
  }, [products, dropdownConfig])

  const modalProducts = useMemo(() => {
    return products.filter(p => p.category === modalCategory)
  }, [modalCategory, products])

  const modalSelectedProductObj = useMemo(() => {
    return products.find(p => p.id === modalProduct)
  }, [modalProduct, products])

  const modalMinQty = modalType === 'SABLON' && modalCategory === 'CUP PET' ? 1000 : 500
  const isModalQtyValid = modalQty >= modalMinQty

  // --- PRICING LOGIC ---
  const calculateItemPrice = (item) => {
    const product = products.find(p => p.id === item.productId)
    if (!product) return 0

    let sablonCost = 0
    if (item.type === 'SABLON') {
      const catMatrix = matrix[product.category]
      if (catMatrix) {
        if (item.qty >= 10000) sablonCost = catMatrix.qty_10000 || catMatrix.qty_5000 || 0
        else if (item.qty >= 5000) sablonCost = catMatrix.qty_5000 || catMatrix.qty_2000 || 0
        else if (item.qty >= 2000) sablonCost = catMatrix.qty_2000 || catMatrix.qty_1000 || 0
        else sablonCost = catMatrix.qty_1000 || catMatrix.qty_500 || 0
      }
    }

    let unitPrice = product.base_price
    if (item.type === 'SABLON') {
      unitPrice += sablonCost
      if (item.isTwoColor) unitPrice += 250
    }

    return unitPrice
  }

  const totals = useMemo(() => {
    let subtotal = 0
    cart.forEach(item => {
      subtotal += calculateItemPrice(item) * item.qty
    })

    let grandTotal = subtotal
    if (isFastTrack && cart.length > 0) grandTotal += 100000
    if (isDesignService && cart.length > 0) grandTotal += 50000

    return { subtotal, grandTotal }
  }, [cart, isFastTrack, isDesignService, products, matrix])
  // --- HANDLERS ---
  const handleAddToCart = () => {
    if (!modalProduct || !isModalQtyValid) return

    setCart(prev => [...prev, {
      id: Date.now().toString(),
      productId: modalProduct,
      type: modalType,
      qty: modalQty,
      isTwoColor: modalType === 'SABLON' ? modalIsTwoColor : false
    }])
    
    setShowProductModal(false)
    setModalProduct('')
    setModalIsTwoColor(false)
  }

  const handleRemoveItem = (id) => {
    setCart(prev => prev.filter(item => item.id !== id))
  }

  const handleRecommendTutup = (sablonItem) => {
    const product = products.find(p => p.id === sablonItem.productId)
    if (!product) return

    // Guess matching lid category
    let lidCategory = ''
    if (product.category.includes('PET')) lidCategory = 'TUTUP CUP PET'
    else if (product.category.includes('PP')) lidCategory = 'TUTUP CUP PP'
    else if (product.category.includes('INJECT')) lidCategory = 'TUTUP CUP INJECT'
    else if (product.category.includes('PAPERCUP')) lidCategory = 'TUTUP PAPERCUP'
    else if (product.category.includes('GOCUP')) lidCategory = 'TUTUP GOCUP'

    setModalType('TUTUP')
    setModalCategory(lidCategory || allCategories.tutup[0] || '')
    setModalProduct('') // reset product
    setModalQty(sablonItem.qty) // sync qty
    setShowProductModal(true)
  }

  const handleCheckout = async (e) => {
    e.preventDefault()
    if (cart.length === 0) return

    setIsSubmitting(true)

    // Prepare API payload
    const payloadItems = cart.map(item => {
      const product = products.find(p => p.id === item.productId)
      return {
        productId: product.product_code, // Must use product_code for DB
        productName: product.name,
        orderType: item.type === 'SABLON' ? 'Sablon' : 'Polos',
        qty: item.qty,
        unitPrice: calculateItemPrice(item),
        isTwoColor: item.isTwoColor
      }
    })

    try {
      const res = await fetch('/api/public-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brandName,
          whatsappNumber: waNumber,
          items: payloadItems,
          fastTrack: isFastTrack,
          designService: isDesignService,
          subtotal: totals.subtotal,
          grandTotal: totals.grandTotal
        })
      })

      const data = await res.json()
      if (data.success) {
        setInvoiceData(data)
        setShowCheckoutModal(false)
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
    const waText = `Halo kak Ina, saya sudah order via Website.\nInvoice: *${invoiceData.invoice}*\nNama Brand: *${brandName}*\nTotal Tagihan: *${formatRp(invoiceData.grandTotal)}*\n\nBerikut saya lampirkan bukti transfernya. 🙏`;
    const waLink = `https://wa.me/6282121316926?text=${encodeURIComponent(waText)}`;

    return (
      <div className="bg-white/5 backdrop-blur-md p-6 rounded-2xl shadow-xl border border-white/10 text-center animate-in fade-in zoom-in duration-300">
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
          <p className="text-xs text-foreground/50 mb-4">* Terdapat angka acak unik di belakang untuk verifikasi otomatis.</p>
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

  // --- VIEW: MAIN CART ---
  return (
    <>
      <div className="bg-white/5 backdrop-blur-md p-4 sm:p-6 rounded-2xl shadow-xl border border-white/10 mb-6">
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          Keranjang Belanja
        </h2>
        
        {cart.length === 0 ? (
          <div className="py-8 text-center bg-black/20 rounded-xl border border-dashed border-white/10 mb-4">
            <p className="text-foreground/50 mb-4">Belum ada produk di pesanan Anda.</p>
            <button 
              onClick={() => {
                setModalType('SABLON'); 
                setModalCategory(''); 
                setModalProduct(''); 
                setShowProductModal(true);
              }}
              className="px-6 py-2 bg-primary text-primary-foreground rounded-full font-bold hover:bg-primary/90 transition-transform active:scale-95"
            >
              + Tambah Cup Sablon
            </button>
          </div>
        ) : (
          <div className="space-y-4 mb-6">
            {cart.map((item, index) => {
              const product = products.find(p => p.id === item.productId)
              const price = calculateItemPrice(item)
              return (
                <div key={item.id} className="bg-black/20 border border-white/10 p-4 rounded-xl relative group">
                  <button onClick={() => handleRemoveItem(item.id)} className="absolute top-3 right-3 w-8 h-8 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center opacity-70 hover:opacity-100 transition-opacity">✕</button>
                  <div className="flex gap-4">
                    <div className="w-12 h-12 bg-secondary/50 rounded-lg flex items-center justify-center font-bold text-lg text-primary">
                      {index + 1}
                    </div>
                    <div className="flex-1 pr-8">
                      <p className="font-bold text-base leading-tight mb-1">{product?.name}</p>
                      <div className="flex flex-wrap gap-2 mb-2">
                        <span className="px-2 py-0.5 bg-primary/10 text-primary rounded text-xs font-semibold">{item.type}</span>
                        {item.isTwoColor && <span className="px-2 py-0.5 bg-yellow-500/10 text-yellow-500 rounded text-xs font-semibold">2 Warna</span>}
                        <span className="px-2 py-0.5 bg-secondary text-foreground/70 rounded text-xs">{item.qty} pcs</span>
                      </div>
                      <p className="font-bold text-primary">{formatRp(price * item.qty)} <span className="text-xs text-foreground/50 font-normal">({formatRp(price)}/pcs)</span></p>
                      
                      {item.type === 'SABLON' && (
                        <button 
                          onClick={() => handleRecommendTutup(item)}
                          className="mt-3 text-xs text-blue-500 font-bold hover:underline"
                        >
                          + Tambah Tutup Untuk Cup Ini
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
            
            <button 
              onClick={() => {
                setModalType('TUTUP'); 
                setModalCategory(allCategories.tutup[0] || ''); 
                setModalProduct(''); 
                setShowProductModal(true);
              }}
              className="w-full py-3 border border-dashed border-border rounded-xl text-sm font-bold text-foreground/60 hover:text-foreground hover:bg-secondary/30 transition-colors"
            >
              + Tambah Tutup / Polos Lainnya
            </button>
            <button 
              onClick={() => {
                setModalType('SABLON'); 
                setModalCategory(''); 
                setModalProduct(''); 
                setShowProductModal(true);
              }}
              className="w-full py-3 border border-dashed border-primary/50 text-primary rounded-xl text-sm font-bold hover:bg-primary/5 transition-colors"
            >
              + Tambah Cup Sablon Lain
            </button>
          </div>
        )}
      </div>

      {/* GLOBAL ADD-ONS */}
      {cart.length > 0 && (
        <div className="bg-white/5 backdrop-blur-md p-4 sm:p-6 rounded-2xl shadow-xl border border-white/10 mb-28">
          <h2 className="text-base font-bold mb-4">Layanan Tambahan (Opsional)</h2>
          <div className="space-y-3 bg-black/20 p-4 rounded-xl border border-white/10">
            <label className="flex items-start gap-3 cursor-pointer group">
              <div className="relative flex items-center mt-1">
                <input type="checkbox" className="w-5 h-5 rounded border-gray-300 text-primary focus:ring-primary" checked={isFastTrack} onChange={(e) => setIsFastTrack(e.target.checked)} />
              </div>
              <div>
                <p className="font-semibold text-sm group-hover:text-primary transition-colors">Fast Track (1-3 Hari)</p>
                <p className="text-xs text-foreground/60">+ Rp 100.000 / Pesanan</p>
              </div>
            </label>

            <label className="flex items-start gap-3 cursor-pointer group">
              <div className="relative flex items-center mt-1">
                <input type="checkbox" className="w-5 h-5 rounded border-gray-300 text-primary focus:ring-primary" checked={isDesignService} onChange={(e) => setIsDesignService(e.target.checked)} />
              </div>
              <div>
                <p className="font-semibold text-sm group-hover:text-primary transition-colors">Jasa Desain Logo</p>
                <p className="text-xs text-foreground/60">+ Rp 50.000 / Pesanan</p>
              </div>
            </label>
          </div>
        </div>
      )}

      {/* STICKY BOTTOM BAR */}
      {cart.length > 0 && (
        <div className="fixed bottom-0 left-0 w-full bg-black/80 backdrop-blur-2xl border-t border-white/10 shadow-[0_-10px_30px_rgba(0,0,0,0.5)] p-4 z-40 animate-in slide-in-from-bottom-10">
          <div className="max-w-xl mx-auto flex items-center justify-between gap-4">
            <div>
              <p className="text-xs text-foreground/60 font-medium">Grand Total</p>
              <p className="text-2xl font-black text-primary leading-none">{formatRp(totals.grandTotal)}</p>
            </div>
            <button 
              onClick={() => setShowCheckoutModal(true)}
              className="bg-primary text-primary-foreground px-8 py-3 rounded-xl font-bold hover:bg-primary/90 transition-all active:scale-95 shadow-lg shadow-primary/20"
            >
              Checkout
            </button>
          </div>
        </div>
      )}

      {/* MODAL: PILIH PRODUK */}
      {showProductModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center sm:p-4 animate-in fade-in duration-200">
          <div className="bg-black/80 backdrop-blur-2xl border border-white/10 w-full max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in slide-in-from-bottom-full sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-300">
            <div className="p-4 border-b border-white/10 flex justify-between items-center bg-white/5">
              <h3 className="font-black text-lg">Tambah {modalType === 'SABLON' ? 'Sablon Cup' : 'Tutup / Polos'}</h3>
              <button onClick={() => setShowProductModal(false)} className="w-8 h-8 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center font-bold">✕</button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1 space-y-5">
              {/* Jenis Selector (Hanya muncul jika bukan via tombol Rekomendasi Tutup yang maksa modalType TUTUP) */}
              {/* Jenis Selector dihilangkan sesuai permintaan user karena sudah ada tombol tambah khusus */}

              <div>
                <label className="block text-sm font-bold mb-2">Kategori</label>
                <CustomSelect 
                  value={modalCategory}
                  onChange={(e) => { setModalCategory(e.target.value); setModalProduct(''); }}
                  options={(modalType === 'SABLON' ? allCategories.sablon : allCategories.tutup).map(c => ({ value: c, label: c }))}
                  placeholder="-- Pilih Kategori --"
                  className="w-full"
                />
              </div>

              {modalCategory && (
                <div className="animate-in slide-in-from-top-2">
                  <label className="block text-sm font-bold mb-2">Varian Produk</label>
                  <CustomSelect 
                    value={modalProduct}
                    onChange={(e) => setModalProduct(e.target.value)}
                    options={modalProducts.map(p => ({ value: p.id, label: `${p.name} (${formatRp(p.base_price)}/pcs)` }))}
                    placeholder="-- Pilih Varian --"
                    className="w-full"
                  />
                </div>
              )}

              {modalSelectedProductObj && (
                <div className="animate-in slide-in-from-top-2">
                  <label className="block text-sm font-bold mb-2">Jumlah Pemesanan</label>
                  <input 
                    type="number" 
                    className="w-full p-3 bg-black/40 border border-white/10 rounded-xl focus:ring-2 focus:ring-primary/50 outline-none text-lg font-bold"
                    value={modalQty}
                    onChange={(e) => setModalQty(Number(e.target.value))}
                    min="0"
                    step="500"
                  />
                  {!isModalQtyValid && (
                    <p className="text-red-500 text-xs mt-1 font-semibold">Minimal pemesanan {modalCategory} adalah {modalMinQty} pcs.</p>
                  )}

                  {modalType === 'SABLON' && (
                    <label className="flex items-center gap-3 cursor-pointer group mt-4 bg-white/5 p-3 rounded-xl border border-white/10">
                      <input type="checkbox" className="w-5 h-5 rounded border-gray-300 text-primary" checked={modalIsTwoColor} onChange={(e) => setModalIsTwoColor(e.target.checked)} />
                      <div>
                        <p className="font-bold text-sm">Cetak Sablon 2 Warna</p>
                        <p className="text-xs text-foreground/60">+ Rp 250 / pcs</p>
                      </div>
                    </label>
                  )}
                </div>
              )}
            </div>

            <div className="p-4 border-t border-white/10 bg-black/40">
              <button 
                onClick={handleAddToCart}
                disabled={!modalProduct || !isModalQtyValid}
                className="w-full bg-primary text-primary-foreground py-4 rounded-xl font-bold hover:bg-primary/90 transition-transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Masukkan ke Keranjang
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CHECKOUT */}
      {showCheckoutModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-black/80 backdrop-blur-2xl border border-white/10 w-full max-w-md rounded-2xl shadow-2xl p-6 relative animate-in zoom-in-95 duration-200">
            <button onClick={() => setShowCheckoutModal(false)} className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-foreground/60 hover:text-foreground">✕</button>
            
            <h2 className="text-xl font-black mb-1">Data Pemesan</h2>
            <p className="text-sm text-foreground/60 mb-6">Isi data di bawah ini untuk menerbitkan Invoice.</p>

            <form onSubmit={handleCheckout}>
              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-sm font-bold mb-1">Nama Brand / Usaha</label>
                  <input 
                    type="text" 
                    required 
                    placeholder="Contoh: Kopi Nangkring"
                    className="w-full p-3 bg-black/40 border border-white/10 rounded-xl focus:ring-2 focus:ring-primary/50 outline-none"
                    value={brandName}
                    onChange={e => setBrandName(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold mb-1">Nomor WhatsApp</label>
                  <input 
                    type="tel" 
                    required 
                    placeholder="08xxxx"
                    className="w-full p-3 bg-black/40 border border-white/10 rounded-xl focus:ring-2 focus:ring-primary/50 outline-none"
                    value={waNumber}
                    onChange={e => setWaNumber(e.target.value)}
                  />
                </div>
              </div>

              <div className="bg-primary/5 rounded-xl p-4 mb-6 text-sm border border-primary/10 max-h-[30vh] overflow-y-auto">
                <p className="font-bold mb-2 pb-2 border-b border-border/50">Ringkasan ({cart.length} Item)</p>
                {cart.map(item => {
                  const product = products.find(p => p.id === item.productId)
                  return (
                    <div key={item.id} className="flex justify-between mb-2">
                      <span className="text-foreground/80 pr-4">{product?.name} x {item.qty}</span>
                      <span className="font-semibold shrink-0">{formatRp(calculateItemPrice(item) * item.qty)}</span>
                    </div>
                  )
                })}
                {isFastTrack && <div className="flex justify-between mt-2 text-primary font-medium"><span>Fast Track</span><span>+ Rp 100.000</span></div>}
                {isDesignService && <div className="flex justify-between mt-1 text-primary font-medium"><span>Jasa Desain</span><span>+ Rp 50.000</span></div>}
                
                <div className="border-t border-primary/20 mt-3 pt-3 flex justify-between font-black text-lg text-primary">
                  <span>Grand Total</span><span>{formatRp(totals.grandTotal)}</span>
                </div>
              </div>

              <button 
                type="submit" 
                disabled={isSubmitting}
                className="w-full bg-primary text-primary-foreground py-4 rounded-xl font-bold hover:bg-primary/90 transition-transform active:scale-95 flex justify-center items-center"
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
