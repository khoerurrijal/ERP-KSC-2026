'use client'

import { useState } from 'react'

export default function PriceListClient({ products, jasaSablon }) {
  const [searchQuery, setSearchQuery] = useState('')
  const [activeCategory, setActiveCategory] = useState('ALL')

  // Kategori unik
  const categories = ['ALL', ...new Set(products.map(p => p.category).filter(Boolean))]

  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || p.product_code.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesCategory = activeCategory === 'ALL' || p.category === activeCategory
    // Tampilkan hanya yang punya harga polos atau sablon masuk akal
    const hasPrice = p.price_polos > 0
    return matchesSearch && matchesCategory && hasPrice
  })

  // Format ke Rupiah
  const formatRp = (num) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(num)
  }

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between p-4 bg-background/50 border border-border backdrop-blur-xl rounded-2xl shadow-sm">
        <input
          type="text"
          placeholder="Cari produk (contoh: Cup 16 Oz)"
          className="w-full md:w-96 px-4 py-2 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        
        <div className="flex gap-2 overflow-x-auto w-full md:w-auto pb-2 md:pb-0 scrollbar-hide">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-4 py-2 whitespace-nowrap rounded-xl text-sm font-medium transition-all ${
                activeCategory === cat 
                  ? 'bg-primary text-primary-foreground shadow-[0_0_15px_rgba(var(--primary),0.3)]' 
                  : 'bg-background hover:bg-muted border border-border text-foreground/80'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Grid view instead of boring table */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredProducts.map((product) => {
          const hargaPolos1000 = product.price_polos * 1000
          const hargaSablon1000 = (product.price_polos + jasaSablon) * 1000

          return (
            <div key={product.product_code} className="group p-6 bg-background/50 border border-border backdrop-blur-sm rounded-2xl shadow-sm hover:shadow-[0_8px_30px_rgba(0,0,0,0.4)] transition-all hover:-translate-y-1 overflow-hidden relative">
              {/* Decoration line */}
              <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-primary to-accent opacity-0 group-hover:opacity-100 transition-opacity" />
              
              <div className="text-xs text-foreground/50 mb-1 font-mono">{product.product_code}</div>
              <h3 className="text-lg font-bold text-foreground mb-4 leading-tight">{product.name}</h3>
              
              <div className="space-y-3">
                <div className="flex justify-between items-center p-3 bg-card border border-border rounded-xl">
                  <span className="text-sm text-foreground/70">Harga Polos<br/><span className="text-[10px] text-foreground/40">/ 1.000 Pcs</span></span>
                  <span className="font-bold text-lg text-foreground">{formatRp(hargaPolos1000)}</span>
                </div>
                
                <div className="flex justify-between items-center p-3 bg-primary/5 border border-primary/20 rounded-xl relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-r from-primary/10 to-accent/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                  <span className="text-sm font-medium text-primary relative z-10">Harga Sablon<br/><span className="text-[10px] text-primary/60">/ 1.000 Pcs</span></span>
                  <span className="font-black text-xl text-primary relative z-10 drop-shadow-md">{formatRp(hargaSablon1000)}</span>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {filteredProducts.length === 0 && (
        <div className="text-center py-20 text-foreground/50 border border-dashed border-border rounded-3xl">
          Tidak ada produk yang ditemukan.
        </div>
      )}
    </div>
  )
}
