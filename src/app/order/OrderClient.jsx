'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import Image from 'next/image'
import { ArrowLeft, Check, ChevronDown, ChevronRight, Image as ImageIcon, ShoppingBag, ShoppingCart, Trash2, X } from 'lucide-react'
import { calculateItemPrice as calculateItemPriceUtil, getMinQty } from '@/utils/pricing'

const formatRp = (value) => new Intl.NumberFormat('id-ID', {
  style: 'currency', currency: 'IDR', minimumFractionDigits: 0, maximumFractionDigits: 0,
}).format(value)

const primaryButton = 'inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#755615] px-5 py-3 text-sm font-bold text-white hover:bg-[#60460f] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#755615] disabled:cursor-not-allowed disabled:opacity-50'
const inputStyle = 'w-full rounded-xl border border-stone-300 bg-white px-4 py-3 text-base text-stone-900 outline-none focus:border-[#755615] focus:ring-2 focus:ring-[#e8dbb7]'
const CATEGORY_GROUPS = [
  { name: 'Cup PP', categories: ['CUP PP', 'CUP GOCUP'] },
  { name: 'Tutup Cup', categories: ['TUTUP CUP PP', 'TUTUP GOCUP', 'TUTUP CUP PET', 'TUTUP CUP INJECT', 'TUTUP PAPERCUP'] },
  { name: 'Kemasan Lain', categories: ['BOX DUS', 'BOTOL', 'SEDOTAN'] },
]
const CATEGORY_DESCRIPTIONS = {
  'CUP PP': 'Bahan PP · Gramasi 5,2–9 gram · Bentuk Flat, Oval, Slim. DK = diameter kecil; DB = diameter besar. GAC adalah cup PP reguler dengan tutup injection, seperti Mixue. Cup reguler bisa disegel dengan mesin press, seperti Chatime dan Kopi Kenangan.',
  'TUTUP CUP': 'Bentuk tutup: Flat, Cembung, dan Strawless.',
  'KEMASAN LAIN': 'Bahan: beragam · Gramasi: — · Bentuk: dus/kotak, botol, sedotan.',
  'CUP PET': 'Bahan PET Clear · Gramasi 12–15 gram · Bentuk Flat/Oval, seperti cup Starbucks dan J.CO.',
  'CUP INJECT': 'Bahan plastik injection · Gramasi 15–25 gram · Tekstur Frost/Glossy · Bentuk Flat/Oval, seperti cup Fore dan kafe premium.',
  PAPERCUP: 'Bahan: kertas · Gramasi: — · Bentuk: cup, termasuk Double Wall (DW).',
  PAPERBOWL: 'Bahan: kertas · Gramasi: — · Bentuk: bowl.',
  SEALER: 'Plastik sealer untuk Cup PP dan tutup plastik yang dipress dengan mesin press.',
  PLASTIK: 'Varian: bening cup, HD plong, kresek, dan plong brownies.',
  TINTA: 'Bahan: tinta · Gramasi: — · Bentuk: cair.',
}
const CATEGORY_FILTER_LABELS = {
  'TUTUP CUP PP': 'Cup PP',
  'TUTUP GOCUP': 'GOCUP',
  'TUTUP CUP PET': 'Cup PET',
  'TUTUP CUP INJECT': 'Inject',
  'TUTUP PAPERCUP': 'Paper Cup',
  'BOX DUS': 'Dus/Kotak',
  BOTOL: 'Botol',
  SEDOTAN: 'Sedotan',
}
const PLASTIC_VARIANT_ORDER = ['Bening', 'HD Plong', 'Kresek', 'Plong', 'Lainnya']

function getPlasticVariant(productName) {
  const name = String(productName || '').trim()
  if (/^HD\s*Plong\b/i.test(name)) return 'HD Plong'
  if (/^Bening\b/i.test(name)) return 'Bening'
  if (/^Kresek\b/i.test(name)) return 'Kresek'
  if (/\bPlong\b/i.test(name)) return 'Plong'
  return 'Lainnya'
}

function getProductBrand(product) {
  if (product?.category === 'CUP PP') return 'Starindo'
  if (product?.category === 'CUP GOCUP') return 'GOCUP'
  return ''
}

function getProductSize(productName) {
  const match = String(productName || '').match(/(\d+(?:[.,]\d+)?)\s*(oz|ml)\b/i)
  if (!match) return ''
  const amount = Number(match[1].replace(',', '.'))
  return `${amount.toLocaleString('id-ID')} ${match[2].toLowerCase()}`
}

function OrderDialog({ children, titleId, onClose, locked = false, drawer = false }) {
  const ref = useRef(null)

  useEffect(() => {
    const dialog = ref.current
    if (dialog && !dialog.open) dialog.showModal()
    return () => { if (dialog?.open) dialog.close() }
  }, [])

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(event) => { event.preventDefault(); if (!locked) onClose() }}
      onClick={(event) => { if (event.target === event.currentTarget && !locked) onClose() }}
      className={drawer
        ? 'fixed inset-y-0 right-0 left-auto m-0 h-dvh max-h-none w-full max-w-md overflow-hidden bg-white p-0 text-stone-900 shadow-xl backdrop:bg-black/40'
        : 'fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-lg overflow-hidden rounded-2xl bg-white p-0 text-stone-900 shadow-xl backdrop:bg-black/40'}
    >
      {children}
    </dialog>
  )
}

function LightSelect({ id, value, options, onChange, placeholder, ariaLabel, labelledBy }) {
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const [menuHost, setMenuHost] = useState(null)
  const [menuPosition, setMenuPosition] = useState(null)
  const rootRef = useRef(null)
  const triggerRef = useRef(null)
  const menuRef = useRef(null)
  const optionRefs = useRef([])
  const selectedIndex = Math.max(0, options.findIndex(option => option.value === value))
  const selectedOption = options.find(option => option.value === value)

  const getMenuPosition = useCallback(() => {
    const rect = triggerRef.current?.getBoundingClientRect()
    if (!rect) return null
    const margin = 12
    const viewport = window.visualViewport
    const viewportTop = viewport?.offsetTop ?? 0
    const viewportLeft = viewport?.offsetLeft ?? 0
    const viewportWidth = viewport?.width ?? window.innerWidth
    const viewportHeight = viewport?.height ?? window.innerHeight
    const viewportBottom = viewportTop + viewportHeight
    const desiredHeight = Math.min(240, options.length * 44 + 8)
    const spaceBelow = Math.max(0, viewportBottom - rect.bottom - margin)
    const spaceAbove = Math.max(0, rect.top - viewportTop - margin)
    const placeAbove = spaceBelow < desiredHeight && spaceAbove > spaceBelow
    const availableSpace = placeAbove ? spaceAbove : spaceBelow
    const maxHeight = Math.max(0, Math.min(desiredHeight, availableSpace))
    const width = Math.min(rect.width, Math.max(0, viewportWidth - margin * 2))
    return {
      top: placeAbove ? Math.max(viewportTop + margin, rect.top - maxHeight - 4) : Math.min(rect.bottom + 4, viewportBottom - maxHeight - margin),
      left: Math.max(viewportLeft + margin, Math.min(rect.left, viewportLeft + viewportWidth - width - margin)),
      width,
      maxHeight,
    }
  }, [options.length])

  function showMenu() {
    setMenuHost(rootRef.current?.closest('dialog') || document.body)
    setMenuPosition(getMenuPosition())
    setActiveIndex(selectedIndex)
    setOpen(true)
  }

  useEffect(() => {
    if (!open) return undefined
    const closeOutside = event => {
      if (!rootRef.current?.contains(event.target) && !menuRef.current?.contains(event.target)) setOpen(false)
    }
    document.addEventListener('pointerdown', closeOutside)
    return () => document.removeEventListener('pointerdown', closeOutside)
  }, [open])

  useEffect(() => {
    if (!open) return undefined
    const updatePosition = () => setMenuPosition(getMenuPosition())
    window.addEventListener('resize', updatePosition)
    document.addEventListener('scroll', updatePosition, true)
    window.visualViewport?.addEventListener('resize', updatePosition)
    window.visualViewport?.addEventListener('scroll', updatePosition)
    return () => {
      window.removeEventListener('resize', updatePosition)
      document.removeEventListener('scroll', updatePosition, true)
      window.visualViewport?.removeEventListener('resize', updatePosition)
      window.visualViewport?.removeEventListener('scroll', updatePosition)
    }
  }, [getMenuPosition, open])

  useEffect(() => {
    if (open) optionRefs.current[activeIndex]?.scrollIntoView({ block: 'nearest' })
  }, [open, activeIndex])

  function handleKeyDown(event) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      const direction = event.key === 'ArrowDown' ? 1 : -1
      setActiveIndex(current => open
        ? (current + direction + options.length) % options.length
        : selectedIndex)
      setOpen(true)
    } else if (event.key === 'Home' && open) {
      event.preventDefault()
      setActiveIndex(0)
    } else if (event.key === 'End' && open) {
      event.preventDefault()
      setActiveIndex(options.length - 1)
    } else if ((event.key === 'Enter' || event.key === ' ') && open) {
      event.preventDefault()
      if (options[activeIndex]) onChange(options[activeIndex].value)
      setOpen(false)
    } else if (event.key === 'Escape' && open) {
      event.preventDefault()
      setOpen(false)
    } else if ((event.key === 'Enter' || event.key === ' ') && !open) {
      event.preventDefault()
      setActiveIndex(selectedIndex)
      setOpen(true)
    }
  }

  const menu = open && menuHost && menuPosition ? createPortal(
    <div
      ref={menuRef}
      id={`${id}-options`}
      role="listbox"
      aria-label={ariaLabel}
      className="fixed z-[2147483647] overflow-y-auto rounded-xl border border-stone-200 bg-white p-1 text-stone-900 shadow-xl"
      style={{ ...menuPosition, scrollbarColor: '#d6d3d1 #f5f5f4', scrollbarWidth: 'thin' }}
    >
      {options.map((option, index) => <div
        key={option.value || 'placeholder'}
        ref={element => { optionRefs.current[index] = element }}
        id={`${id}-option-${index}`}
        role="option"
        aria-selected={option.value === value}
        onMouseEnter={() => setActiveIndex(index)}
        onMouseDown={event => event.preventDefault()}
        onClick={() => { onChange(option.value); setOpen(false) }}
        className={`flex min-h-11 cursor-pointer items-center rounded-lg px-3 text-sm ${index === activeIndex ? 'bg-[#f8f4ea]' : 'bg-white'} ${option.value === value ? 'font-semibold text-[#755615]' : 'text-stone-800'}`}
      >{option.label}</div>)}
    </div>,
    menuHost,
  ) : null

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        id={id}
        type="button"
        role="combobox"
        aria-label={ariaLabel}
        aria-labelledby={labelledBy}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`${id}-options`}
        aria-activedescendant={open ? `${id}-option-${activeIndex}` : undefined}
        onKeyDown={handleKeyDown}
        onBlur={event => { if (!rootRef.current?.contains(event.relatedTarget)) setOpen(false) }}
        onClick={() => { if (open) setOpen(false); else showMenu() }}
        className={`${inputStyle} flex items-center justify-between gap-3 text-left`}
      >
        <span className={selectedOption ? 'text-stone-900' : 'text-stone-500'}>{selectedOption?.label || placeholder}</span>
        <ChevronDown aria-hidden="true" className="h-4 w-4 shrink-0 text-stone-500" />
      </button>
      {menu}
    </div>
  )
}

function CloseButton({ onClick, label = 'Tutup' }) {
  return <button type="button" onClick={onClick} aria-label={label} className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-stone-600 hover:bg-stone-100 focus-visible:outline-2 focus-visible:outline-[#755615]"><X className="h-5 w-5" /></button>
}

function CategoryImage({ src }) {
  const [failed, setFailed] = useState(false)
  if (!src || failed) return <ImageIcon aria-hidden="true" className="h-10 w-10 text-stone-400" />
  return <Image src={src} alt="" fill sizes="(max-width: 639px) 50vw, (max-width: 1023px) 33vw, 240px" unoptimized={!src.startsWith('/')} className="object-contain p-3" onError={() => setFailed(true)} />
}

export default function OrderClient({ products, productUnits = [], dropdownConfig, pricelistConfig = {}, categoryImagesConfig = {} }) {
  const orderTypes = useMemo(() => {
    const configured = Array.from(new Set(dropdownConfig.order_type || ['SABLON', 'PRINTING', 'POLOS']))
    return configured.filter(type => ['SABLON', 'PRINTING', 'POLOS'].includes(type.toUpperCase()))
  }, [dropdownConfig])
  const [activeType, setActiveType] = useState(orderTypes[0] || 'SABLON')
  const [category, setCategory] = useState('')
  const [categoryMembers, setCategoryMembers] = useState([])
  const [selectedSize, setSelectedSize] = useState('')
  const [selectedVariant, setSelectedVariant] = useState('')
  const [cart, setCart] = useState([])
  const [designService, setDesignService] = useState(false)
  const [cartOpen, setCartOpen] = useState(false)
  const [editor, setEditor] = useState(null)
  const [includeLid, setIncludeLid] = useState(false)
  const [lidProduct, setLidProduct] = useState('')
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [brandName, setBrandName] = useState('')
  const [waNumber, setWaNumber] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [checkoutError, setCheckoutError] = useState('')
  const [notice, setNotice] = useState('')
  const nextItemId = useRef(0)
  const submittingRef = useRef(false)

  useEffect(() => {
    const root = document.documentElement
    const lightStyles = {
      'color-scheme': 'light',
      '--background': '#f8f7f4',
      '--foreground': '#1c1917',
      '--scroll-track': '#f5f5f4',
      '--scroll-thumb': '#d6d3d1',
      '--scroll-thumb-hover': '#a8a29e',
    }
    const previousStyles = Object.fromEntries(Object.keys(lightStyles).map(property => [
      property,
      { value: root.style.getPropertyValue(property), priority: root.style.getPropertyPriority(property) },
    ]))

    Object.entries(lightStyles).forEach(([property, value]) => root.style.setProperty(property, value))
    return () => Object.entries(previousStyles).forEach(([property, previous]) => {
      if (previous.value) root.style.setProperty(property, previous.value, previous.priority)
      else root.style.removeProperty(property)
    })
  }, [])

  useEffect(() => {
    if (!notice) return
    const timeout = window.setTimeout(() => setNotice(''), 3000)
    return () => window.clearTimeout(timeout)
  }, [notice])

  const categories = useMemo(() => {
    const available = [...new Set(products.map(product => product.category))].filter(Boolean)
    const mapped = dropdownConfig?.category_mapping?.[activeType]
    const visibleCategories = mapped?.length ? mapped.filter(name => available.includes(name)) : available
    const displayCategories = []
    const addedGroups = new Set()

    for (const sourceCategory of visibleCategories) {
      const group = CATEGORY_GROUPS.find(item => item.categories.includes(sourceCategory))
      if (!group) {
        displayCategories.push({ name: sourceCategory, categories: [sourceCategory] })
        continue
      }
      if (addedGroups.has(group.name)) continue
      addedGroups.add(group.name)
      displayCategories.push({
        name: group.name,
        categories: group.categories.filter(name => visibleCategories.includes(name)),
      })
    }

    return displayCategories
  }, [products, dropdownConfig, activeType])
  const categoryProducts = useMemo(() => products.filter(product => categoryMembers.includes(product.category)), [products, categoryMembers])
  const categoryDescription = CATEGORY_DESCRIPTIONS[category.toUpperCase()]
  const sizeOptions = useMemo(() => {
    if (!categoryProducts.length) return []
    const sizes = categoryProducts.map(product => getProductSize(product.name))
    if (sizes.some(size => !size)) return []
    const uniqueSizes = [...new Set(sizes)]
    if (uniqueSizes.length < 2) return []
    return uniqueSizes.sort((left, right) => {
      const [, leftUnit] = left.split(' ')
      const [, rightUnit] = right.split(' ')
      if (leftUnit !== rightUnit) return leftUnit.localeCompare(rightUnit)
      return Number(left.split(' ')[0]) - Number(right.split(' ')[0])
    })
  }, [categoryProducts])
  const categoryVariantOptions = useMemo(() => {
    const categoryKey = category.toUpperCase()
    if (categoryKey === 'PLASTIK') {
      const availableVariants = new Set(categoryProducts.map(product => getPlasticVariant(product.name)))
      return PLASTIC_VARIANT_ORDER.filter(variant => availableVariants.has(variant)).map(value => ({ value, label: value }))
    }
    if (categoryKey === 'TUTUP CUP' || categoryKey === 'KEMASAN LAIN') {
      return categoryMembers.map(value => ({ value, label: CATEGORY_FILTER_LABELS[value] || value }))
    }
    return []
  }, [category, categoryMembers, categoryProducts])
  const variantFilterTitle = category.toUpperCase() === 'PLASTIK' ? 'Jenis plastik' : category.toUpperCase() === 'TUTUP CUP' ? 'Kategori tutup' : 'Jenis kemasan'
  const variantProducts = selectedVariant
    ? category.toUpperCase() === 'PLASTIK'
      ? categoryProducts.filter(product => getPlasticVariant(product.name) === selectedVariant)
      : categoryProducts.filter(product => product.category === selectedVariant)
    : categoryProducts
  const visibleProducts = selectedSize ? variantProducts.filter(product => getProductSize(product.name) === selectedSize) : variantProducts
  const packageUnits = useMemo(() => {
    const units = new Map()
    for (const unit of productUnits) {
      const name = unit.unit_name?.trim().toUpperCase()
      const multiplier = Number(unit.multiplier)
      if (!['ROLL', 'PACK'].includes(name) || !Number.isInteger(multiplier) || multiplier <= 0) continue
      if (!units.has(unit.product_code) || name === 'ROLL') units.set(unit.product_code, { name: name.toLowerCase(), multiplier })
    }
    return units
  }, [productUnits])
  const selectedProduct = editor && products.find(product => product.id === editor.productId)
  const selectedPackage = editor?.type === 'POLOS' && selectedProduct ? packageUnits.get(selectedProduct.product_code) : null
  const editing = Boolean(editor?.id)
  const minQty = editor ? getMinQty({ orderType: editor.type, category: selectedProduct?.category, printingColors: editor.printingColors, pricelistConfig }) : 0
  const validQty = editor && Number.isInteger(Number(editor.qty)) && Number(editor.qty) > 0 && Number(editor.qty) >= minQty
  const lidCategory = useMemo(() => {
    const name = selectedProduct?.category || ''
    if (name.includes('PET')) return 'TUTUP CUP PET'
    if (name.includes('PP')) return 'TUTUP CUP PP'
    if (name.includes('INJECT')) return 'TUTUP CUP INJECT'
    if (name.includes('PAPERCUP')) return 'TUTUP PAPERCUP'
    if (name.includes('GOCUP')) return 'TUTUP GOCUP'
    return ''
  }, [selectedProduct])
  const lids = useMemo(() => products.filter(product => product.category === lidCategory), [products, lidCategory])
  const lidType = orderTypes.includes('POLOS') ? 'POLOS' : orderTypes[0]

  const priceFor = (item) => {
    const product = products.find(entry => entry.id === item.productId)
    if (!product) return 0
    return calculateItemPriceUtil({ product, qty: Number(item.qty) || 1, orderType: item.type, isTwoColor: item.isTwoColor, printingColors: item.printingColors, pricelistConfig })
  }
  const subtotal = cart.reduce((sum, item) => sum + priceFor(item) * item.qty, 0)
  const fastTrackTotal = cart.reduce((sum, item) => sum + (item.isFastTrack ? 100000 : 0), 0)
  const designTotal = designService && cart.length ? 50000 : 0
  const grandTotal = subtotal + fastTrackTotal + designTotal
  const editorQty = Number(editor?.qty) || 0
  const editorUnitPrice = editor ? priceFor(editor) : 0
  const twoColorExtra = editor?.type === 'SABLON' ? priceFor({ ...editor, isTwoColor: true }) - priceFor({ ...editor, isTwoColor: false }) : 0
  const lidPrice = includeLid && lidProduct ? priceFor({ productId: lidProduct, qty: editorQty, type: lidType, isTwoColor: false, printingColors: null }) : 0
  const editorTotal = editorUnitPrice * editorQty + (editor?.isFastTrack ? 100000 : 0) + lidPrice * editorQty

  function openProduct(product) {
    const printingColors = activeType === 'PRINTING' ? '3 Warna' : null
    const minimum = getMinQty({ orderType: activeType, category: product.category, printingColors: '3 Warna', pricelistConfig })
    const initialQty = activeType === 'SABLON' ? Math.max(1000, minimum) : activeType === 'POLOS' ? (packageUnits.get(product.product_code)?.multiplier || minimum) : minimum
    setEditor({ productId: product.id, type: activeType, qty: initialQty, isTwoColor: false, printingColors, isFastTrack: false })
    setIncludeLid(false)
    setLidProduct('')
  }

  function openEdit(item) {
    setEditor({ ...item })
    setIncludeLid(false)
    setLidProduct('')
  }

  function saveItem() {
    if (!editor || !validQty || (includeLid && !lidProduct)) return
    const item = { ...editor, qty: Number(editor.qty) }
    if (editing) {
      setCart(previous => previous.map(entry => entry.id === item.id ? item : entry))
    } else {
      const newItems = [{ ...item, id: String(++nextItemId.current) }]
      if (includeLid && lidProduct) {
        newItems.push({ id: String(++nextItemId.current), productId: lidProduct, type: lidType, qty: item.qty, isTwoColor: false, printingColors: null, isFastTrack: false })
      }
      setCart(previous => [...previous, ...newItems])
      setNotice('Ditambahkan ke keranjang')
    }
    setEditor(null)
  }

  async function handleCheckout(event) {
    event.preventDefault()
    if (!cart.length || submittingRef.current) return
    submittingRef.current = true
    setSubmitting(true)
    setCheckoutError('')
    const items = cart.map(item => {
      const product = products.find(entry => entry.id === item.productId)
      return { productId: product.product_code, productName: product.name, orderType: item.type, qty: item.qty, unitPrice: priceFor(item), isTwoColor: item.isTwoColor, printingColors: item.printingColors, isFastTrack: item.isFastTrack }
    })
    let navigating = false
    try {
      const response = await fetch('/api/public-order', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brandName, whatsappNumber: waNumber, items, designService, subtotal, grandTotal }),
      })
      const data = await response.json()
      if (data.success) {
        window.location.assign(`/order/received?request=${encodeURIComponent(data.data?.request_number || '-')}`)
        navigating = true
        return
      }
      setCheckoutError(`Permintaan belum berhasil dikirim. ${typeof data.error === 'string' ? data.error : 'Silakan coba lagi.'}`)
    } catch {
      setCheckoutError('Hasil pengiriman belum dapat dipastikan. Periksa ke admin sebelum mengirim ulang agar pesanan tidak tercatat dua kali.')
    } finally {
      if (!navigating) {
        submittingRef.current = false
        setSubmitting(false)
      }
    }
  }

  return (
    <>
      {category ? (
        <section aria-labelledby="products-title">
          <button type="button" onClick={() => { setCategory(''); setCategoryMembers([]); setSelectedSize(''); setSelectedVariant('') }} className="mb-5 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-stone-600 hover:text-stone-900"><ArrowLeft className="h-4 w-4" /> Semua kategori</button>
          <div className="mb-4 flex items-end justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-[#755615]">{activeType}</p><h1 id="products-title" className="mt-1 text-2xl font-bold tracking-tight text-stone-900 sm:text-3xl">{category}</h1>{categoryDescription && <p className="mt-1 max-w-md text-sm leading-5 text-stone-500">{categoryDescription}</p>}</div><span className="shrink-0 text-sm text-stone-500">{visibleProducts.length} produk</span></div>
          {sizeOptions.length > 1 && <div className="mb-4" aria-label="Filter ukuran"><p className="mb-2 text-xs font-semibold text-stone-500">Ukuran</p><div className="grid grid-cols-3 gap-2 sm:flex sm:flex-wrap">
            <button type="button" aria-pressed={!selectedSize} onClick={() => setSelectedSize('')} className={`min-h-11 w-full rounded-full border px-3 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#755615] sm:w-auto sm:px-4 ${!selectedSize ? 'border-[#755615] bg-[#755615] text-white' : 'border-stone-200 bg-white text-stone-600 hover:border-stone-400'}`}>Semua</button>
            {sizeOptions.map(size => <button key={size} type="button" aria-pressed={selectedSize === size} onClick={() => setSelectedSize(size)} className={`min-h-11 w-full rounded-full border px-3 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#755615] sm:w-auto sm:px-4 ${selectedSize === size ? 'border-[#755615] bg-[#755615] text-white' : 'border-stone-200 bg-white text-stone-600 hover:border-stone-400'}`}>{size}</button>)}
          </div></div>}
          {categoryVariantOptions.length > 1 && <div className="mb-4" aria-label={variantFilterTitle}><p className="mb-2 text-xs font-semibold text-stone-500">{variantFilterTitle}</p><div className="flex flex-wrap gap-2">
            <button type="button" aria-pressed={!selectedVariant} onClick={() => setSelectedVariant('')} className={`min-h-11 rounded-full border px-4 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#755615] ${!selectedVariant ? 'border-[#755615] bg-[#755615] text-white' : 'border-stone-200 bg-white text-stone-600 hover:border-stone-400'}`}>Semua</button>
            {categoryVariantOptions.map(option => <button key={option.value} type="button" aria-pressed={selectedVariant === option.value} onClick={() => setSelectedVariant(option.value)} className={`min-h-11 rounded-full border px-4 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#755615] ${selectedVariant === option.value ? 'border-[#755615] bg-[#755615] text-white' : 'border-stone-200 bg-white text-stone-600 hover:border-stone-400'}`}>{option.label}</button>)}
          </div></div>}
          <div className="max-w-3xl divide-y divide-stone-100 overflow-hidden rounded-xl border border-stone-200 bg-white">
            {visibleProducts.map(product => {
              const minimum = getMinQty({ orderType: activeType, category: product.category, printingColors: '3 Warna', pricelistConfig })
              const pack = activeType === 'POLOS' ? packageUnits.get(product.product_code) : null
              const priceQty = activeType === 'SABLON' ? Math.max(1000, minimum) : pack?.multiplier || minimum
              const price = priceFor({ productId: product.id, qty: priceQty, type: activeType, isTwoColor: false, printingColors: activeType === 'PRINTING' ? '3 Warna' : null })
              const brand = getProductBrand(product)
              return <button key={product.id} type="button" onClick={() => openProduct(product)} className="flex min-h-20 w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-stone-50 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#755615]"><span className="min-w-0"><span className="flex flex-wrap items-center gap-2 text-sm font-semibold text-stone-900">{brand && <span className="rounded-md bg-stone-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-stone-600">{brand}</span>}<span>{product.name}</span></span><span className="mt-1 block text-xs text-stone-500">{pack ? `1 ${pack.name} · ${priceQty.toLocaleString('id-ID')} pcs` : `Untuk ${priceQty.toLocaleString('id-ID')} pcs`}{activeType === 'PRINTING' ? ' · 3 warna' : ''}</span></span><span className="flex shrink-0 items-center gap-2"><span className="text-right text-sm font-bold text-[#755615]">{formatRp(pack ? price * priceQty : price)} <span className="text-xs font-normal text-stone-500">/ {pack?.name || 'pcs'}</span></span><ChevronRight aria-hidden="true" className="h-4 w-4 text-stone-400" /></span></button>
            })}
          </div>
        </section>
      ) : (
        <section aria-labelledby="categories-title">
          <div className="mb-7 sm:mb-9">
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-stone-500">Jenis pesanan</p>
            <div className="flex gap-2 overflow-x-auto pb-1" aria-label="Jenis pesanan">
              {orderTypes.map(type => <button key={type} type="button" aria-pressed={activeType === type} onClick={() => { setActiveType(type); setCategory(''); setCategoryMembers([]); setSelectedSize(''); setSelectedVariant(''); setNotice('') }} className={`min-h-11 shrink-0 rounded-full border px-5 text-sm font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#755615] ${activeType === type ? 'border-[#755615] bg-[#755615] text-white' : 'border-stone-200 bg-white text-stone-600 hover:border-stone-400'}`}>{type}</button>)}
            </div>
          </div>
          <div className="mb-5 flex items-end justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-[#755615]">Katalog {activeType}</p><h1 id="categories-title" className="mt-1 text-2xl font-bold tracking-tight text-stone-900 sm:text-3xl">Pilih kategori</h1></div></div>
          {categories.length === 0 ? <div className="rounded-2xl border border-stone-200 bg-white p-10 text-center text-sm text-stone-500">Belum ada kategori untuk jenis ini.</div> : <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-5 lg:grid-cols-4">
            {categories.map(displayCategory => {
              const { name, categories: sourceCategories } = displayCategory
              const imageUrl = categoryImagesConfig[name] || sourceCategories.map(source => categoryImagesConfig[source]).find(Boolean)
              return <button key={name} type="button" onClick={() => { setCategory(name); setCategoryMembers(sourceCategories); setSelectedSize(''); setSelectedVariant(''); setNotice('') }} className="overflow-hidden rounded-xl border border-stone-200 bg-white text-left hover:border-[#b79a55] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#755615]">
                <span className="relative flex aspect-[4/3] items-center justify-center overflow-hidden bg-[#f3f0e9]">
                  <CategoryImage src={imageUrl} />
                </span>
                <span className="flex min-h-12 items-center px-3 py-2 text-sm font-semibold leading-snug text-stone-900">{name}</span>
              </button>
            })}
          </div>}
        </section>
      )}

      <div className="sr-only" role="status" aria-live="polite">{notice}</div>
      {notice && !cartOpen && !editor && <div className="fixed bottom-24 left-1/2 z-30 -translate-x-1/2 whitespace-nowrap rounded-full bg-stone-900 px-4 py-2 text-sm font-medium text-white"><Check className="mr-2 inline h-4 w-4" />{notice}<button type="button" onClick={() => setNotice('')} aria-label="Tutup pemberitahuan" className="ml-3">×</button></div>}
      {cart.length > 0 && !cartOpen && !editor && <div className="fixed inset-x-0 bottom-0 z-30 border-t border-stone-200 bg-white p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-4px_20px_rgba(0,0,0,0.06)]"><div className="mx-auto flex max-w-5xl items-center justify-between gap-4"><div><p className="text-xs text-stone-500">{cart.length} item</p><p className="font-bold text-stone-900">{formatRp(grandTotal)}</p></div><button type="button" onClick={() => { setNotice(''); setCartOpen(true) }} className={primaryButton}><ShoppingCart className="h-4 w-4" /> Keranjang</button></div></div>}

      {editor && selectedProduct && <OrderDialog titleId="editor-title" onClose={() => setEditor(null)}>
        <div className="flex max-h-[90dvh] flex-col">
          <div className="flex items-start justify-between gap-3 border-b border-stone-100 p-4 sm:p-5"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-[#755615]">{editor.type}</p><h2 id="editor-title" className="mt-1 text-xl font-bold">{selectedProduct.name}</h2></div><CloseButton onClick={() => setEditor(null)} /></div>
          <div className="space-y-5 overflow-y-auto p-4 sm:p-5">
            {editor.type === 'PRINTING' && <div><label id="printing-colors-label" htmlFor="printing-colors" className="mb-2 block text-sm font-semibold">Warna printing</label><LightSelect id="printing-colors" ariaLabel="Warna printing" labelledBy="printing-colors-label" value={editor.printingColors} onChange={printingColors => setEditor({ ...editor, printingColors })} options={[{ value: '3 Warna', label: '3 Warna' }, { value: '4 Warna', label: '4 Warna' }]} placeholder="Pilih warna" /></div>}
            <div><label htmlFor="order-qty" className="mb-2 block text-sm font-semibold">Jumlah (pcs)</label><input id="order-qty" type="number" inputMode="numeric" min={minQty} step="1" value={editor.qty} onChange={event => setEditor({ ...editor, qty: event.target.value })} aria-invalid={!validQty} aria-describedby="qty-help" className={inputStyle} /><p id="qty-help" className={`mt-2 text-xs ${validQty ? 'text-stone-500' : 'font-semibold text-red-700'}`}>{selectedPackage && `1 ${selectedPackage.name} = ${selectedPackage.multiplier} pcs · `}Minimal {minQty} pcs</p></div>
            {editor.type === 'SABLON' && <div className="space-y-2"><p className="text-sm font-semibold">Opsi tambahan</p><label className="flex min-h-12 items-center gap-3 rounded-xl border border-stone-200 p-3 text-sm"><input type="checkbox" checked={editor.isTwoColor} onChange={event => setEditor({ ...editor, isTwoColor: event.target.checked })} className="h-4 w-4 accent-[#755615]" /><span>Sablon 2 warna</span><span className="ml-auto text-stone-500">+{formatRp(twoColorExtra)} / pcs</span></label><label className="flex min-h-12 items-center gap-3 rounded-xl border border-stone-200 p-3 text-sm"><input type="checkbox" checked={editor.isFastTrack} onChange={event => setEditor({ ...editor, isFastTrack: event.target.checked })} className="h-4 w-4 accent-[#755615]" /><span>Fast Track</span><span className="ml-auto text-stone-500">+Rp100.000 / item</span></label></div>}
            {!editing && editor.type !== 'POLOS' && lids.length > 0 && <div className="space-y-2"><label className="flex min-h-12 items-center gap-3 rounded-xl border border-stone-200 p-3 text-sm"><input type="checkbox" checked={includeLid} onChange={event => setIncludeLid(event.target.checked)} className="h-4 w-4 accent-[#755615]" /><span>Tambah tutup</span><span className="ml-auto text-xs text-stone-500">Jumlah sama</span></label>{includeLid && <LightSelect id="lid-product" ariaLabel="Pilih jenis tutup" value={lidProduct} onChange={setLidProduct} placeholder="Pilih jenis tutup" options={[{ value: '', label: 'Pilih jenis tutup' }, ...lids.map(lid => ({ value: lid.id, label: lid.name }))]} />}</div>}
            <div className="flex items-end justify-between gap-4 rounded-xl bg-[#f8f4ea] p-4"><div><p className="text-xs text-stone-500">Produk utama</p><p className="mt-1 text-sm font-bold">{formatRp(editorUnitPrice)} / pcs</p></div><div className="text-right"><p className="text-xs text-stone-500">Total</p><p className="mt-1 text-lg font-bold text-[#755615]">{formatRp(editorTotal)}</p></div></div>
          </div>
          <div className="border-t border-stone-100 p-4"><button type="button" onClick={saveItem} disabled={!validQty || (includeLid && !lidProduct)} className={`${primaryButton} w-full`}>{editing ? 'Simpan perubahan' : 'Tambah ke keranjang'}</button></div>
        </div>
      </OrderDialog>}

      {cartOpen && <OrderDialog titleId="cart-title" onClose={() => setCartOpen(false)} drawer>
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between border-b border-stone-100 p-4 sm:p-5"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-[#755615]">Pesanan kamu</p><h2 id="cart-title" className="mt-1 text-xl font-bold">Keranjang <span className="text-stone-400">({cart.length})</span></h2></div><CloseButton onClick={() => setCartOpen(false)} /></div>
          <div className="flex-1 space-y-3 overflow-y-auto p-4 sm:p-5">
            {cart.length === 0 ? <div className="py-16 text-center text-stone-500"><ShoppingBag className="mx-auto mb-3 h-8 w-8 text-stone-300" />Keranjang masih kosong.</div> : cart.map(item => {
              const product = products.find(entry => entry.id === item.productId)
              return <div key={item.id} className="rounded-2xl border border-stone-200 p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-bold">{product?.name}</p><p className="mt-1 text-xs text-stone-500">{[getProductBrand(product), item.type, item.printingColors, item.isTwoColor ? '2 warna' : '', item.isFastTrack ? 'Fast Track' : ''].filter(Boolean).join(' · ')}</p></div><button type="button" onClick={() => setCart(previous => previous.filter(entry => entry.id !== item.id))} aria-label={`Hapus ${product?.name}`} className="rounded-lg p-2 text-stone-500 hover:bg-stone-100 hover:text-red-700"><Trash2 className="h-4 w-4" /></button></div><div className="mt-4 flex items-end justify-between gap-3"><div><p className="text-sm font-semibold">{item.qty} pcs</p><p className="mt-1 text-xs text-stone-500">{formatRp(priceFor(item))} / pcs</p></div><div className="text-right"><p className="font-bold">{formatRp(priceFor(item) * item.qty)}</p><button type="button" onClick={() => openEdit(item)} className="mt-1 min-h-9 text-sm font-semibold text-[#755615] underline underline-offset-2">Ubah</button></div></div></div>
            })}
            {cart.length > 0 && <label className="flex min-h-14 items-center gap-3 rounded-2xl border border-stone-200 p-4 text-sm"><input type="checkbox" checked={designService} onChange={event => setDesignService(event.target.checked)} className="h-4 w-4 accent-[#755615]" /><span>Jasa desain logo</span><span className="ml-auto font-semibold">+Rp50.000</span></label>}
          </div>
          {cart.length > 0 && <div className="space-y-2 border-t border-stone-200 bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom))] text-sm sm:p-5"><div className="flex justify-between text-stone-600"><span>Produk</span><span>{formatRp(subtotal)}</span></div>{fastTrackTotal > 0 && <div className="flex justify-between text-stone-600"><span>Fast Track</span><span>{formatRp(fastTrackTotal)}</span></div>}{designTotal > 0 && <div className="flex justify-between text-stone-600"><span>Jasa desain</span><span>{formatRp(designTotal)}</span></div>}<div className="flex justify-between border-t border-stone-100 pt-3 font-bold"><span>Total</span><span className="text-lg text-[#755615]">{formatRp(grandTotal)}</span></div><button type="button" onClick={() => { setCheckoutError(''); setCheckoutOpen(true) }} className={`${primaryButton} mt-2 w-full`}>Lanjutkan <ChevronRight className="h-4 w-4" /></button></div>}
        </div>
      </OrderDialog>}

      {checkoutOpen && <OrderDialog titleId="checkout-title" onClose={() => setCheckoutOpen(false)} locked={submitting}>
        <div className="max-h-[90dvh] overflow-y-auto p-5 sm:p-7"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-[#755615]">Langkah terakhir</p><h2 id="checkout-title" className="mt-1 text-xl font-bold">Data pemesan</h2></div>{!submitting && <CloseButton onClick={() => setCheckoutOpen(false)} />}</div><p className="mt-2 text-sm text-stone-500">Admin akan memeriksa permintaan pesanan kamu.</p>
          <form onSubmit={handleCheckout} className="mt-6 space-y-4"><div><label htmlFor="brand-name" className="mb-2 block text-sm font-semibold">Nama brand / usaha</label><input id="brand-name" type="text" required autoComplete="organization" placeholder="Contoh: Kopi Nangkring" value={brandName} onChange={event => setBrandName(event.target.value)} className={inputStyle} /></div><div><label htmlFor="whatsapp" className="mb-2 block text-sm font-semibold">Nomor WhatsApp</label><input id="whatsapp" type="tel" required autoComplete="tel" placeholder="08xxxxxxxxxx" value={waNumber} onChange={event => setWaNumber(event.target.value)} className={inputStyle} /></div><div className="flex justify-between rounded-xl bg-[#f8f4ea] p-4 text-sm font-bold"><span>Total</span><span>{formatRp(grandTotal)}</span></div>{checkoutError && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{checkoutError}</p>}<button type="submit" disabled={submitting} className={`${primaryButton} w-full`}>{submitting ? 'Mengirim...' : 'Kirim Permintaan Pesanan'}</button></form>
        </div>
      </OrderDialog>}
    </>
  )
}
