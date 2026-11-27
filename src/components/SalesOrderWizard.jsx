'use client'

import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ChevronRight, CheckCircle2, User, ShoppingCart, CreditCard, Plus, Trash2, ArrowLeft, Loader2, Save, X, Copy, Check, RotateCw } from 'lucide-react'
import CustomSelect from '@/components/CustomSelect'
import CustomDatePicker from '@/components/CustomDatePicker'
import { approveCustomerOrderRequest } from '@/app/actions/orderRequests'
import {
  isLegacyFastTrackCode,
  isLegacySalesAddonCode,
  isLegacyTwoColorCode
} from '@/utils/legacySalesAddons.mjs'
import { isKingInternalCustomerType, stripKingInternalPurchaseMarker } from '@/utils/kingInternalPurchase.mjs'

const isMarketplaceCustomerType = (type) => {
  const normalizedType = String(type || '').toUpperCase()
  return normalizedType.includes('MARKETPLACE') || ['SHOPEE', 'TOKOPEDIA', 'TIKTOK'].some(platform => normalizedType.includes(platform))
}

function SuggestField({ value, onChange, options, placeholder = 'Pilih...', disabled = false, allowCustom = false }) {
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [visibleCount, setVisibleCount] = useState(50)
  const fieldRef = useRef(null)
  const listboxId = useId()
  const selectedOption = options.find(option => String(option.value) === String(value) && option.value !== '')

  useEffect(() => {
    const handleClickOutside = event => {
      if (fieldRef.current && !fieldRef.current.contains(event.target)) setIsOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleFocus = () => {
    if (disabled) return
    setQuery(selectedOption ? '' : allowCustom ? String(value || '') : '')
    setVisibleCount(50)
    setIsOpen(true)
  }

  const handleInputChange = event => {
    const nextValue = event.target.value
    setQuery(nextValue)
    setVisibleCount(50)
    if (allowCustom) onChange({ target: { value: nextValue } })
    setIsOpen(true)
  }

  const filteredOptions = useMemo(() => {
    if (!isOpen || disabled) return []
    const queryTerms = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
    return options.filter(option => {
      const normalizedLabel = String(option.label).toLowerCase()
      return queryTerms.every(term => normalizedLabel.includes(term))
    })
  }, [options, query, isOpen, disabled])
  const inputValue = isOpen ? query : selectedOption?.label || (allowCustom ? String(value || '') : '')

  return (
    <div ref={fieldRef} className="relative">
      <input
        type="text"
        value={inputValue}
        onFocus={handleFocus}
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
          ) : filteredOptions.slice(0, visibleCount).map(option => (
            <button
              key={option.value || 'empty'}
              type="button"
              role="option"
              aria-selected={String(value) === String(option.value)}
              onClick={() => { onChange({ target: { value: option.value } }); setQuery(''); setIsOpen(false) }}
              className="flex w-full items-start rounded-lg px-3 py-2 text-left text-sm text-foreground/80 transition-colors hover:bg-foreground/10 hover:text-foreground"
            >
              <span className="whitespace-normal break-words">{option.label}</span>
            </button>
          ))}
          {visibleCount < filteredOptions.length && (
            <button type="button" onClick={() => setVisibleCount(count => count + 50)} className="w-full rounded-lg px-3 py-2 text-left text-sm text-primary hover:bg-foreground/10">
              Tampilkan lebih banyak ({filteredOptions.length - visibleCount} tersisa)
            </button>
          )}
        </div>
      )}
    </div>
  )
}
import { createSalesOrder, updateSalesOrder } from '@/app/actions/sales'
import { addCustomer } from '@/app/dashboard/master/customers/actions'
import { calculateItemPrice as calculateItemPriceUtil, getMinQty } from '@/utils/pricing'

export default function SalesOrderWizard({ customers, products, workshops, initialData, requestId, dropdownConfig = {}, pricelistConfig = {}, paymentHistory = [], isLoadingPaymentHistory = false, onClose, onSaved, onCancel, compact = true }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const itemIdPrefix = useId()
  const nextItemId = useRef(0)
  const requestedReturnTo = searchParams.get('from')
  const returnTo = requestedReturnTo && requestedReturnTo.startsWith('/') && !requestedReturnTo.startsWith('//')
    ? requestedReturnTo
    : '/sales'
  const [isReorder, setIsReorder] = useState(false)
  const isExistingOrder = Boolean(initialData?.id) && !isReorder
  const [currentTab, setCurrentTab] = useState(1)
  const [localCustomers, setLocalCustomers] = useState(customers || [])
  const [showAddCustomer, setShowAddCustomer] = useState(false)
  const [newCustomerName, setNewCustomerName] = useState(initialData?.customer_name || "")
  const [newCustomerPhone, setNewCustomerPhone] = useState(initialData?.customer_phone || "")
  const [newCustomerType, setNewCustomerType] = useState((dropdownConfig?.customer_type && dropdownConfig.customer_type.length > 0) ? dropdownConfig.customer_type[0] : "REGULLER")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const [orderDate, setOrderDate] = useState(initialData?.date || new Date().toISOString().split('T')[0])
  const [customerId, setCustomerId] = useState(initialData?.customer_code || '')
  const [isMarketplace, setIsMarketplace] = useState(initialData?.marketplace_receipt ? true : false)
  const [marketplaceReceipt, setMarketplaceReceipt] = useState(initialData?.marketplace_receipt || '')
  const [notes, setNotes] = useState(stripKingInternalPurchaseMarker(initialData?.notes || ''))

  const handleCustomerChange = (e) => {
    const val = e.target.value
    setCustomerId(val)
    const cust = localCustomers.find(c => c.customer_code === val || c.name === val)
    const ctype = (cust?.type || '').toUpperCase()
    if (cust && isKingInternalCustomerType(ctype)) {
      setIsMarketplace(false)
      setMarketplaceReceipt('')
      setDpAmount(0)
      setPaymentAccount('')
      setDesignService(false)
      setItems(currentItems => currentItems.map(item => ({ ...item, order_type: 'POLOS', isFastTrack: false, isTwoColor: false })))
    } else if (cust && isMarketplaceCustomerType(ctype)) {
      setIsMarketplace(true)
      setDpAmount(0)
    } else {
      setIsMarketplace(false)
      setMarketplaceReceipt('')
    }
  }

  const handleNextTab1 = () => {
    const custExists = localCustomers.find(c => c.customer_code === customerId)
    if (!custExists) {
      if (!newCustomerName.trim() && customerId.trim()) setNewCustomerName(customerId)
      if (!newCustomerName.trim() && !customerId.trim()) {
        setError('Pilih pelanggan lama atau buat pelanggan baru terlebih dahulu.')
        return
      }
      setShowAddCustomer(true)
    } else {
      setCurrentTab(2)
    }
  }

  const handleAddCustomer = async () => {
    if (!newCustomerName) {
      alert("Nama Pelanggan wajib diisi!");
      return;
    }
    setLoading(true);

    const newCust = {
      name: newCustomerName,
      phone: newCustomerPhone,
      type: newCustomerType
    }

    const res = await addCustomer(newCust);
    setLoading(false);

    if (res.error) {
      alert("Gagal menambahkan pelanggan: " + res.error);
      return;
    }

    setLocalCustomers([...localCustomers, res.customer])
    setCustomerId(res.customer.customer_code)
    setShowAddCustomer(false)
    setNewCustomerName('')

    const ctype = (res.customer?.type || newCustomerType || '').toUpperCase()
    if (isKingInternalCustomerType(ctype)) {
      setIsMarketplace(false)
      setMarketplaceReceipt('')
      setDpAmount(0)
      setPaymentAccount('')
      setDesignService(false)
      setItems(currentItems => currentItems.map(item => ({ ...item, order_type: 'POLOS', isFastTrack: false, isTwoColor: false })))
      setCurrentTab(2)
    } else if (isMarketplaceCustomerType(ctype)) {
      setIsMarketplace(true)
      setDpAmount(0)
    } else {
      setIsMarketplace(false)
      setMarketplaceReceipt('')
      setCurrentTab(2)
    }
  }

  // Tab 2: Detail Pesanan
  const initialOrderItems = initialData?.items || []
  const initialBaseItems = initialOrderItems.filter(i => !isLegacySalesAddonCode(i.product_code))
  const initialLegacyAddons = initialBaseItems.length > 0
    ? initialOrderItems.filter(i => isLegacySalesAddonCode(i.product_code))
    : []
  const itemsToEdit = initialBaseItems.length > 0 ? initialBaseItems : initialOrderItems
  const [items, setItems] = useState(itemsToEdit.length > 0
    ? itemsToEdit.map((i, idx) => {
      const product = products.find(p => p.product_code === i.product_code)
      const legacyAppliesToItem = (addon) => {
        if (initialBaseItems.length === 1) return true
        const productName = String(product?.name || '').toLowerCase()
        return Boolean(productName && String(addon.notes || '').toLowerCase().includes(productName))
      }
      const legacyFastTrack = initialLegacyAddons.some(addon =>
        isLegacyFastTrackCode(addon.product_code) && legacyAppliesToItem(addon)
      )
      const legacyTwoColor = initialLegacyAddons.some(addon =>
        isLegacyTwoColorCode(addon.product_code) && legacyAppliesToItem(addon)
      )

      return ({
        id: i.id || `${itemIdPrefix}-${idx}`,
        order_type: i.order_type || '',
        category: product?.category || '',
        product_id: i.product_code || '',
        product_search: product?.name || '',
        workshop_id: workshops.find(w => w.code === product?.workshop_code)?.id || '',
        qty: i.qty || 1,
        unit: i.unit || 'PCS',
        unit_multiplier: i.unit_multiplier || 1,
        price: i.unit_price || 0,
        isFastTrack: Boolean(i.is_fast_track || /fast\s*track/i.test(i.notes || '') || legacyFastTrack),
        isTwoColor: /2\s*warna|warna\s*ke-?2/i.test(i.notes || '') || legacyTwoColor,
        notes: i.notes || ''
      })
    })
    : [{ id: `${itemIdPrefix}-initial`, order_type: '', category: '', product_id: '', product_search: '', workshop_id: '', qty: 1, unit: 'PCS', unit_multiplier: 1, price: 0 }]
  )

  // Tab 3: Pembayaran
  const [dpAmount, setDpAmount] = useState(Number(initialData?.dp_amount || 0))
  const [paymentAccount, setPaymentAccount] = useState(initialData?.payment_method || '')
  const [designService, setDesignService] = useState(Boolean(initialData?.designService))
  const selectedCustomer = localCustomers.find(c => c.customer_code === customerId || c.name === customerId)
  const selectedCustomerType = String(selectedCustomer?.type || '').trim().toUpperCase()
  const isKingInternal = selectedCustomerType === 'KING'
  const [copiedTrackingLink, setCopiedTrackingLink] = useState(false)
  const [showReorderConfirm, setShowReorderConfirm] = useState(false)

  const handleClose = () => {
    if (onClose) {
      onClose()
      return
    }
    router.replace(returnTo)
  }

  const handleReorder = () => {
    const customer = localCustomers.find(c => c.customer_code === customerId || c.name === customerId)
    setItems(items.map((item, index) => ({ ...item, id: `${itemIdPrefix}-reorder-${index}` })))
    setOrderDate(new Date().toISOString().split('T')[0])
    setIsMarketplace(isMarketplace || isMarketplaceCustomerType(customer?.type))
    setMarketplaceReceipt('')
    setDpAmount(0)
    setPaymentAccount('')
    setCurrentTab(1)
    setError(null)
    setIsReorder(true)
    setShowReorderConfirm(false)
  }

  const handleSaved = () => {
    if (onSaved) {
      onSaved()
      return
    }
    router.push('/sales')
  }

  const handleCopyTrackingLink = async () => {
    if (!initialData?.id) return
    const trackingPath = `/track/${initialData.invoice_number || initialData.id}`
    const trackingUrl = typeof window === 'undefined' ? trackingPath : new URL(trackingPath, window.location.origin).toString()

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(trackingUrl)
      } else {
        const helper = document.createElement('textarea')
        helper.value = trackingUrl
        helper.style.position = 'fixed'
        helper.style.opacity = '0'
        document.body.appendChild(helper)
        helper.select()
        document.execCommand('copy')
        helper.remove()
      }
      setCopiedTrackingLink(true)
      window.setTimeout(() => setCopiedTrackingLink(false), 1800)
    } catch (copyError) {
      console.error('Gagal menyalin link tracking:', copyError)
      alert('Link tracking gagal disalin.')
    }
  }

  const formatRp = (val) => {
    if (val === undefined || val === null || val === '') return ''
    const num = val.toString().replace(/[^0-9]/g, '')
    return Number(num).toLocaleString('id-ID', { maximumFractionDigits: 0 })
  }

  const parseRp = (val) => {
    if (!val) return 0
    return Number(val.toString().replace(/[^0-9]/g, ''))
  }

  // Derived state
  const customerOptions = useMemo(() => [
    { value: '', label: 'Pilih Pelanggan...' },
    ...localCustomers.map(c => ({ value: c.customer_code, label: `${c.name}${c.type ? ` — ${c.type}` : ''}` }))
  ], [localCustomers])

  // Quantity and price edits do not change which products are selectable.
  const itemProductKeys = JSON.stringify(items.map(({ id, order_type, product_id }) => ({ id, order_type, product_id })))
  const productOptionsByItem = useMemo(() => {
    const mapping = dropdownConfig.category_mapping || {}
    const fallbackCategories = [...new Set(products.filter(p => p.is_active !== false).map(p => p.category).filter(Boolean))]
    return new Map(JSON.parse(itemProductKeys).map(item => {
      const type = item.order_type
      const categories = !type ? [] : (mapping[type.toUpperCase()]?.length ? mapping[type.toUpperCase()] : mapping[type]?.length ? mapping[type] : fallbackCategories)
      const options = products
        .filter(p => isKingInternal
          ? ['GUDANG', 'GLOBAL'].includes(String(p.workshop_code || '').trim().toUpperCase())
            && !['JASA', 'JASA LAYANAN'].includes(String(p.category || '').trim().toUpperCase())
            && (p.is_active !== false || p.product_code === item.product_id)
            && (!isLegacySalesAddonCode(p.product_code) || p.product_code === item.product_id)
          : categories.includes(p.category) &&
            (p.is_active !== false || p.product_code === item.product_id) &&
            (!isLegacySalesAddonCode(p.product_code) || p.product_code === item.product_id)
        )
        .map(p => ({
          value: p.product_code,
          label: isKingInternal
            ? `${p.name} — ${String(p.workshop_code || '').toUpperCase()} — tersedia ${Number(p.stock_qty || 0).toLocaleString('id-ID')} pcs`
            : `${p.name}${p.category ? ` — ${p.category}` : ''}`
        }))
      return [item.id, options]
    }))
  }, [products, dropdownConfig.category_mapping, itemProductKeys, isKingInternal])

  const orderTypes = isKingInternal ? ['POLOS'] : Array.from(new Set(dropdownConfig.order_type || ['SABLON', 'POLOS']))

  const calculateTotal = () => {
    const itemTotal = items.reduce((sum, item) => {
      let itemTotal = Number(item.qty) * Number(item.price)
      if (!isKingInternal && item.isFastTrack) {
        const qtyFastTrack = Math.ceil(Number(item.qty) * Number(item.unit_multiplier || 1) / 1000)
        itemTotal += 100000 * qtyFastTrack
      }
      if (!isKingInternal && item.isTwoColor) {
        const actualQty = Number(item.qty) * Number(item.unit_multiplier || 1)
        itemTotal += 250 * actualQty
      }
      return sum + itemTotal
    }, 0)
    return itemTotal + (!isKingInternal && designService ? 50000 : 0)
  }

  const grandTotal = calculateTotal()
  const remaining = isKingInternal ? 0 : grandTotal - dpAmount

  const handleAddItem = () => {
    setItems([...items, { id: `${itemIdPrefix}-${nextItemId.current++}`, order_type: '', category: '', product_id: '', product_search: '', workshop_id: '', qty: 1, unit: 'PCS', unit_multiplier: 1, price: 0 }])
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
          const selectedProduct = products.find(p => p.product_code === value)
          if (selectedProduct) {
            updated.product_id = selectedProduct.product_code
            updated.product_search = selectedProduct.name
            updated.category = selectedProduct.category || ''
            updated.workshop_id = selectedProduct.workshop_id || ''
            updated.unit = 'PCS'
            updated.unit_multiplier = 1
          } else {
            updated.product_id = ''
            updated.product_search = ''
            updated.price = 0
            updated.workshop_id = ''
            updated.unit = 'PCS'
            updated.unit_multiplier = 1
          }
        } else if (field === 'unit') {
          updated.unit = value
          const selectedProduct = products.find(p => p.product_code === updated.product_id)
          if (selectedProduct && selectedProduct.product_units) {
             const pu = selectedProduct.product_units.find(u => u.unit_name === value)
             updated.unit_multiplier = pu ? pu.multiplier : 1
          } else {
             updated.unit_multiplier = 1
          }
        }

        if (['qty', 'product_search', 'order_type', 'category', 'unit', 'printingColors'].includes(field)) {
          const selectedProduct = products.find(p => p.product_code === updated.product_id)

          // Auto adjust Qty based on minimum rules
          const minQty = getMinQty({
            orderType: updated.order_type,
            category: updated.category,
            printingColors: updated.printingColors || '3 Warna',
            pricelistConfig
          })

          if (updated.qty < minQty) {
            // Only auto-correct if it's not currently being typed (i.e. we enforce it when category/order_type changes)
            // But if they are typing qty, we shouldn't hard block them from typing "1" before typing "000".
            // So we'll let 'qty' be updated normally here, but we will add a blur handler on the input itself.
            if (field !== 'qty') {
              updated.qty = minQty;
            }
          }

          if (selectedProduct) {
            const basePrice = calculateItemPriceUtil({
              product: selectedProduct,
              qty: updated.qty,
              orderType: updated.order_type,
              isTwoColor: false,
              printingColors: updated.printingColors || '3 Warna',
              pricelistConfig
            })

            updated.price = Math.ceil(basePrice * updated.unit_multiplier)
          }
        }

        return updated
      }
      return item
    }))
  }

  const handleSubmit = async () => {
    if (!customerId) return setError("Pilih pelanggan terlebih dahulu.")
    if (requestId && isKingInternal) return setError('Pembelian internal KING dibuat lewat Sales Order baru, bukan dari request konsumen.')
    const customerExists = localCustomers.find(c => c.customer_code === customerId || c.name === customerId)
    if (!customerExists && customerId.trim() !== '') {
      setNewCustomerName(customerId)
      setShowAddCustomer(true)
      return
    }
    if (items.some(i => !i.product_id || !i.order_type)) {
      return setError("Pastikan Jenis Pesanan dan Produk sudah dipilih.")
    }
    if (!isKingInternal && !isExistingOrder && !isMarketplace && Number(dpAmount) > 0 && !String(paymentAccount || '').trim()) {
      return setError("Pilih metode pembayaran sebelum menyimpan DP.")
    }

    setLoading(true)
    setError(null)

    try {

      if (!selectedCustomer) {
        setLoading(false)
        return setError("Pelanggan tidak ditemukan. Silakan tambahkan di menu Master Data terlebih dahulu.")
      }

      const payload = {
        customerId: selectedCustomer.customer_code,
        orderDate,
        notes,
        items,
        dpAmount: isKingInternal ? grandTotal : dpAmount,
        paymentAccount: isKingInternal ? 'Virtual' : paymentAccount,
        marketplaceReceipt: isKingInternal ? '' : marketplaceReceipt,
        designService: isKingInternal ? false : designService
      }

      let result;
      if (requestId) {
        result = await approveCustomerOrderRequest(requestId, payload)
      } else if (initialData?.id && !isReorder) {
        result = await updateSalesOrder(initialData.id, payload)
      } else {
        result = await createSalesOrder(payload)
      }

      if (result.success) {
        alert(requestId ? `Request berhasil dikonfirmasi menjadi Sales Order!` : isExistingOrder ? `Pesanan berhasil diupdate!` : `Pesanan berhasil dibuat!`)
        handleSaved()
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

  if (compact) {
    return (
      <div className="fixed inset-0 wizard-drawer-layer z-[1100] bg-black/50 backdrop-blur-[2px]">
        <button
          type="button"
          aria-label="Tutup form Sales Order"
          onClick={handleClose}
          className="absolute inset-0 cursor-default"
        />

        <aside
          role="dialog"
          aria-modal="true"
          aria-labelledby="sales-order-drawer-title"
          className="po-drawer-enter relative ml-auto flex h-full w-[92%] max-w-md flex-col border-l border-white/10 bg-background shadow-2xl will-change-transform sm:w-[80%] lg:w-[72%]"
        >
          <header className="border-b border-white/10 px-3 py-2.5 md:px-4">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-widest text-primary">Sales Order</p>
                <h1 id="sales-order-drawer-title" className="truncate text-base font-bold text-foreground md:text-lg">
                  {requestId ? 'Review Pesanan Customer' : isReorder ? 'Re-order Sales Order' : initialData ? 'Edit Sales Order' : 'Buat Sales Order'}
                </h1>
              </div>
              <button type="button" onClick={handleClose} aria-label="Tutup" className="rounded-lg p-2 text-foreground/60 transition-colors hover:bg-white/10 hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>
            {initialData?.id && !isReorder && !isKingInternal && (
              <div className="mt-2 flex items-center gap-2">
                <button type="button" onClick={handleCopyTrackingLink} data-copied={copiedTrackingLink} className={`copy-link-shimmer flex h-8 items-center gap-1.5 whitespace-nowrap rounded-lg border px-2.5 text-[11px] font-bold transition-colors ${copiedTrackingLink ? 'border-green-300 bg-green-500 text-white' : 'border-primary bg-primary text-primary-foreground hover:brightness-110'}`} title="Salin link tracking untuk dikirim ke konsumen">
                  <span className="relative z-10 inline-flex items-center gap-1.5">
                    {copiedTrackingLink ? <Check className="h-3.5 w-3.5 text-green-400" /> : <Copy className="h-3.5 w-3.5" />}
                    {copiedTrackingLink ? 'Tersalin' : 'Salin Link'}
                  </span>
                </button>
                <a href={`/sales/${initialData.id}/invoice`} target="_blank" rel="noreferrer" className="flex h-8 items-center whitespace-nowrap rounded-lg border border-white/10 bg-white/5 px-2.5 text-[11px] font-medium text-foreground/70 transition-colors hover:bg-white/10 hover:text-foreground">Print</a>
              </div>
            )}
          </header>

          <div className="flex-1 overflow-y-auto p-2.5 md:p-3">
            {error && <div className="mb-2 rounded-lg border border-red-500/20 bg-red-500/10 p-2.5 text-sm text-red-400">{error}</div>}

            <div className="space-y-2">
              <section className="rounded-xl border border-white/10 bg-white/5 p-2.5 md:p-3">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-primary">1. Pelanggan</p>
                    <h2 className="text-base font-bold text-foreground">Info Pesanan</h2>
                  </div>
                  <span className="text-xs text-foreground/40">Data utama</span>
                </div>

                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-foreground/70">Tanggal</label>
                    <CustomDatePicker value={orderDate} onChange={setOrderDate} />
                  </div>
                  <div className="space-y-1 sm:col-span-1">
                    <label className="text-xs font-medium text-foreground/70">Pelanggan</label>
                    <SuggestField
                      value={customerId}
                      onChange={e => {
                        setCustomerId(e.target.value)
                        handleCustomerChange({ target: { value: e.target.value } })
                      }}
                      allowCustom
                      options={customerOptions}
                    />
                    <p className="text-[11px] text-foreground/40">
                      Pelanggan baru? <button type="button" onClick={() => { setNewCustomerName(customerId); setShowAddCustomer(true) }} className="text-primary hover:underline">Tambah Baru</button>
                    </p>
                    </div>
                  </div>
                  {isMarketplace && (
                    <div className="mt-2 space-y-1">
                      <label className="text-xs font-medium text-foreground/70">No. Resi / Referensi Marketplace</label>
                      <input type="text" value={marketplaceReceipt} onChange={e => setMarketplaceReceipt(e.target.value)} className="glass-input w-full text-sm" placeholder="Masukkan nomor pesanan marketplace..." />
                    </div>
                  )}
                </section>

              <section className="rounded-xl border border-white/10 bg-white/5 p-2.5 md:p-3">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-primary">2. Barang</p>
                    <h2 className="text-base font-bold text-foreground">Detail Pesanan</h2>
                  </div>
                  <button type="button" onClick={handleAddItem} className="btn-secondary flex h-8 items-center gap-1.5 px-3 text-xs">
                    <Plus className="h-3.5 w-3.5" /> Tambah Item
                  </button>
                </div>

                {isKingInternal && <p className="mb-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-foreground/70">Pembelian internal KING: pilih barang stok GUDANG/GLOBAL. Stok tersedia dan fisik dipotong saat disimpan.</p>}

                <div className="space-y-1.5">
                  {items.map((item, index) => {
                    const productOptions = productOptionsByItem.get(item.id) || []
                    const product = products.find(p => p.product_code === item.product_id)
                    let itemTotal = Number(item.qty) * Number(item.price)
                    if (item.isFastTrack) itemTotal += 100000 * Math.ceil(Number(item.qty) * Number(item.unit_multiplier || 1) / 1000)
                    if (item.isTwoColor) itemTotal += 250 * Number(item.qty) * Number(item.unit_multiplier || 1)

                    return (
                      <div key={item.id} className="rounded-lg border border-white/10 bg-black/10 p-2.5">
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <span className="text-xs font-semibold text-foreground/70">Item {index + 1}</span>
                          {items.length > 1 && (
                            <button type="button" onClick={() => handleRemoveItem(item.id)} className="flex items-center gap-1 text-xs text-red-400 transition-colors hover:text-red-300">
                              <Trash2 className="h-3.5 w-3.5" /> Hapus
                            </button>
                          )}
                        </div>

                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-4">
                          <div className="space-y-1 sm:col-span-4">
                            <label className="block text-[10px] text-foreground/60">Jenis Pesanan</label>
                            <div role="group" aria-label={`Jenis pesanan item ${index + 1}`} className="flex flex-wrap gap-1.5">
                              {orderTypes.map(type => {
                                const isSelected = item.order_type === type
                                return (
                                  <button
                                    key={type}
                                    type="button"
                                    aria-pressed={isSelected}
                                    onClick={() => handleItemChange(item.id, 'order_type', type)}
                                    className={`h-7 rounded-lg border px-2.5 text-[10px] font-semibold transition-colors ${isSelected ? 'border-primary/50 bg-primary/15 text-primary' : 'border-white/10 bg-white/5 text-foreground/70 hover:border-primary/40 hover:text-foreground'}`}
                                  >
                                    {type}
                                  </button>
                                )
                              })}
                            </div>
                          </div>
                          <div className="space-y-1 sm:col-span-4">
                            <label className="block text-[10px] text-foreground/60">Cari Produk</label>
                            <SuggestField
                              value={item.product_id}
                              onChange={e => handleItemChange(item.id, 'product_search', e.target.value)}
                              placeholder="Ketik produk atau kategori..."
                              options={productOptions}
                              disabled={!item.order_type}
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="block text-[10px] text-foreground/60">Qty</label>
                            <input
                              type="text"
                              value={formatRp(item.qty)}
                              onBlur={e => {
                                const value = parseRp(e.target.value)
                                const minQty = getMinQty({ orderType: item.order_type, category: item.category, printingColors: item.printingColors, pricelistConfig })
                                if (value < minQty) handleItemChange(item.id, 'qty', minQty)
                              }}
                              onChange={e => handleItemChange(item.id, 'qty', parseRp(e.target.value))}
                              className="glass-input w-full text-sm"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="block text-[10px] text-foreground/60">Satuan</label>
                            <CustomSelect
                              value={item.unit}
                              onChange={e => handleItemChange(item.id, 'unit', e.target.value)}
                              options={[
                                { value: 'PCS', label: 'PCS' },
                                ...(item.order_type?.toUpperCase() !== 'SABLON' && item.order_type?.toUpperCase() !== 'PRINTING' && product?.product_units || [])
                                  .filter(unit => unit.unit_name !== 'PCS')
                                  .map(unit => ({ value: unit.unit_name, label: unit.unit_name }))
                              ]}
                              disabled={!item.product_search}
                            />
                          </div>
                          <div className="space-y-1 sm:col-span-2">
                            <label className="block text-[10px] text-foreground/60">Harga Satuan (Rp)</label>
                            <input type="text" value={formatRp(item.price)} onChange={e => handleItemChange(item.id, 'price', parseRp(e.target.value))} className="glass-input w-full text-sm" />
                          </div>
                        </div>

                        {item.order_type?.toUpperCase() === 'SABLON' && (
                          <details className="mt-2 border-t border-white/5 pt-2">
                            <summary className="cursor-pointer list-none text-[11px] font-medium text-foreground/60">Opsi produksi</summary>
                            <div className="mt-2 grid gap-2 sm:grid-cols-2">
                              <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-white/10 bg-white/5 p-2">
                                <input type="checkbox" checked={item.isFastTrack || false} onChange={e => handleItemChange(item.id, 'isFastTrack', e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-primary" />
                                <span className="text-xs text-red-400">🔥 Fast Track <span className="block text-[10px] text-foreground/50">+ Rp 100.000 / 1000 pcs</span></span>
                              </label>
                              <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-white/10 bg-white/5 p-2">
                                <input type="checkbox" checked={item.isTwoColor || false} onChange={e => handleItemChange(item.id, 'isTwoColor', e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-primary" />
                                <span className="text-xs text-yellow-400">🎨 2 Warna <span className="block text-[10px] text-foreground/50">+ Rp 250 / pcs</span></span>
                              </label>
                              <input type="url" placeholder="URL Mockup / Desain (opsional)" value={item.mockup_url || ''} onChange={e => handleItemChange(item.id, 'mockup_url', e.target.value)} className="glass-input text-sm sm:col-span-2" />
                            </div>
                          </details>
                        )}

                        {item.order_type?.toUpperCase() === 'PRINTING' && (
                          <details className="mt-2 border-t border-white/5 pt-2">
                            <summary className="cursor-pointer list-none text-[11px] font-medium text-foreground/60">Opsi printing</summary>
                            <div className="mt-2 grid gap-2 sm:grid-cols-2">
                              {['3 Warna', '4 Warna'].map(color => (
                                <label key={color} className="flex cursor-pointer items-center gap-2 rounded-lg border border-white/10 bg-white/5 p-2">
                                  <input type="radio" name={`printingColor_${item.id}`} checked={item.printingColors === color} onChange={() => handleItemChange(item.id, 'printingColors', color)} className="h-4 w-4 text-primary" />
                                  <span className="text-xs text-foreground/80">🎨 Printing {color}</span>
                                </label>
                              ))}
                              <input type="url" placeholder="URL Mockup / Desain (opsional)" value={item.mockup_url || ''} onChange={e => handleItemChange(item.id, 'mockup_url', e.target.value)} className="glass-input text-sm sm:col-span-2" />
                            </div>
                          </details>
                        )}

                        <div className="mt-2 flex items-center justify-between border-t border-white/5 pt-2 text-xs">
                          <span className="text-foreground/50">Subtotal Item</span>
                          <span className="font-bold text-primary">Rp {itemTotal.toLocaleString('id-ID', { maximumFractionDigits: 0 })}</span>
                        </div>
                      </div>
                    )
                  })}
                </div>

                {requestId && !isKingInternal && (
                  <label className="mt-2 flex cursor-pointer items-center gap-2 rounded-lg border border-white/10 bg-white/5 p-2.5">
                    <input type="checkbox" checked={designService} onChange={e => setDesignService(e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-primary" />
                    <span className="text-xs font-medium text-foreground/80">Jasa Desain Logo (+Rp 50.000)</span>
                  </label>
                )}
              </section>

              <section className="rounded-xl border border-white/10 bg-white/5 p-2.5 md:p-3">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <h2 className="text-base font-bold text-foreground">Pembayaran</h2>
                  {!isExistingOrder && <div className="rounded-lg border border-primary/20 bg-primary/10 px-2.5 py-1.5 text-right">
                    <p className="text-[10px] font-medium text-primary/80">Total pesanan</p>
                    <p className="text-base font-bold text-primary">Rp {grandTotal.toLocaleString('id-ID', { maximumFractionDigits: 0 })}</p>
                  </div>}
                </div>

                {isExistingOrder ? (
                  <>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="min-w-0 rounded-lg border border-primary/20 bg-primary/5 p-2">
                        <span className="block text-[10px] leading-tight text-foreground/55">Total pesanan</span>
                        <strong className="mt-1 block break-words text-xs font-bold text-primary sm:text-sm">Rp {grandTotal.toLocaleString('id-ID', { maximumFractionDigits: 0 })}</strong>
                      </div>
                      <div className="min-w-0 rounded-lg border border-green-500/15 bg-green-500/5 p-2">
                        <span className="block text-[10px] leading-tight text-foreground/55">Sudah dibayar</span>
                        <strong className="mt-1 block break-words text-xs font-bold text-green-400 sm:text-sm">Rp {Number(dpAmount).toLocaleString('id-ID', { maximumFractionDigits: 0 })}</strong>
                      </div>
                      <div className="min-w-0 rounded-lg border border-yellow-500/15 bg-yellow-500/5 p-2">
                        <span className="block text-[10px] leading-tight text-foreground/55">Belum dibayar</span>
                        <strong className={`mt-1 block break-words text-xs font-bold sm:text-sm ${remaining > 0 ? 'text-yellow-400' : 'text-green-400'}`}>Rp {Math.max(0, remaining).toLocaleString('id-ID', { maximumFractionDigits: 0 })}</strong>
                      </div>
                    </div>
                    {isKingInternal && <div className="mt-2 rounded-lg border border-primary/20 bg-primary/5 px-2.5 py-2 text-[11px] leading-relaxed text-foreground/70">
                      Pembelian internal KING lunas otomatis. Saldo virtual KING berkurang; rekening BCA, Mandiri, dan Cash tidak berubah.
                    </div>}
                  </>
                ) : isKingInternal ? (
                  <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs text-foreground/70">
                    Pesanan langsung lunas secara internal. Saldo virtual KING berkurang Rp {grandTotal.toLocaleString('id-ID', { maximumFractionDigits: 0 })}; rekening BCA, Mandiri, dan Cash tidak berubah.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-foreground/70">DP / Dibayar (Rp)</label>
                      <input type="text" value={formatRp(dpAmount)} onChange={e => setDpAmount(parseRp(e.target.value))} disabled={isMarketplace} className={`glass-input w-full text-sm ${isMarketplace ? 'cursor-not-allowed opacity-50' : ''}`} />
                      {isMarketplace && <p className="text-[10px] text-yellow-400">Marketplace otomatis Tempo.</p>}
                    </div>
                    {dpAmount > 0 && !isMarketplace && (
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-foreground/70">Metode Pembayaran DP</label>
                        <CustomSelect value={paymentAccount} onChange={e => setPaymentAccount(e.target.value)} options={[{ value: '', label: 'Pilih Rekening...' }, ...(dropdownConfig.payment_method || ['BCA', 'MANDIRI', 'CASH']).map(value => ({ value, label: value }))]} />
                      </div>
                    )}
                    <div className="rounded-lg border border-white/5 bg-black/10 p-2 text-xs sm:col-span-2">
                      <div className="flex items-center justify-between"><span className="text-foreground/60">Sisa Tagihan</span><strong className={remaining > 0 ? 'text-yellow-400' : 'text-green-400'}>Rp {Math.max(0, remaining).toLocaleString('id-ID', { maximumFractionDigits: 0 })}</strong></div>
                    </div>
                  </div>
                )}

                {isExistingOrder && (
                  <div className="mt-3 border-t border-white/10 pt-3">
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <h3 className="text-xs font-bold text-foreground">
                        {isKingInternal ? 'Riwayat Pembelian Internal' : 'Riwayat Pembayaran'}
                      </h3>
                      {!isLoadingPaymentHistory && <span className="text-[10px] text-foreground/45">{paymentHistory.length} catatan</span>}
                    </div>
                    {isLoadingPaymentHistory ? (
                      <p className="py-2 text-[11px] text-foreground/50">Memuat riwayat pembayaran...</p>
                    ) : paymentHistory.length === 0 ? (
                      <p className="py-2 text-[11px] text-foreground/50">Belum ada riwayat pembayaran.</p>
                    ) : (
                      <div>
                        <div className="grid grid-cols-[1fr_0.75fr_1fr] gap-2 px-1 pb-1 text-[9px] font-semibold uppercase tracking-wide text-foreground/40">
                          <span>Tanggal</span>
                          <span>Metode</span>
                          <span className="text-right">Nominal</span>
                        </div>
                        <div className="max-h-32 divide-y divide-white/5 overflow-y-auto pr-1">
                          {paymentHistory.map(payment => {
                            const isOutflow = Number(payment.amount_out || 0) > 0
                            const amount = isOutflow ? payment.amount_out : payment.amount_in
                            return (
                              <div key={payment.id} className="grid grid-cols-[1fr_0.75fr_1fr] items-center gap-2 py-2 text-[11px]">
                                <span className="text-foreground/75">{new Date(payment.date).toLocaleDateString('id-ID')}</span>
                                <span className="truncate text-foreground/60">{payment.payment_method || '-'}</span>
                                <span className={`text-right font-bold ${isOutflow ? 'text-orange-400' : 'text-green-400'}`}>
                                  {isOutflow ? '− ' : ''}Rp {Number(amount || 0).toLocaleString('id-ID', { maximumFractionDigits: 0 })}
                                </span>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </section>

              <section className="rounded-xl border border-white/10 bg-white/5 px-2.5 py-2">
                <details>
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-xs font-medium text-foreground/70">
                    <span>Catatan <span className="text-foreground/40">(opsional)</span></span>
                    <span className="text-[11px] text-foreground/40">Tambah catatan</span>
                  </summary>
                  <textarea value={notes} onChange={e => setNotes(e.target.value)} className="glass-input mt-2 h-12 w-full resize-none text-sm" placeholder="Catatan pesanan..." />
                </details>
              </section>
            </div>
          </div>

          <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 bg-background/95 px-3 py-2.5 backdrop-blur md:px-4">
            {initialData?.id && !isReorder && initialData.payment_status !== 'BATAL' && onCancel ? (
              <button type="button" onClick={() => onCancel(initialData.id, selectedCustomer?.name || 'pesanan', isKingInternal)} className="flex h-9 items-center whitespace-nowrap rounded-lg border border-red-500/30 bg-red-500/10 px-2.5 text-[11px] font-bold text-red-300 transition-colors hover:bg-red-500/20">
                Batalkan Pesanan
              </button>
            ) : <span />}
            <div className="ml-auto flex items-center gap-2">
              {initialData?.id && !isReorder && (
                <button type="button" onClick={() => setShowReorderConfirm(true)} title="Buat Sales Order baru dengan menyalin pelanggan dan item dari pesanan ini" className="flex h-9 items-center gap-1.5 whitespace-nowrap rounded-lg border border-white/10 bg-white/5 px-2.5 text-[11px] font-medium text-foreground/80 transition-colors hover:bg-white/10 hover:text-foreground">
                  <RotateCw className="h-3.5 w-3.5" /> Re-order
                </button>
              )}
              <button type="button" onClick={handleSubmit} disabled={loading} className="btn-primary flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap px-3 text-xs">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                {loading ? 'Memproses...' : requestId ? 'Konfirmasi' : isExistingOrder ? 'Simpan' : 'Simpan SO'}
              </button>
            </div>
          </footer>
        </aside>

        {showReorderConfirm && (
          <div className="fixed inset-0 z-[1400] flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm" onMouseDown={event => event.target === event.currentTarget && setShowReorderConfirm(false)}>
            <section role="dialog" aria-modal="true" aria-labelledby="reorder-confirm-title" className="w-full max-w-md overflow-hidden rounded-2xl border border-white/10 bg-background shadow-2xl">
              <div className="flex items-center gap-3 border-b border-white/10 bg-white/5 p-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary"><RotateCw className="h-5 w-5" /></span>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-primary">Sales Order baru</p>
                  <h2 id="reorder-confirm-title" className="font-bold text-foreground">Buat draf re-order?</h2>
                </div>
              </div>
              <div className="space-y-3 p-4">
                <p className="text-sm text-foreground/70">Rincian dari pesanan ini akan disalin ke draf baru:</p>
                <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-foreground/45">Pelanggan</p>
                      <p className="truncate text-sm font-semibold text-foreground">{localCustomers.find(c => c.customer_code === customerId || c.name === customerId)?.name || customerId || 'Belum dipilih'}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-foreground/45">{items.length} item</p>
                      <p className="text-sm font-bold text-primary">Rp {grandTotal.toLocaleString('id-ID', { maximumFractionDigits: 0 })}</p>
                    </div>
                  </div>
                  <div className="mt-2 space-y-1 border-t border-white/10 pt-2">
                    {items.slice(0, 3).map((item, index) => (
                      <div key={item.id || index} className="flex items-start justify-between gap-3 text-xs">
                        <span className="min-w-0 truncate text-foreground/70">{item.product_search || 'Produk belum dipilih'}</span>
                        <span className="shrink-0 text-foreground/50">{Number(item.qty || 0).toLocaleString('id-ID')} {item.unit || 'PCS'}</span>
                      </div>
                    ))}
                    {items.length > 3 && <p className="pt-1 text-[11px] text-foreground/45">+ {items.length - 3} item lainnya</p>}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-lg border border-white/5 bg-white/[0.03] p-2.5"><span className="text-foreground/45">Tanggal</span><p className="mt-0.5 font-medium text-foreground">Hari ini</p></div>
                  <div className="rounded-lg border border-white/5 bg-white/[0.03] p-2.5"><span className="text-foreground/45">Pembayaran</span><p className="mt-0.5 font-medium text-foreground">Mulai dari Rp 0</p></div>
                </div>
                <p className="rounded-lg border border-green-500/15 bg-green-500/5 px-3 py-2 text-xs text-foreground/60">Pembayaran dan referensi marketplace lama tidak disalin. Pesanan asal tetap utuh.</p>
              </div>
              <div className="flex justify-end gap-2 border-t border-white/10 bg-white/5 p-4">
                <button type="button" onClick={() => setShowReorderConfirm(false)} className="btn-secondary h-9 px-3 text-sm">Kembali</button>
                <button type="button" onClick={handleReorder} className="btn-primary flex h-9 items-center gap-1.5 px-3 text-sm"><RotateCw className="h-4 w-4" /> Buat Draf Re-order</button>
              </div>
            </section>
          </div>
        )}

        {showAddCustomer && (
          <div className="fixed inset-0 z-[1300] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onMouseDown={event => event.target === event.currentTarget && setShowAddCustomer(false)}>
            <div className="w-full max-w-md overflow-hidden rounded-2xl border border-white/10 bg-background shadow-2xl">
              <div className="border-b border-white/10 bg-white/5 p-4"><h3 className="font-bold text-foreground">Tambah Pelanggan Baru</h3></div>
              <div className="space-y-4 p-6">
                <p className="text-sm text-foreground/60">Pelanggan <b>{newCustomerName}</b> tidak ditemukan. Tambahkan sekarang?</p>
                <div className="space-y-1"><label className="text-xs font-medium text-foreground/80">Nama / Brand</label><input type="text" value={newCustomerName} onChange={e => setNewCustomerName(e.target.value)} className="glass-input w-full" /></div>
                <div className="space-y-1"><label className="text-xs font-medium text-foreground/80">No HP / WA</label><input type="text" value={newCustomerPhone} onChange={e => setNewCustomerPhone(e.target.value)} className="glass-input w-full" /></div>
                <div className="space-y-1"><label className="text-xs font-medium text-foreground/60">Tipe Pelanggan</label><CustomSelect value={newCustomerType} onChange={e => setNewCustomerType(e.target.value)} options={(dropdownConfig.customer_type || ['REGULLER', 'RESELLER', 'SHOPEE', 'TOKOPEDIA']).map(value => ({ value, label: value }))} /></div>
              </div>
              <div className="flex justify-end gap-3 border-t border-white/10 bg-white/5 p-4">
                <button type="button" onClick={() => setShowAddCustomer(false)} className="btn-secondary h-10 px-4 text-sm">Batal</button>
                <button type="button" onClick={handleAddCustomer} disabled={loading} className="btn-primary h-10 px-4 text-sm">{loading ? 'Menyimpan...' : 'Simpan Pelanggan'}</button>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">

      {/* Header & Stepper */}
      <div className="mb-8 flex items-center justify-between">
        <button onClick={() => router.back()} className="flex items-center gap-2 text-foreground/60 hover:text-primary transition-colors text-sm">
          <ArrowLeft className="w-4 h-4" /> Kembali
        </button>
        <h1 className="text-2xl font-bold text-foreground">{requestId ? 'Review Pesanan Customer' : initialData ? 'Edit Sales Order' : 'Buat Sales Order'}</h1>
        <div className="w-20" /> {/* Spacer */}
      </div>

      <div className="flex items-center justify-between mb-8 relative">
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 bg-white/5 -z-10 rounded-full" />
        <div className={`absolute left-0 top-1/2 -translate-y-1/2 h-1 bg-primary -z-10 rounded-full transition-all duration-300 ${
          isExistingOrder ? 'w-full' : (currentTab === 1 ? 'w-[15%]' : currentTab === 2 ? 'w-[50%]' : 'w-full')
        }`} />

        <StepIndicator step={1} current={isExistingOrder ? 3 : currentTab} icon={User} title="Info Umum" />
        <StepIndicator step={2} current={isExistingOrder ? 3 : currentTab} icon={ShoppingCart} title="Detail Pesanan" />
        { !isExistingOrder && <StepIndicator step={3} current={currentTab} icon={CreditCard} title="Pembayaran" /> }
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
            {isKingInternal && <p className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-sm text-foreground/70">Pembelian internal KING: hanya barang stok GUDANG/GLOBAL. Stok tersedia dan fisik dipotong saat disimpan.</p>}

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
                    <div className="md:col-span-3">
                      <label className="text-xs font-medium text-foreground/60 mb-1 block">Jenis Pesanan</label>
                      <div role="group" aria-label={`Jenis pesanan item ${index + 1}`} className="flex flex-wrap gap-1.5">
                        {orderTypes.map(type => {
                          const isSelected = item.order_type === type
                          return (
                            <button
                              key={type}
                              type="button"
                              aria-pressed={isSelected}
                              onClick={() => handleItemChange(item.id, 'order_type', type)}
                              className={`h-8 rounded-lg border px-3 text-xs font-semibold transition-colors ${isSelected ? 'border-primary/50 bg-primary/15 text-primary' : 'border-white/10 bg-white/5 text-foreground/70 hover:border-primary/40 hover:text-foreground'}`}
                            >
                              {type}
                            </button>
                          )
                        })}
                      </div>
                    </div>

                    {/* Urutan 3: Ukuran/Produk */}
                    <div className="space-y-2 md:col-span-3">
                      <label className="text-xs font-medium text-foreground/80">Cari Produk</label>
                      <SuggestField
                        value={item.product_id}
                        onChange={e => handleItemChange(item.id, 'product_search', e.target.value)}
                        options={productOptionsByItem.get(item.id) || []}
                        placeholder="Ketik produk atau kategori..."
                        disabled={!item.order_type}
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-medium text-foreground/80">Qty</label>
                      <input
                        type="text"
                        value={formatRp(item.qty)}
                        onBlur={(e) => {
                          const val = parseRp(e.target.value);
                          const minQty = getMinQty({
                            orderType: item.order_type,
                            category: item.category,
                            printingColors: item.printingColors,
                            pricelistConfig
                          });
                          if (val < minQty) {
                            handleItemChange(item.id, 'qty', minQty);
                          }
                        }}
                        onChange={e => handleItemChange(item.id, 'qty', parseRp(e.target.value))}
                        className="glass-input w-full text-sm px-2"
                      />
                    </div>

                    <div className="space-y-1 col-span-2">
                      <label className="text-xs text-foreground/60 block">Satuan</label>
                      <CustomSelect
                        value={item.unit}
                        onChange={e => handleItemChange(item.id, 'unit', e.target.value)}
                        options={(() => {
                          const p = products.find(prod => prod.product_code === item.product_id)
                          const base = [{ value: 'PCS', label: 'PCS' }]
                          if (item.order_type?.toUpperCase() !== 'SABLON' && item.order_type?.toUpperCase() !== 'PRINTING' && p && p.product_units && p.product_units.length > 0) {
                            return [...base, ...p.product_units.map(u => ({ value: u.unit_name, label: u.unit_name }))]
                          }
                          return base
                        })()}
                        disabled={['SABLON', 'PRINTING'].includes(item.order_type?.toUpperCase()) || !item.product_search}
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-medium text-foreground/80">Harga Satuan (Rp)</label>
                      <input type="text" value={formatRp(item.price)} onChange={e => handleItemChange(item.id, 'price', parseRp(e.target.value))} className="glass-input w-full text-sm" />
                    </div>
                  </div>

                  {(() => {
                    let itemTotal = Number(item.qty) * Number(item.price);
                    if (item.isFastTrack) {
                      const qtyFastTrack = Math.ceil(Number(item.qty) * Number(item.unit_multiplier || 1) / 1000);
                      itemTotal += 100000 * qtyFastTrack;
                    }
                    if (item.isTwoColor) {
                      const actualQty = Number(item.qty) * Number(item.unit_multiplier || 1);
                      itemTotal += 250 * actualQty;
                    }
                    return (
                      <div className="mt-4 pt-4 border-t border-white/5 flex justify-between items-center text-sm">
                        <span className="text-foreground/60">Subtotal Item:</span>
                        <span className="font-bold text-primary text-base">Rp {itemTotal.toLocaleString('id-ID', { maximumFractionDigits: 0 })}</span>
                      </div>
                    )
                  })()}

                  {item.order_type?.toUpperCase() === 'SABLON' && (
                    <div className="mt-4 pt-4 border-t border-white/5 space-y-4">
                      <div className="flex flex-col sm:flex-row gap-4">
                        <label className="flex items-center gap-3 cursor-pointer group bg-white/5 p-3 rounded-xl border border-white/10 flex-1 hover:bg-white/10 transition-colors">
                          <input
                            type="checkbox"
                            className="w-5 h-5 rounded border-gray-300 text-primary"
                            checked={item.isFastTrack || false}
                            onChange={(e) => handleItemChange(item.id, 'isFastTrack', e.target.checked)}
                          />
                          <div>
                            <p className="font-bold text-sm text-red-400">🔥 Jalur Fast Track</p>
                            <p className="text-[10px] text-foreground/60">+ Rp 100.000 / 1000 pcs</p>
                          </div>
                        </label>
                        <label className="flex items-center gap-3 cursor-pointer group bg-white/5 p-3 rounded-xl border border-white/10 flex-1 hover:bg-white/10 transition-colors">
                          <input
                            type="checkbox"
                            className="w-5 h-5 rounded border-gray-300 text-yellow-500"
                            checked={item.isTwoColor || false}
                            onChange={(e) => handleItemChange(item.id, 'isTwoColor', e.target.checked)}
                          />
                          <div>
                            <p className="font-bold text-sm text-yellow-500">🎨 Sablon 2 Warna</p>
                            <p className="text-[10px] text-foreground/60">+ Rp 250 / pcs</p>
                          </div>
                        </label>
                      </div>

                      <div className="space-y-2">
                        <label className="text-xs font-medium text-foreground/80 truncate block">URL Mockup / Desain</label>
                        <input type="url" placeholder="https://..." value={item.mockup_url || ''} onChange={e => handleItemChange(item.id, 'mockup_url', e.target.value)} className="glass-input w-full text-sm text-blue-400" />
                      </div>
                    </div>
                  )}

                  {item.order_type?.toUpperCase() === 'PRINTING' && (
                    <div className="mt-4 pt-4 border-t border-white/5 space-y-4">
                      <div className="flex flex-col sm:flex-row gap-4">
                        <label className="flex items-center gap-3 cursor-pointer group bg-white/5 p-3 rounded-xl border border-white/10 flex-1 hover:bg-white/10 transition-colors">
                          <input
                            type="radio"
                            name={`printingColor_${item.id}`}
                            className="w-5 h-5 rounded-full border-gray-300 text-blue-500"
                            checked={item.printingColors === '3 Warna'}
                            onChange={() => handleItemChange(item.id, 'printingColors', '3 Warna')}
                          />
                          <div>
                            <p className="font-bold text-sm text-blue-400">🎨 Printing 3 Warna</p>
                            <p className="text-[10px] text-foreground/60">Sesuai matriks printing</p>
                          </div>
                        </label>
                        <label className="flex items-center gap-3 cursor-pointer group bg-white/5 p-3 rounded-xl border border-white/10 flex-1 hover:bg-white/10 transition-colors">
                          <input
                            type="radio"
                            name={`printingColor_${item.id}`}
                            className="w-5 h-5 rounded-full border-gray-300 text-purple-500"
                            checked={item.printingColors === '4 Warna'}
                            onChange={() => handleItemChange(item.id, 'printingColors', '4 Warna')}
                          />
                          <div>
                            <p className="font-bold text-sm text-purple-400">🎨 Printing 4 Warna</p>
                            <p className="text-[10px] text-foreground/60">Sesuai matriks printing</p>
                          </div>
                        </label>
                      </div>

                      <div className="space-y-2">
                        <label className="text-xs font-medium text-foreground/80 truncate block">URL Mockup / Desain</label>
                        <input type="url" placeholder="https://..." value={item.mockup_url || ''} onChange={e => handleItemChange(item.id, 'mockup_url', e.target.value)} className="glass-input w-full text-sm text-blue-400" />
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {requestId && !isKingInternal && (
              <label className="flex items-center gap-3 p-3 rounded-xl border border-white/10 bg-white/5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={designService}
                  onChange={e => setDesignService(e.target.checked)}
                  className="w-5 h-5 rounded border-gray-300 text-primary focus:ring-primary"
                />
                <span className="text-sm font-medium text-foreground/80">Jasa Desain Logo (+Rp 50.000)</span>
              </label>
            )}

            <div className="flex justify-between pt-4 border-t border-white/5">
              <button onClick={() => setCurrentTab(1)} className="btn-secondary flex items-center gap-2">
                 Kembali
              </button>
              {isExistingOrder ? (
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

            {isExistingOrder && (
              <section className="rounded-xl border border-white/10 bg-white/5 p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h3 className="text-sm font-bold text-foreground">
                    {isKingInternal ? 'Riwayat Pembelian Internal' : 'Riwayat Pembayaran'}
                  </h3>
                  {!isLoadingPaymentHistory && <span className="text-[11px] text-foreground/50">{paymentHistory.length} catatan</span>}
                </div>
                {isLoadingPaymentHistory ? (
                  <p className="text-xs text-foreground/50">Memuat riwayat pembayaran...</p>
                ) : paymentHistory.length === 0 ? (
                  <p className="text-xs text-foreground/50">Belum ada riwayat pembayaran.</p>
                ) : (
                  <div className="divide-y divide-white/10">
                    {paymentHistory.map(payment => {
                      const isOutflow = Number(payment.amount_out || 0) > 0
                      const amount = isOutflow ? payment.amount_out : payment.amount_in
                      return (
                        <div key={payment.id} className="grid grid-cols-[1fr_auto] items-center gap-3 py-2.5 text-xs sm:grid-cols-[1fr_1fr_auto]">
                          <span className="text-foreground/80">{new Date(payment.date).toLocaleDateString('id-ID')}</span>
                          <span className="text-foreground/60">{payment.payment_method || '-'}</span>
                          <span className={`text-right font-bold ${isOutflow ? 'text-orange-400' : 'text-green-400'}`}>
                            {isOutflow ? '−' : '+'} Rp {Number(amount || 0).toLocaleString('id-ID', { maximumFractionDigits: 0 })}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </section>
            )}

            <div className="p-6 rounded-xl bg-primary/10 border border-primary/20 flex flex-col md:flex-row items-center justify-between gap-4">
              <div>
                <p className="text-sm text-primary/80 font-medium">Grand Total Tagihan</p>
                <p className="metric-value-prominent mt-1 text-primary">Rp {grandTotal.toLocaleString('id-ID', { maximumFractionDigits: 0 })}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-foreground/60">Total Item</p>
                <p className="metric-value-compact text-foreground">{items.length} Macam</p>
              </div>
            </div>

            {isKingInternal ? (
              <div className="mt-6 rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm text-foreground/75">
                <p className="font-semibold text-primary">Pembelian internal KING</p>
                <p className="mt-1">Saldo virtual KING berkurang Rp {grandTotal.toLocaleString('id-ID', { maximumFractionDigits: 0 })}. Rekening BCA, Mandiri, dan Cash tidak berubah. Barang langsung dianggap selesai dan stok GUDANG/GLOBAL berkurang saat disimpan.</p>
              </div>
            ) : (
              <>
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
                  Rp {remaining.toLocaleString('id-ID', { maximumFractionDigits: 0 })}
                </span>
              </div>
            </div>
              </>
            )}

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
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onMouseDown={event => event.target === event.currentTarget && setShowAddCustomer(false)}>
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
                    ...(dropdownConfig.customer_type || ["REGULLER", "RESELLER", "SHOPEE", "TOKOPEDIA"]).map(t => ({ value: t, label: t }))
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
