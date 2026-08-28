'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { CheckCircle2, Plus, Trash2, Loader2, X } from 'lucide-react'
import { createPurchaseOrder, updatePurchaseOrder, deletePurchaseOrder } from '@/app/dashboard/purchases/new/actions'
import CustomSelect from '@/components/CustomSelect'
import CustomDatePicker from '@/components/CustomDatePicker'

function SuggestField({ value, onChange, options, placeholder = 'Pilih...', disabled = false, allowCustom = false }) {
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const fieldRef = useRef(null)
  const listboxId = useId()
  const selectedOption = options.find(option => String(option.value) === String(value) && option.value !== '')

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (fieldRef.current && !fieldRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const openSuggestions = () => {
    if (disabled) return
    if (!isOpen) setQuery(selectedOption ? '' : allowCustom ? String(value || '') : '')
    setIsOpen(true)
  }

  const handleInputChange = (event) => {
    const nextValue = event.target.value
    setQuery(nextValue)
    if (allowCustom) onChange({ target: { value: nextValue } })
    setIsOpen(true)
  }

  const handleSelect = (optionValue) => {
    onChange({ target: { value: optionValue } })
    setQuery('')
    setIsOpen(false)
  }

  const filteredOptions = options.filter(option =>
    String(option.label).toLowerCase().includes(query.trim().toLowerCase())
  )
  const inputValue = isOpen
    ? query
    : selectedOption?.label || (allowCustom ? String(value || '') : '')

  return (
    <div ref={fieldRef} className="relative">
      <input
        type="text"
        value={inputValue}
        onFocus={openSuggestions}
        onChange={handleInputChange}
        placeholder={placeholder}
        disabled={disabled}
        role="combobox"
        aria-expanded={isOpen ? 'true' : 'false'}
        aria-controls={listboxId}
        aria-autocomplete="list"
        className={`glass-input h-10 w-full px-4 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/50 ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}
      />

      {isOpen && !disabled && (
        <div id={listboxId} role="listbox" className="absolute left-0 right-0 top-full z-[1120] mt-1 max-h-52 overflow-y-auto rounded-xl border border-card-border bg-background/95 p-1.5 shadow-2xl backdrop-blur-md">
          {filteredOptions.length === 0 ? (
            <div className="px-3 py-3 text-center text-xs text-foreground/40">Tidak ada hasil</div>
          ) : filteredOptions.map(option => (
            <button
              key={option.value || 'empty'}
              type="button"
              role="option"
              aria-selected={String(value) === String(option.value)}
              onClick={() => handleSelect(option.value)}
              className="flex w-full items-start rounded-lg px-3 py-2 text-left text-sm text-foreground/80 transition-colors hover:bg-foreground/10 hover:text-foreground"
            >
              <span className="whitespace-normal break-words">{option.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function PurchaseOrderWizard({ suppliers, products, workshops, initialData, dropdownConfig = {}, onClose, onSaved }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const requestedReturnTo = searchParams.get('from')
  const returnTo = requestedReturnTo && requestedReturnTo.startsWith('/') && !requestedReturnTo.startsWith('//')
    ? requestedReturnTo
    : '/purchases'
  const handleClose = () => {
    if (onClose) {
      onClose()
      return
    }
    router.replace(returnTo)
  }

  const handleSaved = () => {
    if (onSaved) {
      onSaved()
      return
    }
    router.push('/purchases')
  }
  const [localSuppliers, setLocalSuppliers] = useState(suppliers || [])
  const [showAddSupplier, setShowAddSupplier] = useState(false)
  const [newSupplierName, setNewSupplierName] = useState("")
  const [newSupplierContact, setNewSupplierContact] = useState("")
  const [loading, setLoading] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState(null)

  // Tab 1: Info Umum
  const [poDate, setPoDate] = useState(initialData?.date || new Date().toISOString().split('T')[0])
  const [supplierId, setSupplierId] = useState(initialData?.supplier || '')
  const [notes, setNotes] = useState(initialData?.notes || '')

  // Tab 2: Detail Pembelian
  const [items, setItems] = useState(initialData?.items && initialData.items.length > 0 ? initialData.items : [
    { id: Date.now(), workshop_id: '', category: '', product_id: '', product_search: '', qty: 1, unit: 'PCS', unit_multiplier: 1, unit_cost: 0 }
  ])

  // Tab 3: Pembayaran
  const [paymentStatus, setPaymentStatus] = useState(initialData?.status || 'TEMPO')
  const [paymentAccount, setPaymentAccount] = useState(initialData?.payment_method || '')

  const handleSupplierChange = (e) => {
    setSupplierId(e.target.value)
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
  }

  const calculateTotal = () => {
    return items.reduce((sum, item) => sum + (Number(item.qty) * Number(item.unit_multiplier) * Number(item.unit_cost)), 0)
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
    setItems([...items, { id: Date.now(), workshop_id: '', category: '', product_id: '', product_search: '', qty: 1, unit: 'PCS', unit_multiplier: 1, unit_cost: 0 }])
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
        } else if (field === 'product_search') {
          updated.product_search = value
          const selectedProduct = products.find(p => p.name === value)
          if (selectedProduct) {
            updated.category = selectedProduct.category || ''
            updated.product_id = selectedProduct.product_code
            updated.unit_cost = selectedProduct.base_price || 0
            updated.unit = 'PCS'
            updated.unit_multiplier = 1
          } else {
            updated.product_id = ''
            updated.unit_cost = 0
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
        return updated
      }
      return item
    }))
  }

  const handleSubmit = async () => {
    if (!supplierId) return setError("Pilih supplier terlebih dahulu.")
    const suppExists = localSuppliers.find(s => s.id === supplierId || s.supplier_name === supplierId)
    if (!suppExists && supplierId.trim() !== '') {
      setNewSupplierName(supplierId)
      setShowAddSupplier(true)
      return
    }
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
        handleSaved()
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

  const handleDelete = async () => {
    if (!initialData?.id || deleting) return
    if (!window.confirm('Hapus Purchase Order ini? Stok dan transaksi terkait akan ditarik kembali.')) return

    setDeleting(true)
    const result = await deletePurchaseOrder(initialData.id)
    if (result.success) {
      alert('Purchase Order berhasil dihapus.')
      if (onSaved) {
        onSaved()
      } else {
        handleClose()
      }
    } else {
      setError(result.error || 'Gagal menghapus PO.')
      setDeleting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[1100] bg-black/50 backdrop-blur-[2px]">
      <button
        type="button"
        aria-label="Tutup form Purchase Order"
        onClick={handleClose}
        className="absolute inset-0 cursor-default"
      />

      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="purchase-order-drawer-title"
        className="po-drawer-enter relative ml-auto flex h-full w-[92%] max-w-md flex-col border-l border-white/10 bg-background shadow-2xl will-change-transform sm:w-[80%] lg:w-[72%]"
      >
        <header className="flex items-center justify-between gap-3 border-b border-white/10 px-3 py-2.5 md:px-4">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-widest text-primary">Purchase Order</p>
            <h1 id="purchase-order-drawer-title" className="truncate text-base font-bold text-foreground md:text-lg">
              {initialData ? 'Edit Purchase Order (PO)' : 'Buat Purchase Order (PO)'}
            </h1>
          </div>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Tutup"
            className="rounded-lg p-2 text-foreground/60 transition-colors hover:bg-white/10 hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-2.5 md:p-3">
          {error && (
            <div className="mb-2 rounded-lg border border-red-500/20 bg-red-500/10 p-2.5 text-sm text-red-400">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <section className="rounded-xl border border-white/10 bg-white/5 p-2.5 md:p-3">
              <div className="mb-2 flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-primary">1. Supplier</p>
                  <h2 className="text-base font-bold text-foreground">Info PO</h2>
                </div>
                <span className="text-xs text-foreground/40">Data utama</span>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-foreground/70">Tanggal PO</label>
                  <CustomDatePicker value={poDate} onChange={setPoDate} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-foreground/70">Supplier</label>
                  <div className="relative">
                    <SuggestField
                      value={supplierId}
                      onChange={handleSupplierChange}
                      allowCustom
                      options={[
                        { value: "", label: "Pilih Supplier..." },
                        ...localSuppliers.map(s => ({ value: s.supplier_name, label: s.supplier_name }))
                      ]}
                    />
                    <p className="mt-1 text-[11px] text-foreground/40">
                      Supplier baru? <button type="button" onClick={() => { setNewSupplierName(supplierId); setShowAddSupplier(true) }} className="text-primary hover:underline">Tambah Baru</button>
                    </p>
                  </div>
                </div>
              </div>
            </section>

            <section className="rounded-xl border border-white/10 bg-white/5 p-2.5 md:p-3">
              <div className="mb-2 flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-primary">2. Barang</p>
                  <h2 className="text-base font-bold text-foreground">Detail Pembelian</h2>
                </div>
                <button type="button" onClick={handleAddItem} className="btn-secondary flex h-8 items-center gap-1.5 px-3 text-xs">
                  <Plus className="h-3.5 w-3.5" /> Tambah Item
                </button>
              </div>

              <div className="space-y-1.5">
                {items.map((item, index) => (
                  <div key={item.id} className="rounded-lg border border-white/10 bg-black/10 p-2.5">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-foreground/70">Item {index + 1}</span>
                      {items.length > 1 && (
                        <button type="button" onClick={() => handleRemoveItem(item.id)} className="flex items-center gap-1 text-xs text-red-400 transition-opacity hover:text-red-300">
                          <Trash2 className="h-3.5 w-3.5" /> Hapus
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-4">
                      <div className="space-y-1 sm:col-span-2">
                        <label className="block text-[10px] text-foreground/60">Tujuan</label>
                        <CustomSelect
                          value={item.workshop_id}
                          onChange={e => handleItemChange(item.id, 'workshop_id', e.target.value)}
                          options={[
                            { value: "", label: "Pilih Workshop..." },
                            ...workshops.filter(ws => ws.code === 'GUDANG' || ws.code === 'GLOBAL').map(ws => ({ value: ws.id, label: ws.name }))
                          ]}
                        />
                      </div>

                      <div className="relative space-y-1 sm:col-span-2">
                        <label className="block text-[10px] font-medium text-foreground/70">Bahan Baku + Kategori</label>
                        <SuggestField
                          value={item.product_search}
                          onChange={e => handleItemChange(item.id, 'product_search', e.target.value)}
                          placeholder="Pilih Produk..."
                          options={[
                            { value: "", label: "Pilih Produk..." },
                            ...products.filter(p => p.workshop_code === workshops.find(w => w.id === item.workshop_id)?.code && (p.is_active !== false || p.name === item.product_search)).map(p => ({ value: p.name, label: `${p.name}${p.category ? ` — ${p.category}` : ''}` }))
                          ]}
                          disabled={!item.workshop_id}
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="block text-[10px] font-medium text-foreground/70">Qty</label>
                        <input type="text" value={formatRp(item.qty)} onChange={e => handleItemChange(item.id, 'qty', parseRp(e.target.value))} className="glass-input w-full text-sm" />
                      </div>

                      <div className="space-y-1">
                        <label className="block text-[10px] text-foreground/60">Satuan</label>
                        <CustomSelect
                          value={item.unit}
                          onChange={e => handleItemChange(item.id, 'unit', e.target.value)}
                          options={(() => {
                            const p = products.find(prod => prod.name === item.product_search)
                            const base = [{ value: 'PCS', label: 'PCS' }]
                            if (p && p.product_units && p.product_units.length > 0) {
                              const extraUnits = p.product_units.filter(u => u.unit_name !== 'PCS').map(u => ({ value: u.unit_name, label: u.unit_name }))
                              return [...base, ...extraUnits]
                            }
                            return base
                          })()}
                          disabled={!item.product_search}
                        />
                      </div>

                      <div className="space-y-1 sm:col-span-2">
                        <label className="block text-[10px] font-medium text-foreground/70">Harga Beli (Rp)</label>
                        <input type="text" value={formatRp(item.unit_cost)} onChange={e => handleItemChange(item.id, 'unit_cost', parseRp(e.target.value))} className="glass-input w-full text-sm" />
                      </div>
                    </div>

                    <div className="mt-2 flex items-center justify-between border-t border-white/5 pt-2 text-xs">
                      <span className="text-foreground/50">Subtotal Modal</span>
                      <span className="font-bold text-red-400">Rp {(Number(item.qty) * Number(item.unit_multiplier) * Number(item.unit_cost)).toLocaleString('id-ID')}</span>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-xl border border-white/10 bg-white/5 p-2.5 md:p-3">
              <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-primary">3. Pembayaran</p>
                  <h2 className="text-base font-bold text-foreground">Sistem Pembayaran</h2>
                </div>
                <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-2.5 py-1.5 sm:text-right">
                  <p className="text-[10px] font-medium text-red-400">Total</p>
                  <p className="text-base font-bold text-red-500">Rp {grandTotal.toLocaleString('id-ID')}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-foreground/70">Status Pembayaran</label>
                  <div className="flex rounded-lg border border-white/10 bg-black/10 p-1" role="group" aria-label="Status Pembayaran">
                    {(dropdownConfig.payment_status_po || ["TEMPO", "LUNAS"]).map(value => {
                      const label = value === 'TEMPO' ? 'TEMPO' : value === 'LUNAS' ? 'LUNAS' : value
                      return (
                        <button
                          key={value}
                          type="button"
                          onClick={() => setPaymentStatus(value)}
                          className={`flex-1 rounded-md px-3 py-2 text-xs font-bold transition-colors ${paymentStatus === value ? 'bg-primary text-background' : 'text-foreground/60 hover:bg-white/10 hover:text-foreground'}`}
                        >
                          {label}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {paymentStatus === 'LUNAS' && (
                  <div className="space-y-1 animate-in fade-in">
                    <label className="text-xs font-medium text-foreground/70">Kas/Bank</label>
                    <CustomSelect
                      value={paymentAccount}
                      onChange={e => setPaymentAccount(e.target.value)}
                      options={[
                        { value: "", label: "- Pilih Akun (Kas/Bank) -" },
                        ...(dropdownConfig.payment_method || ["BCA", "CASH", "MANDIRI"]).map(v => ({ value: v, label: v }))
                      ]}
                    />
                  </div>
                )}
              </div>
            </section>

            <section className="rounded-xl border border-white/10 bg-white/5 px-2.5 py-2">
              <details>
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-xs font-medium text-foreground/70">
                  <span>Catatan <span className="text-foreground/40">(opsional)</span></span>
                  <span className="text-[11px] text-foreground/40">Tambah catatan</span>
                </summary>
                <textarea value={notes} onChange={e => setNotes(e.target.value)} className="glass-input mt-2 h-12 w-full resize-none text-sm" placeholder="Misal: Dikirim ke Gudang Pusat..." />
              </details>
            </section>
          </div>
        </div>

        <footer className="flex items-center justify-between gap-3 border-t border-white/10 bg-background/95 px-3 py-2.5 backdrop-blur md:px-4">
          <div className="flex items-center gap-2">
            {initialData?.id && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={loading || deleting}
                className="flex items-center gap-1.5 rounded-lg border border-red-500/30 px-3 py-2 text-sm font-medium text-red-400 transition-colors hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" />
                {deleting ? 'Menghapus...' : 'Hapus'}
              </button>
            )}
            <button type="button" onClick={handleClose} className="btn-secondary px-4 text-sm">Batal</button>
          </div>
          <button type="button" onClick={handleSubmit} disabled={loading} className="btn-primary flex items-center gap-2 bg-red-500 px-5 text-sm text-white shadow-[0_0_20px_rgba(239,68,68,0.25)] hover:bg-red-600">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            {loading ? 'Memproses...' : 'Simpan PO'}
          </button>
        </footer>
      </aside>

      {showAddSupplier && (
        <div className="fixed inset-0 z-[1300] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onMouseDown={event => event.target === event.currentTarget && setShowAddSupplier(false)}>
          <div className="w-full max-w-md overflow-hidden rounded-2xl border border-white/10 bg-background shadow-2xl">
            <div className="border-b border-white/10 bg-white/5 p-4">
              <h3 className="font-bold text-foreground">Tambah Supplier Baru</h3>
            </div>
            <div className="space-y-3 p-4">
              <p className="text-sm text-foreground/60">Supplier <b>{newSupplierName}</b> tidak ditemukan. Tambahkan sebagai supplier baru?</p>
              <div className="space-y-1">
                <label className="text-xs font-medium text-foreground/80">Nama Supplier</label>
                <input type="text" value={newSupplierName} onChange={e => setNewSupplierName(e.target.value)} className="glass-input w-full" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-foreground/80">Kontak Person / No HP</label>
                <input type="text" value={newSupplierContact} onChange={e => setNewSupplierContact(e.target.value)} className="glass-input w-full" />
              </div>
            </div>
            <div className="flex justify-end gap-3 border-t border-white/10 bg-white/5 p-3">
              <button type="button" onClick={() => setShowAddSupplier(false)} className="btn-secondary h-9 px-4 text-sm">Batal</button>
              <button type="button" onClick={handleAddSupplier} className="btn-primary h-9 px-4 text-sm">Simpan Supplier</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
