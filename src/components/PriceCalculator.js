'use client'

import { useState } from 'react'
import { Calculator } from 'lucide-react'
import CustomSelect from '@/components/CustomSelect'
import { calculateItemPrice, getMinQty } from '@/utils/pricing'

export default function PriceCalculator({ products = [], dropdownConfig = {}, pricelistConfig = {} }) {
  const [orderType, setOrderType] = useState('')
  const [category, setCategory] = useState('')
  const [productId, setProductId] = useState('')
  const [unit, setUnit] = useState('PCS')
  const [qty, setQty] = useState(1000)
  const [printingColors, setPrintingColors] = useState('3 Warna')
  const [addons, setAddons] = useState([]) // [{ id: Date.now(), productId: '', qty: 1 }]

  const getCategoriesForItem = (oType) => {
    if (!oType) return []
    const mapping = dropdownConfig.category_mapping || {}
    if (mapping[oType] && mapping[oType].length > 0) {
      return mapping[oType]
    }
    // Fallback: semua kategori
    return [...new Set(products.map(p => p.category).filter(Boolean))]
  }

  const filteredCategories = getCategoriesForItem(orderType)
  const filteredProducts = products.filter(p => p.category === category)
  const selectedProduct = products.find(p => p.id?.toString() === productId?.toString())

  // Calculate Main Item Price
  const isSablon = orderType?.toUpperCase() === 'SABLON'
  const isPrinting = orderType?.toUpperCase() === 'PRINTING'
  
  const minQty = getMinQty({ orderType, category, printingColors, pricelistConfig })
  
  let basePricePerPcs = 0;
  if (selectedProduct) {
    basePricePerPcs = calculateItemPrice({
      product: selectedProduct,
      qty: qty,
      orderType: orderType,
      isTwoColor: false,
      printingColors: printingColors,
      pricelistConfig
    });
  }

  // Get Unit Multiplier
  let unitMultiplier = 1
  if (unit !== 'PCS' && selectedProduct && selectedProduct.product_units) {
    const pu = selectedProduct.product_units.find(u => u.unit_name === unit)
    if (pu) unitMultiplier = pu.multiplier
  }

  // Calculate Addons Total
  let addonsTotal = 0
  addons.forEach(addon => {
    if (addon.productId) {
      const p = products.find(prod => prod.id?.toString() === addon.productId?.toString())
      if (p) {
        const addonPrice = calculateItemPrice({
          product: p,
          qty: addon.qty || 1,
          orderType: 'POLOS',
          isTwoColor: false,
          pricelistConfig
        });
        addonsTotal += addonPrice * (addon.qty || 0)
      }
    }
  })

  const finalPricePerPcs = basePricePerPcs * unitMultiplier;
  const totalPrice = (finalPricePerPcs * qty) + addonsTotal

  const handleAddAddon = () => {
    setAddons([...addons, { id: Date.now(), productId: '', qty: 1 }])
  }
  const handleRemoveAddon = (id) => {
    setAddons(addons.filter(a => a.id !== id))
  }
  const handleAddonChange = (id, field, val) => {
    setAddons(addons.map(a => a.id === id ? { ...a, [field]: val } : a))
  }

  return (
    <div className="glass-card flex flex-col h-full border-t-4 border-primary">
      <div className="p-4 border-b border-white/10 bg-white/5 flex items-center gap-2">
        <Calculator className="w-5 h-5 text-primary" />
        <h2 className="font-bold text-foreground">Kalkulator Harga Cepat</h2>
      </div>
      
      <div className="p-4 flex flex-col gap-4 flex-1">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1 col-span-2">
            <label className="text-xs font-medium text-foreground/60">Jenis Pesanan</label>
            <CustomSelect 
              value={orderType} 
              onChange={e => { setOrderType(e.target.value); setCategory(''); setProductId(''); }} 
              options={[
                { value: "", label: "- Pilih -" },
                ...Array.from(new Set([...(dropdownConfig.order_type || ["SABLON", "POLOS"])])).map(v => ({ value: v, label: v }))
              ]} 
            />
          </div>

          <div className="space-y-1 col-span-2 md:col-span-1">
            <label className="text-xs font-medium text-foreground/60">Kategori</label>
            <CustomSelect 
              value={category} 
              onChange={(e) => { setCategory(e.target.value); setProductId(''); }} 
              options={[
                { value: "", label: "- Pilih -" },
                ...filteredCategories.map(c => ({ value: c, label: c }))
              ]} 
              disabled={!orderType}
            />
          </div>

          <div className="space-y-1 col-span-2 md:col-span-1">
            <label className="text-xs font-medium text-foreground/60">Produk</label>
            <CustomSelect 
              value={productId} 
              onChange={(e) => { setProductId(e.target.value); setUnit('PCS'); }} 
              options={[
                { value: "", label: "- Pilih -" },
                ...filteredProducts.map(p => ({ value: p.id, label: p.name }))
              ]} 
            />
          </div>

          <div className="space-y-1 col-span-2 md:col-span-1">
            <label className="text-xs font-medium text-foreground/60">Satuan</label>
            <CustomSelect 
              value={unit} 
              onChange={(e) => setUnit(e.target.value)} 
              options={(() => {
                const base = [{ value: 'PCS', label: 'PCS' }]
                if (!isSablon && !isPrinting && selectedProduct && selectedProduct.product_units && selectedProduct.product_units.length > 0) {
                  return [...base, ...selectedProduct.product_units.map(u => ({ value: u.unit_name, label: u.unit_name }))]
                }
                return base
              })()}
              disabled={isSablon || isPrinting || !productId}
            />
          </div>

          <div className="space-y-1 col-span-2 md:col-span-1">
            <label className="text-xs font-medium text-foreground/60">Kuantitas (Qty)</label>
            <input 
              type="number" 
              value={qty === 0 ? '' : qty} 
              onBlur={() => {
                if (qty < minQty) setQty(minQty)
              }}
              onChange={(e) => setQty(e.target.value === '' ? 0 : Number(e.target.value))}
              className="glass-input w-full text-sm"
              min={minQty}
            />
          </div>

          {isPrinting && (
            <div className="space-y-1 col-span-2">
              <label className="text-xs font-medium text-foreground/60">Varian Warna Printing</label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer text-sm bg-black/20 px-4 py-2 rounded-lg border border-white/10 hover:bg-white/5 transition-colors">
                  <input 
                    type="radio" 
                    name="printingColors" 
                    className="text-blue-500"
                    checked={printingColors === '3 Warna'} 
                    onChange={() => setPrintingColors('3 Warna')} 
                  />
                  <span className="text-blue-400 font-bold">3 Warna</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-sm bg-black/20 px-4 py-2 rounded-lg border border-white/10 hover:bg-white/5 transition-colors">
                  <input 
                    type="radio" 
                    name="printingColors" 
                    className="text-purple-500"
                    checked={printingColors === '4 Warna'} 
                    onChange={() => setPrintingColors('4 Warna')} 
                  />
                  <span className="text-purple-400 font-bold">4 Warna</span>
                </label>
              </div>
            </div>
          )}
        </div>

        {addons.length > 0 && (
          <div className="mt-4 pt-4 border-t border-white/10 space-y-3">
            <h3 className="text-xs font-bold text-foreground/80">Item Tambahan (Add-on)</h3>
            {addons.map((addon, idx) => (
              <div key={addon.id} className="flex items-center gap-2">
                <div className="flex-1">
                  <CustomSelect 
                    value={addon.productId} 
                    onChange={(e) => handleAddonChange(addon.id, 'productId', e.target.value)} 
                    searchable={true}
                    options={[
                      { value: "", label: "- Pilih Add-on -" },
                      ...products.map(p => ({ value: p.id, label: p.name }))
                    ]} 
                  />
                </div>
                <div className="w-20">
                  <input 
                    type="number" 
                    value={addon.qty === 0 ? '' : addon.qty} 
                    onChange={(e) => handleAddonChange(addon.id, 'qty', e.target.value === '' ? 0 : Number(e.target.value))}
                    className="glass-input w-full text-sm px-2"
                    placeholder="Qty"
                  />
                </div>
                <button onClick={() => handleRemoveAddon(addon.id)} className="p-2 text-red-400 hover:bg-red-400/10 rounded-lg">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg>
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="mt-4">
           <button onClick={handleAddAddon} className="text-xs text-primary font-semibold hover:underline flex items-center gap-1 border border-primary/30 border-dashed rounded-lg px-3 py-1.5 hover:bg-primary/10">
             + Tambah Add-on
           </button>
        </div>

        <div className="mt-auto pt-4 border-t border-white/10 space-y-2">
          <div className="flex justify-between text-xs text-foreground/60">
            <span>Harga Satuan (Rp)</span>
            <span>Rp {finalPricePerPcs.toLocaleString('id-ID')}</span>
          </div>
        </div>
      </div>
      
      <div className="p-4 bg-primary/10 border-t border-primary/20 flex justify-between items-center rounded-b-xl">
        <span className="text-xs text-primary font-bold uppercase tracking-wider">Total Est</span>
        <span className="text-xl font-black text-primary">Rp {totalPrice.toLocaleString('id-ID')}</span>
      </div>
    </div>
  )
}
