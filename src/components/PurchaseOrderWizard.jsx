'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronRight, CheckCircle2, ShoppingBag, CreditCard, Plus, Trash2, ArrowLeft, Loader2, PackageOpen } from 'lucide-react'
import { createPurchaseOrder, updatePurchaseOrder } from '@/app/dashboard/purchases/new/actions'
import CustomSelect from '@/components/CustomSelect'
import CustomDatePicker from '@/components/CustomDatePicker'

export default function PurchaseOrderWizard({ suppliers, products, workshops, initialData, dropdownConfig = {} }) {
  const router = useRouter()
  const [currentTab, setCurrentTab] = useState(1)
  const [localSuppliers, setLocalSuppliers] = useState(suppliers || [])
  const [showAddSupplier, setShowAddSupplier] = useState(false)
  const [newSupplierName, setNewSupplierName] = useState("")
  const [newSupplierContact, setNewSupplierContact] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  // Tab 1: Info Umum
  const [poDate, setPoDate] = useState(initialData?.date || new Date().toISOString().split('T')[0])
  const [supplierId, setSupplierId] = useState(initialData?.supplier || '')
  const [notes, setNotes] = useState(initialData?.notes || '')

  // Tab 2: Detail Pembelian
  const [items, setItems] = useState(initialData?.items && initialData.items.length > 0 ? initialData.items : [
    { id: Date.now(), workshop_id: '', category: '', product_id: '', qty: 1, unit: 'Pcs', unit_cost: 0 }
  ])

  // Tab 3: Pembayaran
  const [paymentStatus, setPaymentStatus] = useState(initialData?.status || 'TEMPO')
  const [paymentAccount, setPaymentAccount] = useState(initialData?.payment_method || '')

  const getCategoriesForWorkshop = (wsId) => {
    if (!wsId) return [];
    const wsCode = workshops.find(w => w.id === wsId)?.code;
    return [...new Set(products.filter(p => p.workshop_code === wsCode).map(p => p.category).filter(Boolean))]
  }

  const handleSupplierChange = (e) => {
    setSupplierId(e.target.value)
  }

  const handleNextTab1 = () => {
    const suppExists = localSuppliers.find(s => s.id === supplierId || s.supplier_name === supplierId)
    if (!suppExists && supplierId.trim() !== '') {
      setNewSupplierName(supplierId)
      setShowAddSupplier(true)
    } else {
      setCurrentTab(2)
    }
  }

  const handleAddSupplier = () => {
    const newSupp = {
      id: Date.now().toString(),
      supplier_code: 'SUPP-' + Math.floor(Math.random() * 10000),
      supplier_name: newSupplierName,
      contact_person: newSupplierContact
    }
    setLocalSuppliers([...localSuppliers, newSupp])
    setSupplierId(newSupp.supplier_name)
    setShowAddSupplier(false)
    setCurrentTab(2)
  }

  const calculateTotal = () => {
    return items.reduce((sum, item) => sum + (Number(item.qty) * Number(item.unit_cost)), 0)
  }

  const grandTotal = calculateTotal()

  const formatRp = (val) => {
    if (val === undefined || val === null || val === '') return ''
    const num = val.toString().replace(/[^0-9]/g, '')
    return Number(num).toLocaleString('id-ID')
  }

  const parseRp = (val) => {
    if (!val) return 0
    return Number(val.toString().replace(/[^0-9]/g, ''))
  }

  const handleAddItem = () => {
    setItems([...items, { id: Date.now(), workshop_id: '', category: '', product_id: '', product_search: '', qty: 1, unit: 'Pcs', unit_cost: 0 }])
  }

  const handleRemoveItem = (id) => {
    if (items.length > 1) {
      setItems(items.filter(item => item.id !== id))
    }
  }

  const handleItemChange = (id, field, value) => {
    setItems(prevItems => prevItems.map(item => {
      if (item.id === id) {
        const updated = { ...item, [field]: value }
        
        if (field === 'workshop_id') {
          updated.category = ''
          updated.product_id = ''
          updated.product_search = ''
          updated.unit_cost = 0
        } else if (field === 'category') {
          updated.product_id = ''
          updated.product_search = ''
          updated.unit_cost = 0
        } else if (field === 'product_search') {
          updated.product_search = value
          const selectedProduct = products.find(p => p.name === value)
          if (selectedProduct) {
            updated.product_id = selectedProduct.product_code
            updated.unit_cost = selectedProduct.base_price || 0
          } else {
            updated.product_id = ''
            updated.unit_cost = 0
          }
        }
        return updated
      }
      return item
    }))
  }

  const handleSubmit = async () => {
    if (!supplierId) return setError("Pilih supplier terlebih dahulu.")
    if (items.some(i => !i.product_id)) {
      return setError("Pastikan semua baris item produk sudah dipilih.")
    }
    if (paymentStatus === 'LUNAS' && !paymentAccount) {
      return setError("Jika dibayar Lunas, Anda harus memilih Akun Kas/Bank.")
    }

    setLoading(true)
    setError(null)
    
    try {
      const payload = {
        supplierId,
        poDate,
        notes,
        paymentStatus,
        paymentAccount,
        grandTotal,
        items: items.map(item => ({
          ...item,
          workshop_code: workshops.find(w => w.id === item.workshop_id)?.code || null
        }))
      }

      let result;
      if (initialData?.id) {
        result = await updatePurchaseOrder(initialData.id, payload)
      } else {
        result = await createPurchaseOrder(payload)
      }
      
      if (result.success) {
        alert(initialData ? `Purchase Order berhasil diperbarui!` : `Purchase Order (Kulakan) dengan nomor ${result.po_number} berhasil dibuat!`)
        router.push('/dashboard/purchases')
      } else {
        setError(result.error || "Gagal menyimpan PO.")
      }
    } catch (err) {
      setError("Gagal menghubungi server.")
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const StepIndicator = ({ step, current, icon: Icon, title }) => (
    <div className={`flex flex-col items-center gap-2 ${current >= step ? 'text-primary' : 'text-foreground/30'}`}>
      <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-colors ${current >= step ? 'border-primary bg-primary/10' : 'border-white/10 bg-white/5'}`}>
        <Icon className="w-5 h-5" />
      </div>
      <span className="text-[10px] font-bold uppercase tracking-wider">{title}</span>
    </div>
  )

  return (
    <div className="max-w-4xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* Header & Stepper */}
      <div className="mb-8 flex items-center justify-between">
        <button onClick={() => router.back()} className="flex items-center gap-2 text-foreground/60 hover:text-primary transition-colors text-sm">
          <ArrowLeft className="w-4 h-4" /> Kembali
        </button>
        <h1 className="text-2xl font-bold text-foreground">{initialData ? 'Edit Purchase Order (PO)' : 'Buat Purchase Order (PO)'}</h1>
        <div className="w-20" />
      </div>

      <div className="flex items-center justify-between mb-8 relative">
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 bg-white/5 -z-10 rounded-full" />
        <div className={`absolute left-0 top-1/2 -translate-y-1/2 h-1 bg-primary -z-10 rounded-full transition-all duration-300 ${
          currentTab === 1 ? 'w-[15%]' : currentTab === 2 ? 'w-[50%]' : 'w-full'
        }`} />

        <StepIndicator step={1} current={currentTab} icon={PackageOpen} title="Info Supplier" />
        <StepIndicator step={2} current={currentTab} icon={ShoppingBag} title="Barang Masuk" />
        <StepIndicator step={3} current={currentTab} icon={CreditCard} title="Pembayaran" />
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
            <h2 className="text-xl font-bold text-primary mb-4">Pilih Supplier</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground/80">Tanggal PO</label>
                <CustomDatePicker value={poDate} onChange={setPoDate} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground/80">Supplier (Vendor)</label>
                <div className="relative">
                  <CustomSelect 
                    value={supplierId} 
                    onChange={e => {
                      setSupplierId(e.target.value);
                      handleSupplierChange({ target: { value: e.target.value } });
                    }}
                    options={[
                      { value: "", label: "Pilih Supplier..." },
                      ...localSuppliers.map(s => ({ value: s.supplier_name, label: `${s.supplier_name} - ${s.supplier_code}` }))
                    ]}
                    searchable={true}
                  />
                  <p className="text-xs text-foreground/40 mt-1">Jika supplier baru, ketik nama bebas lalu <button onClick={() => { setNewSupplierName(supplierId); setShowAddSupplier(true); }} className="text-primary hover:underline">Tambah Baru</button>.</p>
                </div>
              </div>
              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-medium text-foreground/80">Catatan Tambahan (Opsional)</label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)} className="glass-input w-full h-24" placeholder="Misal: Dikirim ke Gudang Pusat..." />
              </div>
            </div>
            <div className="flex justify-end pt-4 border-t border-white/5">
              <button onClick={handleNextTab1} className="btn-primary flex items-center gap-2">
                Lanjut Pilih Barang <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* TAB 2: DETAIL PEMBELIAN */}
        {currentTab === 2 && (
          <div className="space-y-6 animate-in fade-in">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-primary">Pembelian Barang</h2>
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
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                    <div className="space-y-1">
                      <label className="text-xs text-foreground/60 block">Workshop Tujuan</label>
                      <CustomSelect 
                        value={item.workshop_id} 
                        onChange={e => handleItemChange(item.id, 'workshop_id', e.target.value)} 
                        options={[
                          { value: "", label: "- Workshop -" },
                          ...workshops.filter(ws => ws.code === 'GUDANG' || ws.code === 'GLOBAL').map(ws => ({ value: ws.id, label: ws.name }))
                        ]}
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs text-foreground/60 block">Kategori</label>
                      {/* Notice we pass a disabled prop if workshop is not selected, but CustomSelect doesn't have disabled out of the box, we can just hide options */}
                      <CustomSelect 
                        value={item.category} 
                        onChange={e => handleItemChange(item.id, 'category', e.target.value)} 
                        options={[
                          { value: "", label: "- Kategori -" },
                          ...getCategoriesForWorkshop(item.workshop_id).map(c => ({ value: c, label: c }))
                        ]}
                      />
                    </div>

                    <div className="space-y-2 relative">
                      <label className="text-xs font-medium text-foreground/80">Pilih Bahan Baku</label>
                      <CustomSelect 
                        value={item.product_search} 
                        onChange={e => handleItemChange(item.id, 'product_search', e.target.value)} 
                        options={[
                          { value: "", label: "Ketik/Pilih Produk..." },
                          ...products.filter(p => p.workshop_code === workshops.find(w => w.id === item.workshop_id)?.code && p.category === item.category).map(p => ({ value: p.name, label: p.name }))
                        ]}
                        searchable={true}
                        disabled={!item.category}
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-medium text-foreground/80">Qty (Masuk)</label>
                      <input type="text" value={formatRp(item.qty)} onChange={e => handleItemChange(item.id, 'qty', parseRp(e.target.value))} className="glass-input w-full text-sm" />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs text-foreground/60 block">Satuan</label>
                      <CustomSelect 
                        value={item.unit} 
                        onChange={e => handleItemChange(item.id, 'unit', e.target.value)} 
                        options={(dropdownConfig.unit || ["Pcs", "Pack", "Roll"]).map(v => ({ value: v, label: v }))}
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-medium text-foreground/80">Harga Modal/Beli (Rp)</label>
                      <input type="text" value={formatRp(item.unit_cost)} onChange={e => handleItemChange(item.id, 'unit_cost', parseRp(e.target.value))} className="glass-input w-full text-sm" />
                    </div>
                  </div>
                  
                  <div className="mt-4 pt-4 border-t border-white/5 flex justify-between items-center text-sm">
                    <span className="text-foreground/60">Subtotal Modal:</span>
                    <span className="font-bold text-red-400 text-base">Rp {(Number(item.qty) * Number(item.unit_cost)).toLocaleString('id-ID')}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-between pt-4 border-t border-white/5">
              <button onClick={() => setCurrentTab(1)} className="btn-secondary flex items-center gap-2">
                 Kembali
              </button>
              <button onClick={() => setCurrentTab(3)} className="btn-primary flex items-center gap-2">
                Lanjut Pembayaran <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* TAB 3: PEMBAYARAN */}
        {currentTab === 3 && (
          <div className="space-y-6 animate-in fade-in">
            <h2 className="text-xl font-bold text-primary mb-4">Sistem Pembayaran</h2>
            
            <div className="p-6 rounded-xl bg-red-500/10 border border-red-500/20 flex flex-col md:flex-row items-center justify-between gap-4">
              <div>
                <p className="text-sm text-red-400 font-medium">Total Beban Tagihan (Kulakan)</p>
                <p className="text-3xl font-bold text-red-500 mt-1">Rp {grandTotal.toLocaleString('id-ID')}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground/80">Status Pembayaran</label>
                <CustomSelect 
                  value={paymentStatus} 
                  onChange={e => setPaymentStatus(e.target.value)} 
                  options={(dropdownConfig.payment_status_po || ["TEMPO", "LUNAS"]).map(v => ({ value: v, label: v === "TEMPO" ? "Hutang / Tempo" : v === "LUNAS" ? "Dibayar Lunas" : v }))}
                />
                {paymentStatus === 'TEMPO' && <p className="text-xs text-yellow-400 mt-1">Hutang akan tercatat dan dapat dilunasi di menu Dashboard / Transaksi.</p>}
              </div>

              {paymentStatus === 'LUNAS' && (
                <div className="space-y-2 animate-in fade-in">
                  <label className="text-sm font-medium text-foreground/80">Ambil Uang Dari Kas/Bank</label>
                  <CustomSelect 
                    value={paymentAccount} 
                    onChange={e => setPaymentAccount(e.target.value)} 
                    options={[
                      { value: "", label: "- Pilih Akun (Kas/Bank) -" },
                      ...(dropdownConfig.payment_method || ["BCA", "CASH", "MANDIRI"]).map(v => ({ value: v, label: v }))
                    ]}
                  />
                  <p className="text-xs text-red-400 mt-1">Otomatis mencatat Mutasi KELUAR di Buku Besar.</p>
                </div>
              )}
            </div>

            <div className="flex justify-between pt-8 border-t border-white/5">
              <button onClick={() => setCurrentTab(2)} className="btn-secondary flex items-center gap-2">
                 Kembali
              </button>
              <button onClick={handleSubmit} disabled={loading} className="btn-primary flex items-center gap-2 px-8 bg-red-500 hover:bg-red-600 text-white border-none shadow-[0_0_20px_rgba(239,68,68,0.4)]">
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
                {loading ? 'Memproses...' : 'Proses Kulakan (PO)'}
              </button>
            </div>
          </div>
        )}

      </div>
      {showAddSupplier && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-background border border-white/10 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="p-4 border-b border-white/10 bg-white/5">
              <h3 className="font-bold text-foreground">Tambah Supplier Baru</h3>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-foreground/60">Supplier <b>{newSupplierName}</b> tidak ditemukan. Tambahkan sebagai supplier baru?</p>
              <div className="space-y-2">
                <label className="text-xs font-medium text-foreground/80">Nama Supplier</label>
                <input type="text" value={newSupplierName} onChange={e => setNewSupplierName(e.target.value)} className="glass-input w-full" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-foreground/80">Kontak Person / No HP</label>
                <input type="text" value={newSupplierContact} onChange={e => setNewSupplierContact(e.target.value)} className="glass-input w-full" />
              </div>
            </div>
            <div className="p-4 border-t border-white/10 flex justify-end gap-3 bg-white/5">
              <button onClick={() => setShowAddSupplier(false)} className="btn-secondary px-4 h-10 text-sm">Batal</button>
              <button onClick={handleAddSupplier} className="btn-primary px-4 h-10 text-sm">Simpan & Lanjut</button>
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
