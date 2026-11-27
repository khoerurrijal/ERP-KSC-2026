'use client'

import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Loader2, Plus, ShoppingBag, Trash2, X } from 'lucide-react'
import CustomDatePicker from '@/components/CustomDatePicker'
import { createSalesOrder } from '@/app/actions/sales'
import { calculateItemPrice as calculateItemPriceUtil, getMinQty } from '@/utils/pricing'
import { isKingInternalCustomerType } from '@/utils/kingInternalPurchase.mjs'
import { isLegacySalesAddonCode } from '@/utils/legacySalesAddons.mjs'

function SearchPicker({ value, options, onChange, placeholder }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const wrapperRef = useRef(null)
  const listboxId = useId()
  const selected = options.find(option => option.value === value)
  const matches = useMemo(() => {
    const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
    return options.filter(option => terms.every(term => option.label.toLowerCase().includes(term))).slice(0, 30)
  }, [options, query])

  useEffect(() => {
    const closeIfOutside = event => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) setOpen(false)
    }
    document.addEventListener('mousedown', closeIfOutside)
    return () => document.removeEventListener('mousedown', closeIfOutside)
  }, [])

  return (
    <div ref={wrapperRef} className="relative">
      <input
        value={open ? query : selected?.label || ''}
        onFocus={() => { setQuery(''); setOpen(true) }}
        onChange={event => { setQuery(event.target.value); setOpen(true) }}
        placeholder={placeholder}
        role="combobox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-autocomplete="list"
        className="glass-input h-10 w-full text-sm"
      />
      {open && (
        <div id={listboxId} role="listbox" className="absolute left-0 right-0 top-full z-30 mt-1 max-h-56 overflow-y-auto rounded-xl border border-white/10 bg-background p-1 shadow-2xl">
          {matches.length ? matches.map(option => (
            <button
              key={option.value}
              type="button"
              role="option"
              aria-selected={option.value === value}
              onClick={() => { onChange(option.value); setQuery(''); setOpen(false) }}
              className="w-full rounded-lg px-3 py-2 text-left text-sm text-foreground/80 hover:bg-white/10"
            >
              {option.label}
            </button>
          )) : <p className="px-3 py-3 text-center text-xs text-foreground/45">Tidak ada hasil.</p>}
        </div>
      )}
    </div>
  )
}

const formatRp = value => Number(value || 0).toLocaleString('id-ID', { maximumFractionDigits: 0 })
const parseNumber = value => Number(String(value || '').replace(/[^0-9]/g, '')) || 0

function getTodayDate() {
  const today = new Date()
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
}

export default function DashboardDirectSale({ customers = [], products = [], dropdownConfig = {}, pricelistConfig = {} }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [customerId, setCustomerId] = useState('')
  const [orderDate, setOrderDate] = useState(getTodayDate)
  const [paymentAmount, setPaymentAmount] = useState(0)
  const [paymentMethod, setPaymentMethod] = useState('')
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState([{ id: 1, productId: '', qty: 1, unit: 'PCS', multiplier: 1, price: 0 }])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const customerOptions = useMemo(() => customers
    .filter(customer => customer.customer_code && !String(customer.type || '').toUpperCase().includes('MARKETPLACE'))
    .map(customer => ({
      value: customer.customer_code,
      label: `${customer.name}${customer.type ? ` — ${customer.type}` : ''}`
    })), [customers])
  const customer = customers.find(row => row.customer_code === customerId)
  const isKingInternal = isKingInternalCustomerType(customer?.type)

  const polosCategories = useMemo(() => dropdownConfig.category_mapping?.POLOS?.length
    ? dropdownConfig.category_mapping.POLOS
    : [...new Set(products.map(product => product.category).filter(Boolean))], [dropdownConfig.category_mapping, products])
  const polosProducts = useMemo(() => products.filter(product => {
    const category = String(product.category || '').trim().toUpperCase()
    const workshop = String(product.workshop_code || '').trim().toUpperCase()
    return product.is_active !== false
      && polosCategories.includes(product.category)
      && !['JASA', 'JASA LAYANAN'].includes(category)
      && !isLegacySalesAddonCode(product.product_code)
      && (!isKingInternal || ['GUDANG', 'GLOBAL'].includes(workshop))
  }), [products, polosCategories, isKingInternal])

  const productOptions = useMemo(() => polosProducts.map(product => ({
    value: product.product_code,
    label: `${product.name}${product.workshop_code ? ` — ${product.workshop_code}` : ''} — stok tersedia ${formatRp(product.stock_qty)} pcs`
  })), [polosProducts])
  const paymentMethods = dropdownConfig.payment_method?.length ? dropdownConfig.payment_method : ['BCA', 'MANDIRI', 'CASH']

  const total = items.reduce((sum, item) => sum + Number(item.qty || 0) * Number(item.price || 0), 0)

  useEffect(() => {
    if (!notice) return undefined
    const timeout = window.setTimeout(() => setNotice(''), 3500)
    return () => window.clearTimeout(timeout)
  }, [notice])

  const resetForm = () => {
    setCustomerId('')
    setOrderDate(getTodayDate())
    setPaymentAmount(0)
    setPaymentMethod('')
    setNotes('')
    setItems([{ id: 1, productId: '', qty: 1, unit: 'PCS', multiplier: 1, price: 0 }])
    setError('')
  }

  const addItem = () => setItems(current => [...current, {
    id: Math.max(0, ...current.map(item => item.id)) + 1,
    productId: '', qty: 1, unit: 'PCS', multiplier: 1, price: 0
  }])

  const updateItem = (id, patch) => setItems(current => current.map(item => {
    if (item.id !== id) return item
    const updated = { ...item, ...patch }
    const product = polosProducts.find(row => row.product_code === updated.productId)
    if (product && (patch.productId || patch.qty !== undefined || patch.unit !== undefined)) {
      const minQty = getMinQty({ orderType: 'POLOS', category: product.category, pricelistConfig })
      if (patch.productId && Number(updated.qty) < minQty) updated.qty = minQty
      const unit = product.product_units?.find(row => row.unit_name === updated.unit)
      updated.multiplier = unit ? Number(unit.multiplier || 1) : 1
      updated.price = Math.ceil(calculateItemPriceUtil({
        product,
        qty: updated.qty,
        orderType: 'POLOS',
        pricelistConfig
      }) * updated.multiplier)
    }
    return updated
  }))

  const handleCustomerChange = nextCustomerId => {
    const nextCustomer = customers.find(row => row.customer_code === nextCustomerId)
    const nextIsKing = isKingInternalCustomerType(nextCustomer?.type)
    setCustomerId(nextCustomerId)
    setPaymentAmount(0)
    setPaymentMethod('')
    setItems(current => current.map(item => {
      const product = products.find(row => row.product_code === item.productId)
      const workshop = String(product?.workshop_code || '').trim().toUpperCase()
      if (nextIsKing && product && !['GUDANG', 'GLOBAL'].includes(workshop)) {
        return { ...item, productId: '', qty: 1, unit: 'PCS', multiplier: 1, price: 0 }
      }
      return item
    }))
    setError('')
  }

  const closeForm = () => {
    if (loading) return
    setOpen(false)
    resetForm()
  }

  const handleSubmit = async event => {
    event.preventDefault()
    setError('')
    if (!customerId) return setError('Pilih customer terlebih dahulu.')
    if (!items.length || items.some(item => !item.productId || Number(item.qty) <= 0)) return setError('Pilih barang dan isi jumlah untuk setiap item.')
    if (paymentAmount > total) return setError('Nominal pembayaran tidak boleh melebihi total pesanan.')
    if (!isKingInternal && paymentAmount > 0 && !paymentMethod) return setError('Pilih metode pembayaran.')

    setLoading(true)
    try {
      const result = await createSalesOrder({
        customerId,
        orderDate,
        notes,
        items: items.map(item => ({
          product_id: item.productId,
          order_type: 'POLOS',
          qty: Number(item.qty),
          unit: item.unit,
          unit_multiplier: Number(item.multiplier),
          price: Number(item.price)
        })),
        dpAmount: isKingInternal ? 0 : Number(paymentAmount),
        paymentAccount: isKingInternal ? 'Virtual' : paymentMethod,
        directPickup: true
      })

      if (!result?.success) throw new Error(result?.error || 'Gagal menyimpan transaksi.')
      setOpen(false)
      resetForm()
      setNotice('Pembelian langsung berhasil disimpan.')
      router.refresh()
    } catch (submitError) {
      setError(submitError.message || 'Gagal menyimpan transaksi.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="btn-primary inline-flex h-10 items-center gap-2 px-4 text-sm">
        <ShoppingBag className="h-4 w-4" /> Beli Langsung
      </button>
      {notice && <span role="status" className="text-xs font-medium text-green-400">{notice}</span>}

      {open && (
        <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/60 p-3 backdrop-blur-sm sm:p-5" onMouseDown={event => event.target === event.currentTarget && closeForm()}>
          <section role="dialog" aria-modal="true" aria-labelledby="direct-sale-title" className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-background shadow-2xl">
            <header className="flex items-center justify-between gap-3 border-b border-white/10 bg-white/5 px-4 py-3 sm:px-5">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-primary">Sales Order Ringkas</p>
                <h2 id="direct-sale-title" className="text-lg font-bold text-foreground">Beli Langsung</h2>
              </div>
              <button type="button" onClick={closeForm} aria-label="Tutup" className="rounded-lg p-2 text-foreground/60 hover:bg-white/10 hover:text-foreground"><X className="h-5 w-5" /></button>
            </header>

            <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
              <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-5">
                {error && <p role="alert" className="rounded-lg border border-red-500/25 bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p>}

                <div className="grid gap-3 sm:grid-cols-[1fr_190px]">
                  <label className="space-y-1 text-xs font-medium text-foreground/65">
                    Customer
                    <SearchPicker value={customerId} options={customerOptions} onChange={handleCustomerChange} placeholder="Cari nama customer..." />
                  </label>
                  <label className="space-y-1 text-xs font-medium text-foreground/65">
                    Tanggal
                    <CustomDatePicker value={orderDate} onChange={setOrderDate} />
                  </label>
                </div>

                {isKingInternal && <p className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-foreground/70">Pembelian KING dicatat lunas melalui saldo virtual KING dan menambah saldo virtual Gudang/Global.</p>}

                <section className="space-y-2 rounded-xl border border-white/10 bg-white/5 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-bold text-foreground">Barang polos</h3>
                      <p className="text-[11px] text-foreground/45">Barang langsung dianggap sudah diambil saat disimpan.</p>
                    </div>
                    <button type="button" onClick={addItem} className="btn-secondary inline-flex h-8 items-center gap-1.5 px-2.5 text-xs"><Plus className="h-3.5 w-3.5" />Tambah item</button>
                  </div>

                  {items.map((item, index) => {
                    const product = polosProducts.find(row => row.product_code === item.productId)
                    const unitOptions = [{ unit_name: 'PCS', multiplier: 1 }, ...(product?.product_units || []).filter(unit => unit.unit_name !== 'PCS')]
                    const itemTotal = Number(item.qty || 0) * Number(item.price || 0)
                    return (
                      <div key={item.id} className="space-y-2 rounded-lg border border-white/10 bg-black/10 p-3">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-semibold text-foreground/70">Item {index + 1}</span>
                          {items.length > 1 && <button type="button" onClick={() => setItems(current => current.filter(row => row.id !== item.id))} className="inline-flex items-center gap-1 text-xs text-red-400 hover:text-red-300"><Trash2 className="h-3.5 w-3.5" />Hapus</button>}
                        </div>
                        <label className="block space-y-1 text-[11px] font-medium text-foreground/55">
                          Cari barang
                          <SearchPicker value={item.productId} options={productOptions} onChange={productId => updateItem(item.id, { productId, unit: 'PCS', multiplier: 1 })} placeholder="Cari nama barang polos..." />
                        </label>
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                          <label className="space-y-1 text-[11px] font-medium text-foreground/55">
                            Jumlah
                            <input type="text" value={formatRp(item.qty)} onChange={event => updateItem(item.id, { qty: parseNumber(event.target.value) })} onBlur={() => {
                              const minQty = getMinQty({ orderType: 'POLOS', category: product?.category, pricelistConfig })
                              if (Number(item.qty) < minQty) updateItem(item.id, { qty: minQty })
                            }} className="glass-input h-10 w-full text-sm" />
                          </label>
                          <label className="space-y-1 text-[11px] font-medium text-foreground/55">
                            Satuan
                            <select value={item.unit} onChange={event => updateItem(item.id, { unit: event.target.value })} disabled={!product} className="glass-input h-10 w-full text-sm disabled:opacity-50">
                              {unitOptions.map(unit => <option key={unit.unit_name} value={unit.unit_name}>{unit.unit_name}</option>)}
                            </select>
                          </label>
                          <label className="space-y-1 text-[11px] font-medium text-foreground/55 sm:col-span-2">
                            Harga satuan (bisa diedit)
                            <input type="text" value={formatRp(item.price)} onChange={event => setItems(current => current.map(row => row.id === item.id ? { ...row, price: parseNumber(event.target.value) } : row))} className="glass-input h-10 w-full text-sm" />
                          </label>
                        </div>
                        <div className="flex items-center justify-between border-t border-white/5 pt-2 text-xs">
                          <span className="text-foreground/50">Subtotal item</span>
                          <span className="font-bold text-primary">Rp {formatRp(itemTotal)}</span>
                        </div>
                      </div>
                    )
                  })}
                </section>

                <section className="space-y-3 rounded-xl border border-primary/20 bg-primary/5 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-semibold text-foreground/70">Total pesanan</span>
                    <span className="text-lg font-bold text-primary">Rp {formatRp(total)}</span>
                  </div>
                  {!isKingInternal && <>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <label className="space-y-1 text-xs font-medium text-foreground/65">
                        Dibayar sekarang (opsional)
                        <input type="text" value={formatRp(paymentAmount)} onChange={event => setPaymentAmount(parseNumber(event.target.value))} className="glass-input h-10 w-full text-sm" />
                      </label>
                      {paymentAmount > 0 && <label className="space-y-1 text-xs font-medium text-foreground/65">
                        Metode pembayaran
                        <select value={paymentMethod} onChange={event => setPaymentMethod(event.target.value)} className="glass-input h-10 w-full text-sm">
                          <option value="">Pilih metode...</option>
                          {paymentMethods.map(method => <option key={method} value={method}>{method}</option>)}
                        </select>
                      </label>}
                    </div>
                    <p className="text-[11px] text-foreground/45">Sisa tagihan: Rp {formatRp(Math.max(0, total - paymentAmount))}. Pembayaran Rp 0 akan tersimpan sebagai belum lunas.</p>
                  </>}
                </section>

                <label className="block space-y-1 text-xs font-medium text-foreground/55">
                  Catatan (opsional)
                  <input value={notes} onChange={event => setNotes(event.target.value)} className="glass-input h-10 w-full text-sm" placeholder="Catatan pesanan..." />
                </label>
              </div>

              <footer className="flex items-center justify-between gap-3 border-t border-white/10 bg-background/95 px-4 py-3 sm:px-5">
                <button type="button" onClick={closeForm} disabled={loading} className="btn-secondary h-10 px-4 text-sm">Batal</button>
                <button type="submit" disabled={loading || !customerId || !items.some(item => item.productId)} className="btn-primary inline-flex h-10 items-center gap-2 px-4 text-sm disabled:cursor-not-allowed disabled:opacity-50">
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  {loading ? 'Menyimpan...' : 'Simpan Pesanan'}
                </button>
              </footer>
            </form>
          </section>
        </div>
      )}
    </>
  )
}
