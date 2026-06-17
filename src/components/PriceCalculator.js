'use client'

import { useState } from 'react'
import { Calculator } from 'lucide-react'
import CustomSelect from '@/components/CustomSelect'

export default function PriceCalculator({ products = [], dropdownConfig = {}, matrix = {} }) {
  const [orderType, setOrderType] = useState('')
  const [category, setCategory] = useState('')
  const [productId, setProductId] = useState('')
  const [qty, setQty] = useState(1)

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

  // Harga Dasar (price_polos) -> For Sablon, we add jasaSablon
  const basePrice = selectedProduct?.price_polos || 0
  
  // Custom logic for Sablon fee
  const isSablon = orderType === 'SABLON'
  
  let currentSablonFee = 0
  if (isSablon && category && matrix[category]) {
    const tierMatrix = matrix[category]
    if (qty >= 10000 && tierMatrix.min_10000 > 0) currentSablonFee = tierMatrix.min_10000
    else if (qty >= 5000 && tierMatrix.min_5000 > 0) currentSablonFee = tierMatrix.min_5000
    else if (qty >= 1000 && tierMatrix.min_1000 > 0) currentSablonFee = tierMatrix.min_1000
    else if (qty >= 500 && tierMatrix.min_500 > 0) currentSablonFee = tierMatrix.min_500
    else if (qty >= 100 && tierMatrix.min_100 > 0) currentSablonFee = tierMatrix.min_100
    else if (qty >= 10 && tierMatrix.min_10 > 0) currentSablonFee = tierMatrix.min_10
    else if (tierMatrix.min_1 > 0) currentSablonFee = tierMatrix.min_1
    else currentSablonFee = tierMatrix.min_1000 || 250 // fallback
  }

  const finalPricePerPcs = isSablon ? (basePrice + currentSablonFee) : basePrice
  const totalPrice = finalPricePerPcs * qty

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
                ...(dropdownConfig.order_type || ["SABLON", "POLOS"]).map(v => ({ value: v, label: v }))
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
              onChange={(e) => setProductId(e.target.value)} 
              options={[
                { value: "", label: "- Pilih -" },
                ...filteredProducts.map(p => ({ value: p.id, label: p.name }))
              ]} 
            />
          </div>

          <div className="space-y-1 col-span-2">
            <label className="text-xs font-medium text-foreground/60">Kuantitas (Qty)</label>
            <input 
              type="number" 
              value={qty} 
              onChange={(e) => setQty(Number(e.target.value))}
              className="glass-input w-full text-sm"
              min="1"
            />
          </div>
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
