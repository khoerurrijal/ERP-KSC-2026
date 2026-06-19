'use client'

import { useState } from 'react'
import { Coffee, Box } from 'lucide-react'

export default function PriceListClient({ products, matrix }) {
  const [mainTab, setMainTab] = useState('KING CUP')
  const [activeCategory, setActiveCategory] = useState('ALL')

  // Normalisasi Kategori yang mirip dengan di PDF
  const categoryOrder = [
    'INJECTION', 'PET', 'STARINDO', 'GOCUP', 'HOK', 'PAPERCUP', 'PAPERBOWL', 'ADDONS'
  ]

  const groupedProducts = {}

  products.forEach(p => {
    if (!p.price_polos || p.price_polos <= 0) return // Skip invalid

    let cat = p.category ? p.category.toUpperCase() : 'LAINNYA'
    let upperName = p.name.toUpperCase()
    let isTutup = upperName.includes('TUTUP')

    // Logika Penggabungan Tutup ke dalam Kotak Cup-nya secara universal (apapun kategorinya)
    if (isTutup || cat.includes('ADDON')) {
      if (upperName.includes('INJECT')) cat = 'INJECTION'
      else if (upperName.includes('PET')) cat = 'PET'
      else if (upperName.includes('GOCUP')) cat = 'GOCUP'
      else if (upperName.includes('PP') || upperName.includes('STARINDO')) cat = 'STARINDO'
      else if (upperName.includes('PAPERBOWL') || upperName.includes('PAPER BOWL')) cat = 'PAPERBOWL'
      else if (upperName.includes('PAPERCUP') || upperName.includes('PAPER CUP')) cat = 'PAPERCUP'
      else if (!isTutup) cat = 'ADDONS' 
    } 
    
    // Normalisasi nama kategori utama
    if (cat.includes('INJECT') && !cat.includes('INJECTION')) cat = 'INJECTION'
    else if (cat === 'CUP PET') cat = 'PET'
    else if (cat === 'CUP PP') cat = 'STARINDO'
    else if (cat === 'CUP GOCUP') cat = 'GOCUP'

    // Kategori TINTA
    if (cat.includes('TINTA') || upperName.includes('TINTA')) {
      cat = 'TINTA'
    }

    // Filter berdasarkan Main Tab
    // KING CUP: Cup & Addons
    // KING PLASTIK BOX: Box Dus, Plastik, Botol, Tinta
    const isBoxPlastik = cat.includes('BOX DUS') || cat.includes('PLASTIK') || cat.includes('BOTOL') || cat.includes('TINTA')
    
    if (mainTab === 'KING CUP' && isBoxPlastik) return
    if (mainTab === 'KING PLASTIK BOX' && !isBoxPlastik) return

    if (!groupedProducts[cat]) groupedProducts[cat] = []
    
    groupedProducts[cat].push({ ...p, isTutup })
  })

  // Sort categories
  const sortedCategories = Object.keys(groupedProducts).sort((a, b) => {
    const idxA = categoryOrder.findIndex(c => a.toUpperCase().includes(c))
    const idxB = categoryOrder.findIndex(c => b.toUpperCase().includes(c))
    return (idxA !== -1 ? idxA : 99) - (idxB !== -1 ? idxB : 99)
  })

  // Sort products within categories (Cups first, then Tutups)
  sortedCategories.forEach(cat => {
    groupedProducts[cat].sort((a, b) => {
      if (a.isTutup && !b.isTutup) return 1
      if (!a.isTutup && b.isTutup) return -1
      return a.name.localeCompare(b.name)
    })
  })

  // Filter if specific sub-category selected
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
    if (name.includes('ADDON')) return '/images/cups/sedotan.png'
    return '/images/cups/default.png'
  }

  return (
    <div className="space-y-8">
      
      {/* Top Level Main Tabs */}
      <div className="flex justify-center -mt-4 mb-4">
        <div className="flex bg-card/80 p-1.5 rounded-2xl border border-border backdrop-blur-xl shadow-lg">
          <button
            onClick={() => { setMainTab('KING CUP'); setActiveCategory('ALL') }}
            className={`px-8 py-3 rounded-xl font-black text-sm transition-all ${
              mainTab === 'KING CUP' 
                ? 'bg-primary text-primary-foreground shadow-[0_4px_15px_rgba(var(--primary),0.3)] scale-105' 
                : 'text-foreground/70 hover:bg-foreground/5'
            }`}
          >
            <div className="flex items-center gap-2 justify-center"><Coffee className="w-4 h-4"/> KING CUP</div>
          </button>
          <button
            onClick={() => { setMainTab('KING PLASTIK BOX'); setActiveCategory('ALL') }}
            className={`px-8 py-3 rounded-xl font-black text-sm transition-all ${
              mainTab === 'KING PLASTIK BOX' 
                ? 'bg-primary text-primary-foreground shadow-[0_4px_15px_rgba(var(--primary),0.3)] scale-105' 
                : 'text-foreground/70 hover:bg-foreground/5'
            }`}
          >
            <div className="flex items-center gap-2 justify-center"><Box className="w-4 h-4"/> KING PLASTIK BOX</div>
          </button>
        </div>
      </div>

      {/* Sub-Category Filters (Sticky) */}
      <div className="sticky top-0 z-50 pt-2 pb-4 bg-background/90 backdrop-blur-xl border-b border-border shadow-sm -mx-4 px-4 md:mx-0 md:px-0">
        <div className="flex gap-2 overflow-x-auto scrollbar-hide py-1">
          <button
            onClick={() => setActiveCategory('ALL')}
            className={`px-4 py-2 whitespace-nowrap rounded-full text-xs font-bold transition-all ${
              activeCategory === 'ALL' 
                ? 'bg-primary text-primary-foreground shadow-[0_0_15px_rgba(var(--primary),0.4)]' 
                : 'bg-card hover:bg-muted border border-border text-foreground/80'
            }`}
          >
            Semua {mainTab}
          </button>
          {sortedCategories.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-4 py-2 whitespace-nowrap rounded-full text-xs font-bold transition-all ${
                activeCategory === cat 
                  ? 'bg-primary text-primary-foreground shadow-[0_0_15px_rgba(var(--primary),0.4)]' 
                  : 'bg-card hover:bg-muted border border-border text-foreground/80'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Categories Rendering */}
      {displayCategories.length === 0 && (
        <div className="text-center py-20 text-foreground/50 border border-dashed border-border rounded-3xl">
          Belum ada produk di kategori ini.
        </div>
      )}

      {displayCategories.map(cat => {
        const catProducts = groupedProducts[cat]
        // Resolve original matrix category name
        let matrixKey = cat
        if (cat === 'INJECTION') matrixKey = 'CUP INJECT'
        else if (cat === 'PET') matrixKey = 'CUP PET'
        else if (cat === 'STARINDO') matrixKey = 'CUP PP'
        else if (cat === 'GOCUP') matrixKey = 'CUP GOCUP'
        
        const catMatrix = matrix[matrixKey] || matrix[cat] || {}
        const imgUrl = getCategoryImage(cat)

        return (
          <div key={cat} className="scroll-mt-32 relative animate-in fade-in slide-in-from-bottom-8 duration-700">
            <div className="flex flex-col lg:flex-row gap-6 bg-card backdrop-blur-xl border border-card-border rounded-3xl p-5 md:p-6 shadow-sm hover:shadow-md transition-shadow overflow-hidden">
              
              {/* Left Side: Visual / Title */}
              <div className="lg:w-1/4 flex flex-col justify-center items-center lg:items-start text-center lg:text-left relative z-10 shrink-0">
                <div className="w-full max-w-[200px] aspect-square relative mb-4">
                  <div className="absolute inset-0 bg-primary/20 blur-[40px] rounded-full" />
                  <img 
                    src={imgUrl} 
                    alt={cat} 
                    className="w-full h-full object-contain relative z-10 drop-shadow-xl"
                    onError={(e) => {
                      e.target.onerror = null; 
                      e.target.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 400' fill='none'%3E%3Crect width='400' height='400' fill='%238D6E63' fill-opacity='0.1'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' font-family='sans-serif' font-size='20' fill='%233E2723' opacity='0.5'%3E[Upload PNG: %0A" + imgUrl.split('/').pop() + "]%3C/text%3E%3C/svg%3E";
                    }}
                  />
                </div>
                <h2 className="text-2xl font-black text-foreground mb-1">{cat}</h2>
                <p className="text-[11px] text-foreground/60 leading-tight">Harga termasuk Sablon 1 Warna Reguler (Kecuali item polos/tutup).</p>
              </div>

              {/* Right Side: Table */}
              <div className="lg:w-3/4 w-full overflow-x-auto relative z-10">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="border-b-2 border-border/50">
                      <th className="py-3 px-3 font-bold text-foreground bg-foreground/5 rounded-tl-xl text-xs uppercase tracking-wider">Produk / Ukuran</th>
                      <th className="py-3 px-3 font-bold text-center text-primary bg-primary/5 text-xs uppercase tracking-wider">500 Pcs</th>
                      <th className="py-3 px-3 font-bold text-center text-primary bg-primary/5 text-xs uppercase tracking-wider">1.000 Pcs</th>
                      <th className="py-3 px-3 font-bold text-center text-primary bg-primary/5 rounded-tr-xl text-xs uppercase tracking-wider">5.000 Pcs</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/30">
                    {catProducts.map(product => {
                      // Tutup tidak pakai tiering sablon, hanya dikali kuantitas atau pakai base price ecer
                      // Di PDF, Tutup itu /pcs. Jadi kita tampilkan price_polos saja, tanpa sablon matrix, kecuali Addon jasa.
                      const isTutupOrPolos = product.isTutup || product.category === 'ADDON'
                      
                      const p = product.price_polos
                      const p500 = isTutupOrPolos ? p : p + (catMatrix.min_500 || 0)
                      const p1000 = isTutupOrPolos ? p : p + (catMatrix.min_1000 || 0)
                      const p5000 = isTutupOrPolos ? p : p + (catMatrix.min_5000 || 0)

                      return (
                        <tr key={product.product_code} className={`transition-colors group ${product.isTutup ? 'bg-foreground/[0.02] hover:bg-foreground/[0.04]' : 'hover:bg-foreground/5'}`}>
                          <td className="py-2.5 px-3 font-medium text-foreground/90 flex flex-col justify-center">
                            <span className={product.isTutup ? 'text-foreground/70 text-xs' : 'text-sm'}>
                              {product.isTutup ? '↳ ' + product.name : product.name}
                            </span>
                            <span className="text-[9px] text-foreground/40 font-mono opacity-0 group-hover:opacity-100 transition-opacity">{product.product_code}</span>
                          </td>
                          <td className="py-2.5 px-3 text-center text-foreground/80 text-xs">
                            {(!isTutupOrPolos && !catMatrix.min_500) ? '-' : formatRp(p500)}
                          </td>
                          <td className="py-2.5 px-3 text-center font-bold text-primary text-sm">
                            {(!isTutupOrPolos && !catMatrix.min_1000) ? formatRp(p) : formatRp(p1000)}
                          </td>
                          <td className="py-2.5 px-3 text-center text-foreground/80 text-xs">
                            {(!isTutupOrPolos && !catMatrix.min_5000) ? '-' : formatRp(p5000)}
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
