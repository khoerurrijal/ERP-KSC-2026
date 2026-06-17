'use client'

import { useState } from 'react'
import { PackageSearch } from 'lucide-react'

export default function StockSearchWidget({ products = [] }) {
  const [query, setQuery] = useState('')

  const filtered = query 
    ? products.filter(s => ((s.name || '').toLowerCase().includes(query.toLowerCase())))
    : products.slice(0, 3)

  return (
    <div className="glass-card flex flex-col mt-6 border-t-4 border-green-500 h-full">
      <div className="p-4 border-b border-white/10 bg-white/5 flex flex-col gap-3">
        <h2 className="font-bold text-foreground flex items-center gap-2">
          <PackageSearch className="w-5 h-5 text-green-400" /> Cek Stok Tersedia
        </h2>
        <input 
          type="text" 
          placeholder="Ketik nama cup/barang..." 
          value={query}
          onChange={e => setQuery(e.target.value)}
          className="glass-input w-full text-sm h-9"
        />
      </div>
      <div className="flex-1 overflow-y-auto p-4 max-h-[250px]">
        {filtered.length > 0 ? (
          <div className="space-y-3">
            {filtered.map(item => (
              <div key={item.id} className="flex justify-between items-center border-b border-white/5 pb-2 last:border-0 last:pb-0">
                <span className="text-sm text-foreground/80 font-medium">{item.name}</span>
                <span className={`text-sm font-bold ${item.stock_qty < 100 ? 'text-red-400' : 'text-green-400'}`}>
                  {Number(item.stock_qty || 0).toLocaleString('id-ID')} <span className="text-[10px] font-normal">{item.unit}</span>
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-center text-foreground/40 mt-4">Barang tidak ditemukan.</p>
        )}
      </div>
    </div>
  )
}
