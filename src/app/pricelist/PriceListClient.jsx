'use client'

import { useState } from 'react'

export default function PriceListClient({ products, matrix }) {
  const [activeCategory, setActiveCategory] = useState('ALL')

  // Normalisasi Kategori yang mirip dengan di PDF
  const categoryOrder = [
    'INJECTION', 'PET', 'STARINDO', 'GOCUP', 'HOK', 'PAPERCUP', 'PAPERBOWL', 'LID SEALER', 'TUTUP CUP', 'SEDOTAN'
  ]

  const groupedProducts = {}
  products.forEach(p => {
    if (!p.price_polos || p.price_polos <= 0) return // Skip invalid
    const cat = p.category || 'LAINNYA'
    if (!groupedProducts[cat]) groupedProducts[cat] = []
    groupedProducts[cat].push(p)
  })

  const sortedCategories = Object.keys(groupedProducts).sort((a, b) => {
    const idxA = categoryOrder.findIndex(c => a.toUpperCase().includes(c))
    const idxB = categoryOrder.findIndex(c => b.toUpperCase().includes(c))
    return (idxA !== -1 ? idxA : 99) - (idxB !== -1 ? idxB : 99)
  })

  // Jika activeCategory !== ALL, filter categories
  const displayCategories = activeCategory === 'ALL' 
    ? sortedCategories 
    : sortedCategories.filter(c => c === activeCategory)

  // Format ke Rupiah
  const formatRp = (num) => {
    if (!num) return '-'
    return new Intl.NumberFormat('id-ID', { minimumFractionDigits: 0 }).format(num)
  }

  // Get image for category (placeholder logic for user to upload later)
  const getCategoryImage = (catName) => {
    const name = catName.toUpperCase()
    if (name.includes('INJECTION')) return '/images/cups/injection.png'
    if (name.includes('PET')) return '/images/cups/pet.png'
    if (name.includes('STARINDO')) return '/images/cups/starindo.png'
    if (name.includes('GOCUP')) return '/images/cups/gocup.png'
    if (name.includes('PAPERBOWL')) return '/images/cups/paperbowl.png'
    if (name.includes('PAPERCUP')) return '/images/cups/papercup.png'
    if (name.includes('LID')) return '/images/cups/lid.png'
    if (name.includes('SEDOTAN')) return '/images/cups/sedotan.png'
    return '/images/cups/default.png'
  }

  return (
    <div className="space-y-12">
      {/* Category Tabs (Sticky) */}
      <div className="sticky top-0 z-50 pt-4 pb-4 bg-background/90 backdrop-blur-xl border-b border-border shadow-sm -mx-4 px-4 md:mx-0 md:px-0">
        <div className="flex gap-2 overflow-x-auto scrollbar-hide py-1">
          <button
            onClick={() => setActiveCategory('ALL')}
            className={`px-5 py-2.5 whitespace-nowrap rounded-full text-sm font-bold transition-all ${
              activeCategory === 'ALL' 
                ? 'bg-primary text-primary-foreground shadow-[0_0_20px_rgba(var(--primary),0.4)]' 
                : 'bg-card hover:bg-muted border border-border text-foreground/80'
            }`}
          >
            Semua Kategori
          </button>
          {sortedCategories.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-5 py-2.5 whitespace-nowrap rounded-full text-sm font-bold transition-all ${
                activeCategory === cat 
                  ? 'bg-primary text-primary-foreground shadow-[0_0_20px_rgba(var(--primary),0.4)]' 
                  : 'bg-card hover:bg-muted border border-border text-foreground/80'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Categories Rendering */}
      {displayCategories.map(cat => {
        const catProducts = groupedProducts[cat]
        const catMatrix = matrix[cat] || {}
        const imgUrl = getCategoryImage(cat)

        return (
          <div key={cat} className="scroll-mt-32 relative animate-in fade-in slide-in-from-bottom-8 duration-700">
            <div className="flex flex-col lg:flex-row gap-8 bg-card backdrop-blur-xl border border-card-border rounded-3xl p-6 md:p-8 shadow-sm hover:shadow-md transition-shadow overflow-hidden">
              
              {/* Left Side: Visual / Title */}
              <div className="lg:w-1/3 flex flex-col justify-center items-center lg:items-start text-center lg:text-left relative z-10">
                <div className="w-full max-w-[280px] aspect-square relative mb-6">
                  {/* Decorative Glow */}
                  <div className="absolute inset-0 bg-primary/20 blur-[50px] rounded-full" />
                  {/* The Image (User will upload PNGs here) */}
                  <img 
                    src={imgUrl} 
                    alt={cat} 
                    className="w-full h-full object-contain relative z-10 drop-shadow-2xl"
                    onError={(e) => {
                      e.target.onerror = null; 
                      e.target.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 400' fill='none'%3E%3Crect width='400' height='400' fill='%238D6E63' fill-opacity='0.1'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' font-family='sans-serif' font-size='24' fill='%233E2723' opacity='0.5'%3E[Upload PNG: %0A" + imgUrl.split('/').pop() + "]%3C/text%3E%3C/svg%3E";
                    }}
                  />
                </div>
                <h2 className="text-3xl font-black text-foreground mb-2">{cat}</h2>
                <p className="text-sm text-foreground/60">Harga tercantum sudah termasuk Sablon 1 Warna Reguler (Kecuali item polos).</p>
              </div>

              {/* Right Side: Table */}
              <div className="lg:w-2/3 w-full overflow-x-auto pb-4 relative z-10">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b-2 border-border/50">
                      <th className="py-4 px-4 font-bold text-foreground bg-foreground/5 rounded-tl-xl">Produk / Ukuran</th>
                      <th className="py-4 px-4 font-bold text-center text-primary bg-primary/5">500 Pcs</th>
                      <th className="py-4 px-4 font-bold text-center text-primary bg-primary/5">1.000 Pcs</th>
                      <th className="py-4 px-4 font-bold text-center text-primary bg-primary/5 rounded-tr-xl">5.000 Pcs</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/30">
                    {catProducts.map(product => {
                      // Calculate Prices (Per Pcs)
                      const p = product.price_polos
                      const p500 = p + (catMatrix.min_500 || 0)
                      const p1000 = p + (catMatrix.min_1000 || 0)
                      const p5000 = p + (catMatrix.min_5000 || 0)

                      return (
                        <tr key={product.product_code} className="hover:bg-foreground/5 transition-colors group">
                          <td className="py-4 px-4 font-semibold text-foreground/90">
                            {product.name}
                            <div className="text-[10px] text-foreground/40 font-mono mt-1 opacity-0 group-hover:opacity-100 transition-opacity">{product.product_code}</div>
                          </td>
                          <td className="py-4 px-4 text-center font-medium text-foreground/80">
                            {catMatrix.min_500 ? formatRp(p500) : '-'}
                          </td>
                          <td className="py-4 px-4 text-center font-bold text-primary text-lg">
                            {catMatrix.min_1000 ? formatRp(p1000) : formatRp(p)}
                          </td>
                          <td className="py-4 px-4 text-center font-medium text-foreground/80">
                            {catMatrix.min_5000 ? formatRp(p5000) : '-'}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              
            </div>
          </div>
        )
      })}
    </div>
  )
}
