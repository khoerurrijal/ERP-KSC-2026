'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronRight, CheckCircle2, User, ShoppingCart, CreditCard, Plus, Trash2, ArrowLeft, Loader2, Save } from 'lucide-react'
import CustomSelect from '@/components/CustomSelect'
import CustomDatePicker from '@/components/CustomDatePicker'
import { createSalesOrder, updateSalesOrder } from '@/app/actions/sales'

export default function SalesOrderWizard({ customers, products, workshops, initialData, dropdownConfig = {}, matrix = {} }) {
  const router = useRouter()
  const [currentTab, setCurrentTab] = useState(1)
  const [localCustomers, setLocalCustomers] = useState(customers || [])
  const [showAddCustomer, setShowAddCustomer] = useState(false)
  const [newCustomerName, setNewCustomerName] = useState("")
  const [newCustomerPhone, setNewCustomerPhone] = useState("")
  const [newCustomerType, setNewCustomerType] = useState("Umum")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const [orderDate, setOrderDate] = useState(initialData?.date || new Date().toISOString().split('T')[0])
  const [customerId, setCustomerId] = useState(initialData?.customer_code || '')
  const [isMarketplace, setIsMarketplace] = useState(initialData?.marketplace_receipt ? true : false)
  const [marketplaceReceipt, setMarketplaceReceipt] = useState(initialData?.marketplace_receipt || '')
  const [notes, setNotes] = useState(initialData?.notes || '')

  const handleCustomerChange = (e) => {
    const val = e.target.value
    setCustomerId(val)
    const cust = localCustomers.find(c => c.customer_code === val || c.name === val)
    if (cust && (cust.type === 'Marketplace' || cust.type === 'Shopee' || cust.type === 'Tokopedia')) {
      setIsMarketplace(true)
      setDpAmount(0)
    } else {
      setIsMarketplace(false)
      setMarketplaceReceipt('')
    }
  }

  const handleNextTab1 = () => {
    const custExists = localCustomers.find(c => c.customer_code === customerId)
    if (!custExists && customerId.trim() !== '') {
      setNewCustomerName(customerId)
      setShowAddCustomer(true)
    } else {
      setCurrentTab(2)
    }
  }

  const handleAddCustomer = () => {
    const newCust = {
      id: Date.now().toString(),
      customer_code: 'CUST-' + Math.floor(Math.random() * 10000),
      name: newCustomerName,
      phone: newCustomerPhone,
      type: newCustomerType
    }
    setLocalCustomers([...localCustomers, newCust])
    setCustomerId(newCust.customer_code)
    setShowAddCustomer(false)
    setNewCustomerName('')
    setCurrentTab(2)
  }

  // Tab 2: Detail Pesanan
  const [items, setItems] = useState(initialData?.items?.length > 0 
    ? initialData.items.map((i, idx) => ({
        id: i.id || Date.now() + idx,
        order_type: i.order_type || '',
        category: products.find(p => p.product_code === i.product_code)?.category || '',
        product_id: i.product_code || '',
        product_search: products.find(p => p.product_code === i.product_code)?.name || '',
        workshop_id: workshops.find(w => w.code === products.find(p => p.product_code === i.product_code)?.workshop_code)?.id || '',
        qty: i.qty || 1,
        unit: i.unit || 'PCS',
        unit_multiplier: i.unit_multiplier || 1,
        price: i.unit_price || 0
      }))
    : [{ id: Date.now(), order_type: '', category: '', product_id: '', product_search: '', workshop_id: '', qty: 1, unit: 'PCS', unit_multiplier: 1, price: 0 }]
  )

  // Tab 3: Pembayaran
  const [dpAmount, setDpAmount] = useState(Number(initialData?.dp_amount || 0))
  const [paymentAccount, setPaymentAccount] = useState(initialData?.payment_method || '')

  const formatRp = (val) => {
    if (val === undefined || val === null || val === '') return ''
    const num = val.toString().replace(/[^0-9]/g, '')
    return Number(num).toLocaleString('id-ID')
  }

  const parseRp = (val) => {
    if (!val) return 0
    return Number(val.toString().replace(/[^0-9]/g, ''))
  }

  // Derived state
  const getCategoriesForItem = (orderType) => {
    if (!orderType) return []
    const mapping = dropdownConfig.category_mapping || {}
    if (mapping[orderType] && mapping[orderType].length > 0) {
      return mapping[orderType]
    }
    // Fallback: semua kategori
    return [...new Set(products.map(p => p.category).filter(Boolean))]
  }
  
  const calculateTotal = () => {
    return items.reduce((sum, item) => sum + (Number(item.qty) * Number(item.price)), 0)
  }

  const grandTotal = calculateTotal()
  const remaining = grandTotal - dpAmount

  const handleAddItem = () => {
    setItems([...items, { id: Date.now(), order_type: '', category: '', product_id: '', product_search: '', workshop_id: '', qty: 1, unit: 'PCS', unit_multiplier: 1, price: 0 }])
  }

  const handleRemoveItem = (id) => {
    if (items.length > 1) {
      setItems(items.filter(item => item.id !== id))
    }
  }

  const handleItemChange = (id, field, value) => {
    setItems(items.map(item => {
      if (item.id === id) {
        const updated = { ...item, [field]: value }
        if (field === 'order_type') {
          updated.category = ''
          updated.product_id = ''
          updated.product_search = ''
          updated.price = 0
        }
        if (field === 'category') {
          updated.product_id = '' // reset product when category changes
          updated.product_search = ''
          updated.price = 0
        }
        // Auto-fill price and workshop_id if product changes
        if (field === 'product_search') {
          updated.product_search = value
          const selectedProduct = products.find(p => p.name === value)
          if (selectedProduct) {
            updated.product_id = selectedProduct.product_code
            updated.workshop_id = selectedProduct.workshop_id || ''
            updated.unit = 'PCS'
            updated.unit_multiplier = 1
          } else {
            updated.product_id = ''
            updated.price = 0
            updated.workshop_id = ''
            updated.unit = 'PCS'
            updated.unit_multiplier = 1
          }
        } else if (field === 'unit') {
          updated.unit = value
          const selectedProduct = products.find(p => p.name === updated.product_search)
          if (selectedProduct && selectedProduct.product_units) {
             const pu = selectedProduct.product_units.find(u => u.unit_name === value)
             updated.unit_multiplier = pu ? pu.multiplier : 1
          } else {
             updated.unit_multiplier = 1
          }
        }
        
        // RECALCULATE PRICE IF RELEVANT FIELDS CHANGE
        if (['qty', 'product_search', 'order_type', 'category', 'unit'].includes(field)) {
          const selectedProduct = products.find(p => p.name === updated.product_search)
          if (selectedProduct) {
            let basePrice = selectedProduct.price_polos || 0
            if (updated.order_type === 'SABLON' || updated.order_type === 'Sablon') {
               let currentSablonFee = 0
               const qty = updated.qty || 1
               const cat = updated.category
               if (cat && matrix[cat]) {
                 const tierMatrix = matrix[cat]
                 if (qty >= 10000 && tierMatrix.min_10000 > 0) currentSablonFee = tierMatrix.min_10000
                 else if (qty >= 5000 && tierMatrix.min_5000 > 0) currentSablonFee = tierMatrix.min_5000
                 else if (qty >= 1000 && tierMatrix.min_1000 > 0) currentSablonFee = tierMatrix.min_1000
                 else if (qty >= 500 && tierMatrix.min_500 > 0) currentSablonFee = tierMatrix.min_500
                 else if (qty >= 100 && tierMatrix.min_100 > 0) currentSablonFee = tierMatrix.min_100
                 else if (qty >= 10 && tierMatrix.min_10 > 0) currentSablonFee = tierMatrix.min_10
                 else if (tierMatrix.min_1 > 0) currentSablonFee = tierMatrix.min_1
                 else currentSablonFee = tierMatrix.min_1000 || 250
               } else {
                 currentSablonFee = 250 // fallback
               }
               basePrice += currentSablonFee
            }
            updated.price = basePrice * updated.unit_multiplier
          }
        }
        
        return updated
      }
      return item
    }))
  }

  const handleSubmit = async () => {
    if (!customerId) return setError("Pilih pelanggan terlebih dahulu.")
    if (items.some(i => !i.product_id || !i.order_type)) {
      return setError("Pastikan Jenis Pesanan dan Produk sudah dipilih.")
    }

    setLoading(true)
    setError(null)
    
    try {
      
      const selectedCustomer = localCustomers.find(c => c.customer_code === customerId)
      if (!selectedCustomer) {
        setLoading(false)
        return setError("Pelanggan tidak ditemukan. Silakan tambahkan di menu Master Data terlebih dahulu.")
      }
      
      const payload = {
        customerId: selectedCustomer.customer_code,
        orderDate,
        notes,
        items,
        dpAmount,
        paymentAccount,
        marketplaceReceipt
      }

      let result;
      if (initialData?.id) {
        result = await updateSalesOrder(initialData.id, payload)
      } else {
        result = await createSalesOrder(payload)
      }
      
      if (result.success) {
        alert(initialData ? `Pesanan berhasil diupdate!` : `Pesanan berhasil dibuat!`)
        router.push('/dashboard/sales')
      } else {
        setError(result.error || "Terjadi kesalahan saat menyimpan data.")
      }
    } catch (err) {
      setError("Gagal menghubungi server.")
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* Header & Stepper */}
      <div className="mb-8 flex items-center justify-between">
        <button onClick={() => router.back()} className="flex items-center gap-2 text-foreground/60 hover:text-primary transition-colors text-sm">
          <ArrowLeft className="w-4 h-4" /> Kembali
        </button>
        <h1 className="text-2xl font-bold text-foreground">{initialData ? 'Edit Sales Order' : 'Buat Sales Order'}</h1>
        <div className="w-20" /> {/* Spacer */}
      </div>

      <div className="flex items-center justify-between mb-8 relative">
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 bg-white/5 -z-10 rounded-full" />
        <div className={`absolute left-0 top-1/2 -translate-y-1/2 h-1 bg-primary -z-10 rounded-full transition-all duration-300 ${
          initialData ? 'w-full' : (currentTab === 1 ? 'w-[15%]' : currentTab === 2 ? 'w-[50%]' : 'w-full')
        }`} />

        <StepIndicator step={1} current={initialData ? 3 : currentTab} icon={User} title="Info Umum" />
        <StepIndicator step={2} current={initialData ? 3 : currentTab} icon={ShoppingCart} title="Detail Pesanan" />
        { !initialData && <StepIndicator step={3} current={currentTab} icon={CreditCard} title="Pembayaran" /> }
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-sm">
          {error}
        </div>
      )}

      {/* TABS */}
      <div className="glass-card p-6 md:p-8">
        
        {/* TAB 1: INFO UMUM */}
        {currentTab === 1 && (
          <div className="space-y-6 animate-in fade-in">
            <h2 className="text-xl font-bold text-primary mb-4">Informasi Pelanggan & Nota</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground/80">Tanggal Pemesanan</label>
                <CustomDatePicker value={orderDate} onChange={setOrderDate} />
              </div>
              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-medium text-foreground/80">Nama / Brand</label>
                <div className="relative">
                  <CustomSelect 
                    value={customerId} 
                    onChange={e => {
                      setCustomerId(e.target.value);
                      handleCustomerChange({ target: { value: e.target.value } });
                    }}
                    options={[
                      { value: "", label: "Pilih Pelanggan..." },
                      ...localCustomers.map(c => ({ value: c.customer_code, label: `${c.name} - ${c.customer_code} (${c.type})` }))
                    ]}
                    searchable={true}
                  />
                </div>
                <p className="text-xs text-foreground/40 mt-1">Jika pelanggan baru, ketik nama bebas lalu <button onClick={() => { setNewCustomerName(customerId); setShowAddCustomer(true); }} className="text-primary hover:underline">Tambah Baru</button>.</p>
              </div>
              {isMarketplace && (
                <div className="space-y-2 md:col-span-2">
                  <label className="text-sm font-medium text-yellow-400">Nomor Pesanan</label>
                  <input type="text" value={marketplaceReceipt} onChange={e => setMarketplaceReceipt(e.target.value)} className="glass-input w-full border-yellow-500/50 focus:border-yellow-500 bg-yellow-500/5" placeholder="Contoh: 230612ABCDEFGH..." />
                </div>
              )}
              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-medium text-foreground/80">Catatan Tambahan (Opsional)</label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)} className="glass-input w-full h-24" placeholder="Misal: Dikirim pakai gobox, dsb..." />
              </div>
            </div>
            <div className="flex justify-end pt-4 border-t border-white/5">
              <button onClick={handleNextTab1} className="btn-primary flex items-center gap-2">
                Lanjut ke Detail Pesanan <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* TAB 2: DETAIL PESANAN */}
        {currentTab === 2 && (
          <div className="space-y-6 animate-in fade-in">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-primary">Detail Item Pesanan</h2>
              <button onClick={handleAddItem} className="btn-secondary text-sm px-4 h-9 flex items-center gap-2">
                <Plus className="w-4 h-4" /> Tambah Item
              </button>
            </div>

            <div className="space-y-4">
              {items.map((item, index) => (
                <div key={item.id} className="p-4 rounded-xl border border-white/10 bg-white/5 relative group">
                  {items.length > 1 && (
                    <button onClick={() => handleRemoveItem(item.id)} className="absolute top-4 right-4 text-red-400 opacity-50 hover:opacity-100 transition-opacity">
                      <Trash2 className="w-5 h-5" />
                    </button>
                  )}
                  <h3 className="text-sm font-semibold mb-4 text-foreground/60">Item #{index + 1}</h3>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    {/* Urutan 1: Jenis Pesanan */}
                    <div className="md:col-span-2">
                      <label className="text-xs font-medium text-foreground/60 mb-1 block">Jenis Pesanan</label>
                      <CustomSelect 
                        value={item.order_type} 
                        onChange={e => handleItemChange(item.id, 'order_type', e.target.value)} 
                        options={[
                          { value: "", label: "- Pilih -" },
                          ...Array.from(new Set([...(dropdownConfig.order_type || ["SABLON", "POLOS"])])).map(v => ({ value: v, label: v }))
                        ]} 
                      />
                    </div>
                    
                    <div className="space-y-1">
                      <label className="text-xs text-foreground/60 block">Kategori</label>
                      <CustomSelect 
                        value={item.category} 
                        onChange={e => handleItemChange(item.id, 'category', e.target.value)} 
                        options={[
                          { value: "", label: "Semua Kategori" },
                          ...getCategoriesForItem(item.order_type).map(c => ({ value: c, label: c }))
                        ]}
                        disabled={!item.order_type}
                      />
                    </div>

                    {/* Urutan 3: Ukuran/Produk */}
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-foreground/80">Ukuran / Produk</label>
                      <CustomSelect 
                        value={item.product_search} 
                        onChange={e => handleItemChange(item.id, 'product_search', e.target.value)} 
                        options={[
                          { value: "", label: "Ketik/Pilih Produk..." },
                          ...products.filter(p => p.category === item.category).map(p => ({ value: p.name, label: p.name }))
                        ]}
                        searchable={true}
                        disabled={!item.category}
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-medium text-foreground/80">Qty</label>
                      <input type="text" value={formatRp(item.qty)} onChange={e => handleItemChange(item.id, 'qty', parseRp(e.target.value))} className="glass-input w-full text-sm px-2" />
                    </div>

                    <div className="space-y-1 col-span-2">
                      <label className="text-xs text-foreground/60 block">Satuan</label>
                      <CustomSelect 
                        value={item.unit} 
                        onChange={e => handleItemChange(item.id, 'unit', e.target.value)} 
                        options={(() => {
                          const p = products.find(prod => prod.name === item.product_search)
                          const base = [{ value: 'PCS', label: 'PCS' }]
                          if (item.order_type !== 'SABLON' && item.order_type !== 'Sablon' && p && p.product_units && p.product_units.length > 0) {
                            return [...base, ...p.product_units.map(u => ({ value: u.unit_name, label: u.unit_name }))]
                          }
                          return base
                        })()}
                        disabled={item.order_type === 'SABLON' || item.order_type === 'Sablon' || !item.product_search}
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-medium text-foreground/80">Harga Satuan (Rp)</label>
                      <input type="text" value={formatRp(item.price)} onChange={e => handleItemChange(item.id, 'price', parseRp(e.target.value))} className="glass-input w-full text-sm" />
                    </div>
                  </div>
                  
                  <div className="mt-4 pt-4 border-t border-white/5 flex justify-between items-center text-sm">
                    <span className="text-foreground/60">Subtotal Item:</span>
                    <span className="font-bold text-primary text-base">Rp {(Number(item.qty) * Number(item.price)).toLocaleString('id-ID')}</span>
                  </div>
                  {item.order_type === 'Sablon' && (
                    <div className="mt-4 pt-4 border-t border-white/5 space-y-2">
                      <label className="text-xs font-medium text-foreground/80 truncate block">URL Mockup / Desain</label>
                      <input type="url" placeholder="https://..." value={item.mockup_url || ''} onChange={e => handleItemChange(item.id, 'mockup_url', e.target.value)} className="glass-input w-full text-sm text-blue-400" />
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="flex justify-between pt-4 border-t border-white/5">
              <button onClick={() => setCurrentTab(1)} className="btn-secondary flex items-center gap-2">
                 Kembali
              </button>
              {initialData ? (
                <button onClick={handleSubmit} disabled={loading} className="btn-primary flex items-center gap-2 px-8">
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                  {loading ? 'Menyimpan...' : 'Simpan Perubahan'}
                </button>
              ) : (
                <button onClick={() => setCurrentTab(3)} className="btn-primary flex items-center gap-2">
                  Lanjut Pembayaran <ChevronRight className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: PEMBAYARAN */}
        {currentTab === 3 && (
          <div className="space-y-6 animate-in fade-in">
            <h2 className="text-xl font-bold text-primary mb-4">Transaksi & Pembayaran</h2>
            
            <div className="p-6 rounded-xl bg-primary/10 border border-primary/20 flex flex-col md:flex-row items-center justify-between gap-4">
              <div>
                <p className="text-sm text-primary/80 font-medium">Grand Total Tagihan</p>
                <p className="text-3xl font-bold text-primary mt-1">Rp {grandTotal.toLocaleString('id-ID')}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-foreground/60">Total Item</p>
                <p className="text-xl font-semibold text-foreground">{items.length} Macam</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground/80">Jumlah Uang Muka (DP) / Dibayar (Rp)</label>
                <input type="text" value={formatRp(dpAmount)} onChange={e => setDpAmount(parseRp(e.target.value))} disabled={isMarketplace} className={`glass-input w-full text-lg font-semibold ${isMarketplace ? 'opacity-50 cursor-not-allowed' : ''}`} />
                {isMarketplace && <p className="text-xs text-yellow-400 mt-1">Pesanan Marketplace otomatis masuk piutang (Tempo) hingga pencairan dana.</p>}
              </div>

              {dpAmount > 0 && !isMarketplace && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground/80">Metode Pembayaran DP</label>
                  <CustomSelect 
                    value={paymentAccount} 
                    onChange={e => setPaymentAccount(e.target.value)} 
                    options={[
                      { value: "", label: "Pilih Rekening..." },
                      ...(dropdownConfig.payment_method || ["BCA", "MANDIRI", "CASH"]).map(v => ({ value: v, label: v }))
                    ]}
                  />
                </div>
              )}
            </div>

            <div className="p-4 rounded-xl border border-white/5 bg-white/5 mt-4">
              <div className="flex justify-between items-center text-sm">
                <span className="text-foreground/80">Sisa Tagihan (Kekurangan):</span>
                <span className={`font-bold text-lg ${remaining > 0 ? 'text-yellow-400' : 'text-green-400'}`}>
                  Rp {remaining.toLocaleString('id-ID')}
                </span>
              </div>
            </div>

            <div className="flex justify-between pt-8 border-t border-white/5">
              <button onClick={() => setCurrentTab(2)} className="btn-secondary flex items-center gap-2">
                 Kembali
              </button>
              <button onClick={handleSubmit} disabled={loading} className="btn-primary flex items-center gap-2 px-8">
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
                {loading ? 'Memproses...' : 'Simpan & Buat Pesanan'}
              </button>
            </div>
          </div>
        )}

      </div>
      {showAddCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-background border border-white/10 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="p-4 border-b border-white/10 bg-white/5">
              <h3 className="font-bold text-foreground">Tambah Pelanggan Baru</h3>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-foreground/60">Pelanggan <b>{newCustomerName}</b> tidak ditemukan. Apakah Anda ingin menambahkannya?</p>
              <div className="space-y-2">
                <label className="text-xs font-medium text-foreground/80">Nama / Brand</label>
                <input type="text" value={newCustomerName} onChange={e => setNewCustomerName(e.target.value)} className="glass-input w-full" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-foreground/80">No HP / WA</label>
                <input type="text" value={newCustomerPhone} onChange={e => setNewCustomerPhone(e.target.value)} className="glass-input w-full" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-foreground/60 block">Tipe Pelanggan</label>
                <CustomSelect 
                  value={newCustomerType} 
                  onChange={e => setNewCustomerType(e.target.value)} 
                  options={[
                    { value: "Umum", label: "Umum" },
                    { value: "Member", label: "Member" },
                    { value: "Grosir", label: "Grosir" }
                  ]}
                />
              </div>
            </div>
            <div className="p-4 border-t border-white/10 flex justify-end gap-3 bg-white/5">
              <button onClick={() => setShowAddCustomer(false)} className="btn-secondary px-4 h-10 text-sm">Batal</button>
              <button onClick={handleAddCustomer} className="btn-primary px-4 h-10 text-sm">Simpan & Lanjut</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function StepIndicator({ step, current, icon: Icon, title }) {
  const isCompleted = current > step
  const isActive = current === step
  
  return (
    <div className="flex flex-col items-center gap-2 z-10">
      <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 border-2 ${
        isActive ? 'bg-primary border-primary text-background shadow-[0_0_20px_rgba(212,175,55,0.4)]' : 
        isCompleted ? 'bg-primary/20 border-primary text-primary' : 
        'bg-background border-white/10 text-foreground/40'
      }`}>
        {isCompleted ? <CheckCircle2 className="w-6 h-6" /> : <Icon className="w-5 h-5" />}
      </div>
      <span className={`text-xs font-semibold ${isActive ? 'text-primary' : isCompleted ? 'text-foreground/80' : 'text-foreground/40'}`}>
        {title}
      </span>
    </div>
  )
}
