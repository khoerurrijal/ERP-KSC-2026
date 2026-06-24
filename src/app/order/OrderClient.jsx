'use client'

import { useState, useMemo, useEffect } from 'react'
import CustomSelect from '@/components/CustomSelect'
import { calculateItemPrice as calculateItemPriceUtil, getMinQty } from '@/utils/pricing'
import { ShoppingCart, X, Plus, ChevronRight, Image as ImageIcon } from 'lucide-react'

// Helper to convert Google Drive viewing URLs into direct image URLs
const getDirectImgUrl = (url) => {
  if (!url) return url;
  const driveRegex = /drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/;
  const match = url.match(driveRegex);
  if (match && match[1]) {
    // lh3.googleusercontent.com is the only reliable way to hotlink Drive images now
    return `https://lh3.googleusercontent.com/d/${match[1]}`;
  }
  return url;
}

export default function OrderClient({ products, matrix, dropdownConfig, pricelistConfig = {}, categoryImagesConfig = {} }) {
  // --- STATE ---
  const orderTypeOptions = useMemo(() => {
    const fromConfig = Array.from(new Set([...(dropdownConfig.order_type || ["SABLON", "PRINTING", "POLOS"])]));
    return fromConfig.filter(v => ['SABLON', 'PRINTING', 'POLOS'].includes(v.toUpperCase()));
  }, [dropdownConfig])

  const [activeFilter, setActiveFilter] = useState(orderTypeOptions[0] || 'SABLON')
  
  const [cart, setCart] = useState([])
  const [isDesignService, setIsDesignService] = useState(false)
  const [isCartOpen, setIsCartOpen] = useState(false)

  // Product Selection Modal
  const [showProductModal, setShowProductModal] = useState(false)
  const [modalType, setModalType] = useState('SABLON')
  const [modalCategory, setModalCategory] = useState('')
  const [modalProduct, setModalProduct] = useState('')
  const [modalQty, setModalQty] = useState(500)
  const [modalIsTwoColor, setModalIsTwoColor] = useState(false)
  const [modalPrintingColors, setModalPrintingColors] = useState('3 Warna')
  const [modalIsFastTrack, setModalIsFastTrack] = useState(false)
  
  // Opsi Tambahan Tutup
  const [modalIncludeLid, setModalIncludeLid] = useState(false)
  const [modalLidProduct, setModalLidProduct] = useState('')

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
    const mapping = dropdownConfig?.category_mapping || {}
    
    return {
      get: (oType) => {
        if (!oType) return []
        if (mapping[oType] && mapping[oType].length > 0) {
          return mapping[oType].filter(c => cats.includes(c))
        }
        return cats
      }
    }
  }, [products, dropdownConfig])

  const modalProducts = useMemo(() => {
    return products.filter(p => p.category === modalCategory && p.is_active !== false)
  }, [modalCategory, products])

  const modalSelectedProductObj = useMemo(() => {
    return products.find(p => p.id === modalProduct)
  }, [modalProduct, products])

  // Lid logic
  const lidCategory = useMemo(() => {
    if (!modalCategory) return ''
    if (modalCategory.includes('PET')) return 'TUTUP CUP PET'
    if (modalCategory.includes('PP')) return 'TUTUP CUP PP'
    if (modalCategory.includes('INJECT')) return 'TUTUP CUP INJECT'
    if (modalCategory.includes('PAPERCUP')) return 'TUTUP PAPERCUP'
    if (modalCategory.includes('GOCUP')) return 'TUTUP GOCUP'
    return ''
  }, [modalCategory])

  const lidProducts = useMemo(() => {
    return products.filter(p => p.category === lidCategory && p.is_active !== false)
  }, [lidCategory, products])

  const modalMinQty = getMinQty({
    orderType: modalType,
    category: modalCategory,
    printingColors: modalPrintingColors,
    pricelistConfig
  })
  
  // We use >= here instead of hard blocking in input
  const isModalQtyValid = modalQty >= modalMinQty

  // Removed the useEffect that forces the qty back to minQty

  // --- PRICING LOGIC ---
  const calculateItemPrice = (item) => {
    const product = products.find(p => p.id === item.productId)
    if (!product) return 0
    
    return calculateItemPriceUtil({
      product,
      qty: item.qty,
      orderType: item.type,
      isTwoColor: item.isTwoColor,
      printingColors: item.printingColors,
      pricelistConfig
    })
  }

  const totals = useMemo(() => {
    let subtotal = 0
    let fastTrackTotal = 0
    cart.forEach(item => {
      subtotal += calculateItemPrice(item) * item.qty
      if (item.isFastTrack) fastTrackTotal += 100000
    })

    let grandTotal = subtotal + fastTrackTotal
    if (isDesignService && cart.length > 0) grandTotal += 50000

    return { subtotal, grandTotal }
  }, [cart, isDesignService, products, pricelistConfig])

  // --- HANDLERS ---
  const handleOpenCategory = (cat) => {
    setModalType(activeFilter)
    setModalCategory(cat)
    setModalProduct('')
    setModalIsTwoColor(false)
    setModalPrintingColors('3 Warna')
    setModalIsFastTrack(false)
    setModalIncludeLid(false)
    setModalLidProduct('')
    
    const initialMinQty = getMinQty({
      orderType: activeFilter,
      category: cat,
      printingColors: '3 Warna',
      pricelistConfig
    })
    setModalQty(initialMinQty)
    
    setShowProductModal(true)
  }

  const handleAddToCart = () => {
    if (!modalProduct || !isModalQtyValid) return

    const newItems = []
    
    // Main item
    newItems.push({
      id: Date.now().toString() + "-1",
      productId: modalProduct,
      type: modalType,
      qty: parseInt(modalQty, 10) || 0,
      isTwoColor: modalType === 'SABLON' ? modalIsTwoColor : false,
      printingColors: modalType === 'PRINTING' ? modalPrintingColors : null,
      isFastTrack: modalType === 'SABLON' ? modalIsFastTrack : false
    })

    // Lid item (if selected)
    if (modalIncludeLid && modalLidProduct) {
      const targetLidType = orderTypeOptions.includes('POLOS') ? 'POLOS' : orderTypeOptions[0]
      newItems.push({
        id: Date.now().toString() + "-2",
        productId: modalLidProduct,
        type: targetLidType,
        qty: parseInt(modalQty, 10) || 0,
        isTwoColor: false,
        printingColors: null,
        isFastTrack: false
      })
    }
    
    setCart(prev => [...prev, ...newItems])
    setShowProductModal(false)
    setIsCartOpen(true) // auto open cart to show it was added
  }

  const handleRemoveItem = (id) => {
    setCart(prev => prev.filter(item => item.id !== id))
  }

  const handleCheckout = async (e) => {
    e.preventDefault()
    if (cart.length === 0) return

    setIsSubmitting(true)

    const payloadItems = cart.map(item => {
      const product = products.find(p => p.id === item.productId)
      return {
        productId: product.product_code,
        productName: product.name,
        orderType: item.type,
        qty: item.qty,
        unitPrice: calculateItemPrice(item),
        isTwoColor: item.isTwoColor,
        printingColors: item.printingColors,
        isFastTrack: item.isFastTrack
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
          designService: isDesignService,
          subtotal: totals.subtotal,
          grandTotal: totals.grandTotal
        })
      })

      const data = await res.json()
      if (data.success) {
        // Redirect to Public Digital Invoice page
        window.location.href = `/invoice/${data.data?.invoice_number || data.invoice || data.data?.invoice}`
      } else {
        alert("Gagal memproses pesanan: " + data.error)
      }
    } catch (err) {
      alert("Terjadi kesalahan jaringan.")
    } finally {
      setIsSubmitting(false)
    }
  }



  const displayedCategories = allCategories.get(activeFilter)

  return (
    <>
      {/* 1. FILTER TABS */}
      <div className="flex justify-center gap-2 mb-8 sticky top-4 z-30">
        <div className="bg-black/60 backdrop-blur-2xl p-1.5 rounded-full border border-white/10 shadow-xl inline-flex shadow-black/50 overflow-x-auto max-w-full custom-scrollbar">
          {orderTypeOptions.map(type => (
            <button
              key={type}
              onClick={() => setActiveFilter(type)}
              className={`px-6 py-2.5 rounded-full text-sm font-bold transition-all duration-300 whitespace-nowrap ${
                activeFilter === type 
                  ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20 scale-100' 
                  : 'text-foreground/60 hover:text-foreground hover:bg-white/5 scale-95'
              }`}
            >
              {type}
            </button>
          ))}
        </div>
      </div>

      {/* 2. CATEGORY GRID */}
      <div className="mb-12">
        {displayedCategories.length === 0 ? (
          <div className="text-center py-20 bg-white/5 rounded-3xl border border-white/10">
            <ImageIcon className="w-12 h-12 mx-auto mb-4 text-foreground/20" />
            <p className="text-foreground/50 italic">Belum ada kategori untuk jenis ini.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 sm:gap-6">
            {displayedCategories.map(cat => {
              // Placeholder using local logo
              const fallbackImage = '/logo-dark.png'
              const rawUrl = categoryImagesConfig[cat]
              const imgUrl = rawUrl ? getDirectImgUrl(rawUrl) : fallbackImage
              
              return (
                <div 
                  key={cat}
                  onClick={() => handleOpenCategory(cat)}
                  className="group bg-black/40 backdrop-blur-xl border border-white/10 rounded-3xl overflow-hidden cursor-pointer hover:border-primary/50 hover:shadow-[0_0_30px_rgba(var(--primary),0.15)] transition-all duration-300 active:scale-95 flex flex-col"
                >
                  {/* Aspect Square for thumbnail */}
                  <div className="w-full aspect-square relative bg-white/5 overflow-hidden">
                    <img 
                      src={imgUrl} 
                      alt={cat} 
                      className="w-full h-full object-contain p-4 opacity-50 transition-transform duration-500 group-hover:scale-110" 
                      onError={(e) => { 
                        e.currentTarget.onerror = null; 
                        e.currentTarget.src = fallbackImage; 
                      }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-80" />
                  </div>
                  <div className="p-4 flex-1 flex flex-col justify-end text-center relative -mt-12">
                    <h3 className="font-black text-sm sm:text-base text-white drop-shadow-md truncate">{cat}</h3>
                    <p className="text-[10px] sm:text-xs text-primary font-bold mt-1 opacity-0 group-hover:opacity-100 transition-opacity translate-y-2 group-hover:translate-y-0">PILIH SEKARANG &rarr;</p>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* 3. MODAL PRODUK */}
      {showProductModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center sm:p-4 animate-in fade-in duration-200">
          <div className="bg-black/80 backdrop-blur-2xl border border-white/10 w-full max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in slide-in-from-bottom-full sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-300">
            
            <div className="p-4 border-b border-white/10 flex justify-between items-center bg-white/5">
              <div>
                <p className="text-[10px] font-bold text-primary tracking-widest uppercase">{modalType}</p>
                <h3 className="font-black text-lg leading-tight">{modalCategory}</h3>
              </div>
              <button onClick={() => setShowProductModal(false)} className="w-8 h-8 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center font-bold">✕</button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1 space-y-5 custom-scrollbar">
              
              <div className="animate-in slide-in-from-top-2 space-y-2">
                <label className="block text-sm font-bold text-foreground/80">Pilih Ukuran / Produk</label>
                <CustomSelect 
                  value={modalProduct}
                  onChange={(e) => setModalProduct(e.target.value)}
                  options={modalProducts.map(p => ({ value: p.id, label: p.name }))}
                  placeholder="-- Pilih Ukuran --"
                  className="w-full"
                  menuPosition="static"
                />
              </div>

              {modalSelectedProductObj && (
                <div className="animate-in slide-in-from-top-2 space-y-5">
                  
                  {modalType === 'PRINTING' && (
                    <div className="space-y-2">
                      <label className="block text-sm font-bold text-foreground/80">Varian Warna Printing</label>
                      <CustomSelect 
                        value={modalPrintingColors}
                        onChange={(e) => setModalPrintingColors(e.target.value)}
                        options={[
                          { value: '3 Warna', label: '3 Warna' },
                          { value: '4 Warna', label: '4 Warna' }
                        ]}
                        className="w-full"
                        menuPosition="static"
                      />
                    </div>
                  )}

                  <div className="space-y-2">
                    <label className="block text-sm font-bold text-foreground/80">Jumlah Pesanan (Qty)</label>
                    <input 
                      type="number" 
                      value={modalQty === '' ? '' : modalQty}
                      onChange={(e) => setModalQty(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
                      className={`w-full p-3 bg-black/40 border rounded-xl outline-none focus:ring-2 transition-all font-mono text-lg ${isModalQtyValid ? 'border-white/10 focus:ring-primary/50' : 'border-red-500/50 focus:ring-red-500/50'}`}
                      min={modalMinQty}
                      step="500"
                    />
                    {!isModalQtyValid && (
                      <p className="text-red-500 text-xs mt-1 font-semibold flex items-center gap-1">
                        <span className="inline-block w-1 h-1 bg-red-500 rounded-full animate-pulse"></span>
                        Minimal pemesanan {modalMinQty} pcs
                      </p>
                    )}
                  </div>

                  {modalType === 'SABLON' && (
                    <>
                      <label className="flex items-center gap-3 cursor-pointer group bg-black/40 p-3 rounded-xl border border-white/10 hover:border-yellow-500/50 transition-colors">
                        <input type="checkbox" className="w-5 h-5 rounded border-gray-300 text-yellow-500 focus:ring-yellow-500" checked={modalIsTwoColor} onChange={(e) => setModalIsTwoColor(e.target.checked)} />
                        <div>
                          <p className="font-bold text-sm text-yellow-500">Cetak Sablon 2 Warna</p>
                          <p className="text-xs text-foreground/60">+ Rp 250 / pcs</p>
                        </div>
                      </label>
                      <label className="flex items-center gap-3 cursor-pointer group bg-black/40 p-3 rounded-xl border border-white/10 hover:border-blue-500/50 transition-colors">
                        <input type="checkbox" className="w-5 h-5 rounded border-gray-300 text-blue-500 focus:ring-blue-500" checked={modalIsFastTrack} onChange={(e) => setModalIsFastTrack(e.target.checked)} />
                        <div>
                          <p className="font-bold text-sm text-blue-400">Fast Track (1-3 Hari)</p>
                          <p className="text-xs text-foreground/60">+ Rp 100.000 / Pesanan</p>
                        </div>
                      </label>
                    </>
                  )}

                  {/* OPSI TAMBAH TUTUP */}
                  {lidCategory && lidProducts.length > 0 && modalType !== 'POLOS' && (
                    <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-4 space-y-3">
                      <label className="flex items-center gap-3 cursor-pointer group">
                        <input type="checkbox" className="w-5 h-5 rounded border-gray-300 text-blue-500 focus:ring-blue-500" checked={modalIncludeLid} onChange={(e) => setModalIncludeLid(e.target.checked)} />
                        <div>
                          <p className="font-bold text-sm text-blue-400">Sekalian Tambah Tutup?</p>
                          <p className="text-xs text-foreground/60">Qty otomatis disamakan dengan cup</p>
                        </div>
                      </label>
                      
                      {modalIncludeLid && (
                        <div className="pl-8 animate-in slide-in-from-top-1">
                          <CustomSelect 
                            value={modalLidProduct}
                            onChange={(e) => setModalLidProduct(e.target.value)}
                            options={lidProducts.map(p => ({ value: p.id, label: p.name }))}
                            placeholder="-- Pilih Jenis Tutup --"
                            className="w-full text-sm"
                            menuPosition="static"
                          />
                        </div>
                      )}
                    </div>
                  )}

                </div>
              )}
            </div>

            <div className="p-4 border-t border-white/10 bg-black/60 backdrop-blur-3xl">
              <button 
                onClick={handleAddToCart}
                disabled={!modalProduct || !isModalQtyValid || (modalIncludeLid && !modalLidProduct)}
                className="w-full bg-primary text-primary-foreground py-4 rounded-xl font-black text-lg hover:bg-primary/90 transition-transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_20px_rgba(var(--primary),0.3)] disabled:shadow-none flex items-center justify-center gap-2"
              >
                <Plus className="w-5 h-5" />
                Tambah ke Keranjang
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. FLOATING CART BUTTON */}
      {cart.length > 0 && !isCartOpen && (
        <button 
          onClick={() => setIsCartOpen(true)}
          className="fixed bottom-6 right-6 z-40 bg-primary text-primary-foreground p-4 rounded-full shadow-[0_10px_40px_rgba(var(--primary),0.5)] hover:scale-110 active:scale-95 transition-all animate-bounce"
        >
          <div className="relative">
            <ShoppingCart className="w-7 h-7" />
            <span className="absolute -top-3 -right-3 bg-red-500 text-white text-xs font-black w-6 h-6 rounded-full flex items-center justify-center border-2 border-primary">
              {cart.length}
            </span>
          </div>
        </button>
      )}

      {/* 5. CART SIDEBAR (DRAWER) */}
      {isCartOpen && (
        <>
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[90] animate-in fade-in duration-300" onClick={() => setIsCartOpen(false)} />
          <div className="fixed top-0 right-0 h-full w-full max-w-md bg-black/90 backdrop-blur-3xl border-l border-white/10 z-[100] flex flex-col animate-in slide-in-from-right duration-300 shadow-2xl">
            
            {/* Header */}
            <div className="p-6 border-b border-white/10 flex justify-between items-center bg-white/5">
              <h2 className="text-xl font-black flex items-center gap-3">
                <ShoppingCart className="w-6 h-6 text-primary" />
                Keranjang Belanja
              </h2>
              <button onClick={() => setIsCartOpen(false)} className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Cart Items */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
              {cart.length === 0 ? (
                <div className="text-center text-foreground/50 py-10">Keranjang kosong.</div>
              ) : (
                cart.map((item, index) => {
                  const product = products.find(p => p.id === item.productId)
                  const price = calculateItemPrice(item)
                  return (
                    <div key={item.id} className="bg-white/5 border border-white/10 p-4 rounded-2xl relative group">
                      <button onClick={() => handleRemoveItem(item.id)} className="absolute top-2 right-2 w-8 h-8 text-foreground/40 hover:text-red-500 hover:bg-red-500/10 rounded-full flex items-center justify-center transition-all">
                        <X className="w-4 h-4" />
                      </button>
                      <p className="font-bold pr-8 leading-tight mb-2">{product?.name}</p>
                      <div className="flex flex-wrap gap-2 mb-3">
                        <span className="px-2 py-0.5 bg-primary/10 text-primary rounded-md text-[10px] font-black tracking-wider uppercase">{item.type}</span>
                        {item.type === 'PRINTING' && <span className="px-2 py-0.5 bg-blue-500/10 text-blue-400 rounded-md text-[10px] font-bold">{item.printingColors}</span>}
                        {item.isTwoColor && <span className="px-2 py-0.5 bg-yellow-500/10 text-yellow-500 rounded-md text-[10px] font-bold">2 Warna</span>}
                        {item.isFastTrack && <span className="px-2 py-0.5 bg-green-500/10 text-green-500 rounded-md text-[10px] font-bold">Fast Track</span>}
                        <span className="px-2 py-0.5 bg-white/10 text-foreground/80 rounded-md text-[10px] font-bold">{item.qty} pcs</span>
                      </div>
                      <div className="flex justify-between items-end mt-2 pt-2 border-t border-white/5">
                        <span className="text-[10px] text-foreground/50 font-mono">{formatRp(price)}/pcs</span>
                        <span className="font-black text-primary">{formatRp(price * item.qty)}</span>
                      </div>
                    </div>
                  )
                })
              )}

              {/* Addons */}
              {cart.length > 0 && (
                <div className="mt-8 border-t border-white/10 pt-6">
                  <h3 className="font-bold text-sm mb-3 text-foreground/80">Layanan Tambahan (Opsional)</h3>
                  <div className="space-y-2">
                    <label className="flex items-center gap-3 cursor-pointer p-3 rounded-xl border border-white/10 hover:bg-white/5 transition-colors">
                      <input type="checkbox" className="w-5 h-5 rounded border-gray-300 text-primary focus:ring-primary" checked={isDesignService} onChange={(e) => setIsDesignService(e.target.checked)} />
                      <div className="flex-1 flex justify-between items-center">
                        <div>
                          <p className="font-bold text-sm">Jasa Desain Logo</p>
                          <p className="text-[10px] text-foreground/50">Buat desain dari nol</p>
                        </div>
                        <span className="text-primary font-bold text-xs">+50k</span>
                      </div>
                    </label>
                  </div>
                </div>
              )}
            </div>

            {/* Footer / Checkout */}
            {cart.length > 0 && (
              <div className="p-6 bg-black/80 border-t border-white/10 backdrop-blur-xl">
                <div className="flex justify-between items-center mb-4">
                  <span className="text-foreground/60 text-sm font-bold">Subtotal</span>
                  <span className="text-2xl font-black text-primary">{formatRp(totals.grandTotal)}</span>
                </div>
                <button 
                  onClick={() => setShowCheckoutModal(true)}
                  className="w-full bg-primary text-primary-foreground py-4 rounded-xl font-black text-lg hover:bg-primary/90 transition-transform active:scale-95 shadow-[0_0_20px_rgba(var(--primary),0.3)] flex justify-center items-center gap-2"
                >
                  Checkout Sekarang
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            )}
          </div>
        </>
      )}

      {/* 6. MODAL CHECKOUT */}
      {showCheckoutModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[110] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-black/90 backdrop-blur-3xl border border-white/10 w-full max-w-md rounded-3xl shadow-2xl p-8 relative animate-in zoom-in-95 duration-200">
            <button onClick={() => setShowCheckoutModal(false)} className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20">✕</button>
            
            <h2 className="text-2xl font-black mb-1">Data Pemesan</h2>
            <p className="text-sm text-foreground/60 mb-6">Langkah terakhir! Masukkan detail Anda untuk membuat invoice.</p>

            <form onSubmit={(e) => {
              handleCheckout(e);
              setShowCheckoutModal(false);
              setIsCartOpen(false);
            }}>
              <div className="space-y-4 mb-8">
                <div>
                  <label className="block text-sm font-bold mb-2 text-foreground/80">Nama Brand / Usaha</label>
                  <input 
                    type="text" 
                    required 
                    placeholder="Contoh: Kopi Nangkring"
                    className="w-full p-4 bg-black/40 border border-white/10 rounded-xl focus:ring-2 focus:ring-primary/50 outline-none text-base"
                    value={brandName}
                    onChange={e => setBrandName(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold mb-2 text-foreground/80">Nomor WhatsApp</label>
                  <input 
                    type="tel" 
                    required 
                    placeholder="08xxxx"
                    className="w-full p-4 bg-black/40 border border-white/10 rounded-xl focus:ring-2 focus:ring-primary/50 outline-none text-base font-mono"
                    value={waNumber}
                    onChange={e => setWaNumber(e.target.value)}
                  />
                </div>
              </div>

              <button 
                type="submit" 
                disabled={isSubmitting}
                className="w-full bg-primary text-primary-foreground py-4 rounded-xl font-black text-lg hover:bg-primary/90 transition-transform active:scale-95 disabled:opacity-50 flex justify-center items-center shadow-[0_0_20px_rgba(var(--primary),0.3)]"
              >
                {isSubmitting ? 'Memproses...' : 'Buat Invoice & Pesan'}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
