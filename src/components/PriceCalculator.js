'use client'

import { useState } from 'react'
import { Calculator } from 'lucide-react'
import CustomSelect from '@/components/CustomSelect'

export default function PriceCalculator({ products = [] }) {
  const [orderType, setOrderType] = useState('Sablon')
  const [category, setCategory] = useState('')
  const [productId, setProductId] = useState('')
  const [qty, setQty] = useState(1)

  const categories = [...new Set(products.map(p => p.category).filter(Boolean))]
  const filteredProducts = products.filter(p => p.category === category)
  const selectedProduct = products.find(p => p.id?.toString() === productId?.toString())

  // Harga Dasar (HPP atau base_price) -> For Sablon, the fee is added on top.
  // Wait, in real logic, does the product have selling_price? Yes.
  // The user said it just calculates real-time. If it's like Sales Order, we take the selling price.
  const basePrice = selectedProduct?.selling_price || 0
  
  // Custom logic if Sablon adds fee? The user hasn't specified exact Sablon tier rules in DB yet, 
  // but let's assume `basePrice` already includes it or we just show basePrice * Qty for now 
  // since they said "mirip form sales order". 
  const finalPricePerPcs = basePrice
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
              onChange={e => setOrderType(e.target.value)} 
              options={[
                { value: "Sablon", label: "Sablon" },
                { value: "Polos", label: "Polos" }
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
                ...categories.map(c => ({ value: c, label: c }))
              ]} 
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
