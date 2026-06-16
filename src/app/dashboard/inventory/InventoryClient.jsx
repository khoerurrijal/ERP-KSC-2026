'use client'

import { useState, useMemo } from 'react'
import { PackageSearch, Boxes, Plus, Filter, ChevronUp, ChevronDown, History } from 'lucide-react'
import Link from 'next/link'
import { updateStock } from '../master/products/actions'
import CustomSelect from '@/components/CustomSelect'

export default function InventoryClient({ products: initialProducts = [] }) {
  const [products, setProducts] = useState(initialProducts)
  const [searchQuery, setSearchQuery] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [filterCategory, setFilterCategory] = useState('')
  const [filterWorkshop, setFilterWorkshop] = useState('')
  const [sortConfig, setSortConfig] = useState({ key: 'name', direction: 'asc' })

  // Opname Modal State
  const [showOpnameModal, setShowOpnameModal] = useState(false)
  const [opnameProduct, setOpnameProduct] = useState(null)
  const [newStock, setNewStock] = useState('')
  const [isPending, setIsPending] = useState(false)

  const handleSort = (key) => {
    let direction = 'asc'
    if (sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc'
    setSortConfig({ key, direction })
  }

  const renderSortIcon = (key) => {
    if (sortConfig.key !== key) return null
    return sortConfig.direction === 'asc' ? <ChevronUp className="w-3 h-3 inline ml-1" /> : <ChevronDown className="w-3 h-3 inline ml-1" />
  }

  const categories = [...new Set(products.map(p => p.category).filter(Boolean))]

  const handleOpnameSubmit = async () => {
    if (!opnameProduct || newStock === '') return alert('Masukkan jumlah stok yang benar.')
    
    setIsPending(true)
    const res = await updateStock(opnameProduct.product_code, Number(newStock))
    setIsPending(false)

    if (res.error) {
      alert(res.error)
    } else {
      setProducts(products.map(p => 
        p.product_code === opnameProduct.product_code ? { ...p, stock_qty: Number(newStock) } : p
      ))
      setShowOpnameModal(false)
      setOpnameProduct(null)
      setNewStock('')
    }
  }

  const openOpnameModal = (product) => {
    setOpnameProduct(product)
    setNewStock(product.stock_qty || 0)
    setShowOpnameModal(true)
  }

  const filteredAndSorted = useMemo(() => {
    let result = products.filter(p => {
      const matchSearch = ((p.name || '').toLowerCase().includes(searchQuery.toLowerCase())) || 
                          ((p.category || '').toLowerCase().includes(searchQuery.toLowerCase()))
      
      const matchCat = filterCategory ? p.category === filterCategory : true
      
      // Workshop is normally a relation, e.g. p.workshops?.name
      const wsName = (p.workshop_code || p.workshops?.name || '').toUpperCase()
      let matchWs = true
      if (filterWorkshop) {
        matchWs = wsName === filterWorkshop
      }

      return matchSearch && matchCat && matchWs
    })

    result.sort((a, b) => {
      let valA = a[sortConfig.key]
      let valB = b[sortConfig.key]
      
      if (sortConfig.key === 'workshop') {
         valA = a.workshop_code || a.workshops?.name || ''
         valB = b.workshop_code || b.workshops?.name || ''
      }

      if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1
      if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1
      return 0
    })

    return result
  }, [products, searchQuery, filterCategory, filterWorkshop, sortConfig])

  return (
    <div className="space-y-6 animate-in fade-in zoom-in-95 duration-500">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Boxes className="w-6 h-6 text-green-400" />
            Inventory & Kalkulator
          </h1>
          <p className="text-sm text-foreground/60 mt-1">Pantau stok gudang dan riwayat barang masuk/keluar.</p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/dashboard/inventory/mutasi" className="btn-secondary h-10 px-4 flex items-center gap-2 text-sm whitespace-nowrap bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 border-purple-500/20">
            <History className="w-4 h-4" /> Riwayat Mutasi
          </Link>
          <Link href="/dashboard/purchases/new" className="btn-primary h-10 px-4 flex items-center gap-2 text-sm whitespace-nowrap">
            <Plus className="w-4 h-4" /> Restock (PO)
          </Link>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        
        <div className="md:col-span-4 glass-card overflow-hidden flex flex-col">
          <div className="p-4 border-b border-white/10 bg-white/5 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
            <h2 className="font-bold text-foreground flex items-center gap-2 whitespace-nowrap">
              <PackageSearch className="w-5 h-5 text-green-400" />
              Status Stok Barang
            </h2>
            <div className="flex gap-2 w-full sm:w-auto">
              <div className="relative w-full sm:w-64">
                <input 
                  type="text" 
                  placeholder="Cari produk..." 
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="glass-input pl-4 h-9 w-full text-sm"
                />
              </div>
              <button onClick={() => setShowFilters(!showFilters)} className={`btn-secondary h-9 px-3 flex items-center gap-2 text-sm ${showFilters ? 'bg-white/10' : ''}`}>
                <Filter className="w-4 h-4" />
              </button>
            </div>
          </div>

          {showFilters && (
            <div className="p-4 border-b border-white/10 bg-white/5 grid grid-cols-1 sm:grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2">
              <CustomSelect 
                value={filterCategory} 
                onChange={e => setFilterCategory(e.target.value)} 
                options={[
                  { value: "", label: "- Semua Kategori -" },
                  ...categories.map(c => ({ value: c, label: c }))
                ]}
              />
              <CustomSelect 
                value={filterWorkshop} 
                onChange={e => setFilterWorkshop(e.target.value)} 
                options={[
                  { value: "", label: "- Semua Workshop -" },
                  { value: "GUDANG", label: "GUDANG" },
                  { value: "GLOBAL", label: "GLOBAL" }
                ]}
              />
            </div>
          )}

          <div className="overflow-x-auto p-4">
            <table className="w-full text-sm text-left">
              <thead className="text-foreground/70 uppercase text-xs border-b border-white/10">
                <tr>
                  <th className="px-4 py-3 font-medium cursor-pointer hover:text-white" onClick={() => handleSort('name')}>Nama Produk {renderSortIcon('name')}</th>
                  <th className="px-4 py-3 font-medium cursor-pointer hover:text-white" onClick={() => handleSort('category')}>Kategori {renderSortIcon('category')}</th>
                  <th className="px-4 py-3 font-medium cursor-pointer hover:text-white" onClick={() => handleSort('workshop')}>Workshop {renderSortIcon('workshop')}</th>
                  <th className="px-4 py-3 font-medium text-right cursor-pointer hover:text-white" onClick={() => handleSort('stock_qty')}>Stok Fisik {renderSortIcon('stock_qty')}</th>
                  <th className="px-4 py-3 font-medium text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredAndSorted.map(p => (
                  <tr key={p.product_code} className="hover:bg-white/5">
                    <td className="px-4 py-3 font-medium text-foreground/90">{p.name}</td>
                    <td className="px-4 py-3 text-foreground/60">{p.category}</td>
                    <td className="px-4 py-3 text-foreground/60">{p.workshops?.name}</td>
                    <td className="px-4 py-3 text-right">
                      <span className={`font-bold ${p.stock_qty > 5000 ? 'text-green-400' : 'text-yellow-400'}`}>
                        {p.stock_qty || 0} {p.unit || 'pcs'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button 
                        onClick={() => openOpnameModal(p)}
                        className="text-xs bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded-full border border-white/10 text-foreground/80 transition-colors"
                      >
                        Opname
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredAndSorted.length === 0 && (
                  <tr>
                    <td colSpan="5" className="px-4 py-8 text-center text-foreground/40">Tidak ada produk ditemukan.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      {showOpnameModal && opnameProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-background border border-white/10 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="p-4 border-b border-white/10 bg-white/5 flex items-center justify-between">
              <h3 className="font-bold text-foreground">Stok Opname</h3>
              <button onClick={() => setShowOpnameModal(false)} className="text-foreground/50 hover:text-foreground">
                <Filter className="w-4 h-4 hidden" /> {/* Dummy icon reference, X would be better but we don't have it imported, let's just use text */}
                Batal
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <p className="text-xs text-foreground/60">Produk</p>
                <p className="font-medium text-foreground">{opnameProduct.name}</p>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-foreground/80">Stok Fisik Saat Ini</label>
                <input 
                  type="number" 
                  value={newStock}
                  onChange={e => setNewStock(e.target.value)}
                  className="glass-input w-full"
                />
              </div>
            </div>
            <div className="p-4 border-t border-white/10 bg-white/5 flex justify-end gap-3">
              <button onClick={() => setShowOpnameModal(false)} className="btn-secondary px-4 h-9 text-sm" disabled={isPending}>Tutup</button>
              <button onClick={handleOpnameSubmit} disabled={isPending} className="btn-primary px-4 h-9 text-sm">
                {isPending ? 'Menyimpan...' : 'Simpan Stok'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
