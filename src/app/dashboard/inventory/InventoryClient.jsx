'use client'

import { useState, useMemo } from 'react'
import { PackageSearch, Boxes, Plus, Filter, ChevronUp, ChevronDown, History, Kanban, Package, ShoppingCart, Settings, Gift, Truck, CheckCircle2 } from 'lucide-react'
import Link from 'next/link'
import { updateStock } from '../master/products/actions'
import CustomSelect from '@/components/CustomSelect'

export default function InventoryClient({ products: initialProducts = [], pipelineData = [] }) {
  const [activeTab, setActiveTab] = useState('tabel')
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
        p.product_code === opnameProduct.product_code ? { ...p, physical_stock: Number(newStock) } : p
      ))
      setShowOpnameModal(false)
      setOpnameProduct(null)
      setNewStock('')
    }
  }

  const openOpnameModal = (product) => {
    setOpnameProduct(product)
    setNewStock(product.physical_stock || 0)
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

  const filteredPipelineData = useMemo(() => {
    let result = pipelineData.filter(pipe => {
      const matchSearch = ((pipe.product_name || '').toLowerCase().includes(searchQuery.toLowerCase())) || 
                          ((pipe.category || '').toLowerCase().includes(searchQuery.toLowerCase()))
      
      const matchCat = filterCategory ? pipe.category === filterCategory : true
      
      return matchSearch && matchCat
    })

    result.sort((a, b) => {
      let valA = a[sortConfig.key] || a.product_name
      let valB = b[sortConfig.key] || b.product_name
      
      // Override sorting for pipeline numeric columns
      if (['fisik', 'qty_booking', 'qty_proses', 'qty_siap', 'qty_selesai', 'tersedia'].includes(sortConfig.key)) {
         valA = Number(a[sortConfig.key] || 0)
         valB = Number(b[sortConfig.key] || 0)
      } else if (sortConfig.key === 'name') {
         valA = a.product_name
         valB = b.product_name
      }

      if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1
      if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1
      return 0
    })

    return result
  }, [pipelineData, searchQuery, filterCategory, sortConfig])

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

      <div className="flex items-center gap-4 mb-6 border-b border-white/10 pb-4 overflow-x-auto hide-scrollbar">
        <button onClick={() => setActiveTab('tabel')} className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all whitespace-nowrap ${activeTab === 'tabel' ? 'bg-primary text-background' : 'bg-white/5 text-foreground/60 hover:text-foreground hover:bg-white/10'}`}>
          <PackageSearch className="w-4 h-4" /> Tabel Stok
        </button>
        <button onClick={() => setActiveTab('pipeline')} className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all whitespace-nowrap ${activeTab === 'pipeline' ? 'bg-primary text-background' : 'bg-white/5 text-foreground/60 hover:text-foreground hover:bg-white/10'}`}>
          <Kanban className="w-4 h-4" /> Live Tracking (Pipeline)
        </button>
      </div>

      {activeTab === 'tabel' && (
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
                  <th className="px-4 py-3 font-medium text-right cursor-pointer hover:text-white" onClick={() => handleSort('stock_qty')}>Stok Tersedia {renderSortIcon('stock_qty')}</th>
                  <th className="px-4 py-3 font-medium text-right cursor-pointer hover:text-white" onClick={() => handleSort('physical_stock')}>Stok Fisik {renderSortIcon('physical_stock')}</th>
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
                      <span className={`font-bold ${p.stock_qty > 5000 ? 'text-blue-400' : 'text-blue-200'}`}>
                        {p.stock_qty || 0} {p.unit || 'pcs'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={`font-bold ${p.physical_stock > 5000 ? 'text-green-400' : 'text-yellow-400'}`}>
                        {p.physical_stock || 0} {p.unit || 'pcs'}
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
      )}

      {activeTab === 'pipeline' && (
        <div className="glass-card overflow-hidden">
          <div className="p-4 border-b border-white/10 bg-white/5 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
            <div>
              <h2 className="font-bold text-foreground flex items-center gap-2">
                <Kanban className="w-5 h-5 text-primary" />
                Pipeline Pergerakan Stok per Produk
              </h2>
              <p className="text-xs text-foreground/60 mt-1">Pantau kemacetan (bottleneck) dan kesehatan aliran stok harian Anda.</p>
            </div>
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
            <div className="p-4 border-b border-white/10 bg-white/5 animate-in fade-in slide-in-from-top-2">
              <CustomSelect 
                value={filterCategory} 
                onChange={e => setFilterCategory(e.target.value)} 
                options={[
                  { value: "", label: "- Semua Kategori -" },
                  ...categories.map(c => ({ value: c, label: c }))
                ]}
              />
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm whitespace-nowrap">
              <thead>
                <tr className="border-b border-white/10 bg-white/5">
                  <th className="p-4 font-semibold text-foreground/60 sticky left-0 bg-background/95 backdrop-blur-sm z-10 w-64 cursor-pointer hover:text-white" onClick={() => handleSort('name')}><div className="flex items-center gap-2"><Package className="w-4 h-4"/> Produk {renderSortIcon('name')}</div></th>
                  <th className="p-4 font-semibold text-foreground/60 text-center cursor-pointer hover:text-white" onClick={() => handleSort('fisik')}>Fisik (Gudang) {renderSortIcon('fisik')}</th>
                  <th className="p-4 font-semibold text-blue-400 text-center cursor-pointer hover:text-blue-300" onClick={() => handleSort('qty_booking')}><div className="flex items-center justify-center gap-1"><ShoppingCart className="w-4 h-4"/> Baru Masuk {renderSortIcon('qty_booking')}</div></th>
                  <th className="p-4 font-semibold text-yellow-400 text-center cursor-pointer hover:text-yellow-300" onClick={() => handleSort('qty_proses')}><div className="flex items-center justify-center gap-1"><Settings className="w-4 h-4"/> Proses {renderSortIcon('qty_proses')}</div></th>
                  <th className="p-4 font-semibold text-orange-400 text-center cursor-pointer hover:text-orange-300" onClick={() => handleSort('qty_siap')}><div className="flex items-center justify-center gap-1"><Gift className="w-4 h-4"/> Sudah Jadi {renderSortIcon('qty_siap')}</div></th>
                  <th className="p-4 font-semibold text-purple-400 text-center cursor-pointer hover:text-purple-300" onClick={() => handleSort('qty_selesai')}><div className="flex items-center justify-center gap-1"><Truck className="w-4 h-4"/> Dikirim {renderSortIcon('qty_selesai')}</div></th>
                  <th className="p-4 font-semibold text-green-400 text-center cursor-pointer hover:text-green-300" onClick={() => handleSort('tersedia')}><div className="flex items-center justify-center gap-1"><CheckCircle2 className="w-4 h-4"/> Tersedia (Bebas) {renderSortIcon('tersedia')}</div></th>
                </tr>
              </thead>
              <tbody>
                {filteredPipelineData.map(pipe => (
                  <tr key={pipe.product_code} className="border-b border-white/5 hover:bg-white/5 transition-colors group">
                    <td className="p-4 sticky left-0 bg-background/95 backdrop-blur-sm group-hover:bg-white/5 transition-colors">
                      <p className="font-semibold text-foreground text-sm truncate w-64">{pipe.product_name}</p>
                      <p className="text-xs text-foreground/50">{pipe.category}</p>
                    </td>
                    <td className="p-4 text-center">
                      <span className="font-bold text-base">{Number(pipe.fisik).toLocaleString('id-ID')}</span>
                    </td>
                    <td className="p-4 text-center">
                      <span className={`px-3 py-1 rounded-full font-bold ${pipe.qty_booking > 0 ? 'bg-blue-500/20 text-blue-400' : 'text-foreground/20'}`}>
                        {Number(pipe.qty_booking).toLocaleString('id-ID')}
                      </span>
                    </td>
                    <td className="p-4 text-center">
                      <span className={`px-3 py-1 rounded-full font-bold ${pipe.qty_proses > 0 ? 'bg-yellow-500/20 text-yellow-400' : 'text-foreground/20'}`}>
                        {Number(pipe.qty_proses).toLocaleString('id-ID')}
                      </span>
                    </td>
                    <td className="p-4 text-center">
                      <span className={`px-3 py-1 rounded-full font-bold ${pipe.qty_siap > 0 ? 'bg-orange-500/20 text-orange-400' : 'text-foreground/20'}`}>
                        {Number(pipe.qty_siap).toLocaleString('id-ID')}
                      </span>
                    </td>
                    <td className="p-4 text-center">
                      <span className={`px-3 py-1 rounded-full font-bold ${pipe.qty_selesai > 0 ? 'bg-purple-500/20 text-purple-400' : 'text-foreground/20'}`}>
                        {Number(pipe.qty_selesai).toLocaleString('id-ID')}
                      </span>
                    </td>
                    <td className="p-4 text-center">
                      <span className={`px-3 py-1 rounded-full font-bold ${pipe.tersedia > 0 ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                        {Number(pipe.tersedia).toLocaleString('id-ID')}
                      </span>
                    </td>
                  </tr>
                ))}
                {filteredPipelineData.length === 0 && (
                  <tr><td colSpan="7" className="text-center p-8 text-foreground/50">Tidak ada data produk yang ditemukan.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showOpnameModal && opnameProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-background border border-white/10 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="p-4 border-b border-white/10 bg-white/5 flex items-center justify-between">
              <h3 className="font-bold text-foreground">Stok Opname</h3>
              <button onClick={() => setShowOpnameModal(false)} className="text-foreground/50 hover:text-foreground">
                <Filter className="w-4 h-4 hidden" />
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
