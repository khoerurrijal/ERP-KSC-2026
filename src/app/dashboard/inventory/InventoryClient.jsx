'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { PackageSearch, Boxes, Plus, Filter, ChevronUp, ChevronDown, Kanban, Package, ShoppingCart, Settings, Gift, Truck, CheckCircle2, ChevronLeft, ChevronRight } from 'lucide-react'
import Link from 'next/link'
import { updateStock } from '../master/products/actions'
import CustomSelect from '@/components/CustomSelect'

export default function InventoryClient({ 
  products: initialProducts = [], 
  totalCount = 0,
  page = 1,
  pageSize = 50,
  pipelineData = [], 
  workshops = [],
  categories: passedCategories = [],
  searchParams = {}
}) {
  const router = useRouter()
  const pathname = usePathname()
  const currentSearchParams = useSearchParams()

  const [activeTab, setActiveTab] = useState('tabel')
  const [products, setProducts] = useState(initialProducts)
  const [searchQuery, setSearchQuery] = useState(searchParams.search || '')
  const [showFilters, setShowFilters] = useState(Boolean(searchParams.category || searchParams.workshop))
  const [filterCategory, setFilterCategory] = useState(searchParams.category || '')
  const [filterWorkshop, setFilterWorkshop] = useState(searchParams.workshop || '')
  const [sortConfig, setSortConfig] = useState({ 
    key: searchParams.sortKey || 'name', 
    direction: searchParams.sortDir || 'asc' 
  })
  const [pipelinePage, setPipelinePage] = useState(1)
  const pipelinePageSize = 50
  
  const [debouncedSearch, setDebouncedSearch] = useState(searchParams.search || '')
  const [showOpnameModal, setShowOpnameModal] = useState(false)
  const [opnameProduct, setOpnameProduct] = useState(null)
  const [newStock, setNewStock] = useState('')
  const [isPending, setIsPending] = useState(false)

  // Sync initialProducts if server re-renders
  useEffect(() => {
    setProducts(initialProducts)
  }, [initialProducts])

  const updateQueryParams = useCallback((newParams) => {
    const params = new URLSearchParams(Array.from(currentSearchParams.entries()))
    Object.entries(newParams).forEach(([key, val]) => {
      if (val) {
        params.set(key, val)
      } else {
        params.delete(key)
      }
    })
    router.push(`${pathname}?${params.toString()}`)
  }, [currentSearchParams, pathname, router])

  // Debounce search input -> update URL
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery)
      if ((searchParams.search || '') !== searchQuery) {
        updateQueryParams({ search: searchQuery, page: '1' })
      }
    }, 350)
    return () => clearTimeout(timer)
  }, [searchQuery, searchParams.search, updateQueryParams])

  const handleSort = (key) => {
    let direction = 'asc'
    if (sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc'
    setSortConfig({ key, direction })
    updateQueryParams({ sortKey: key, sortDir: direction, page: '1' })
  }

  const renderSortIcon = (key) => {
    if (sortConfig.key !== key) return null
    return sortConfig.direction === 'asc' ? <ChevronUp className="w-3 h-3 inline ml-1" /> : <ChevronDown className="w-3 h-3 inline ml-1" />
  }

  const categories = passedCategories.length > 0 
    ? passedCategories 
    : [...new Set(products.map(p => p.category).filter(Boolean))]

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
    return products
  }, [products])

  const filteredPipelineData = useMemo(() => {
    let result = pipelineData.filter(pipe => {
      const isActive = products.some(p => p.product_code === pipe.product_code)
      if (!isActive) return false

      const matchSearch = ((pipe.product_name || '').toLowerCase().includes(debouncedSearch.toLowerCase())) || 
                          ((pipe.category || '').toLowerCase().includes(debouncedSearch.toLowerCase()))
      
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
  }, [pipelineData, debouncedSearch, filterCategory, sortConfig])

  useEffect(() => {
    setPipelinePage(1)
  }, [debouncedSearch, filterCategory, sortConfig])

  const paginatedPipeline = useMemo(() => {
    const start = (pipelinePage - 1) * pipelinePageSize
    return filteredPipelineData.slice(start, start + pipelinePageSize)
  }, [filteredPipelineData, pipelinePage, pipelinePageSize])

  return (
    <div className="space-y-6 animate-in fade-in zoom-in-95 duration-500">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Boxes className="w-6 h-6 text-green-400" />
            Inventory
          </h1>
          <p className="text-sm text-foreground/60 mt-1">Pantau stok gudang dan riwayat barang masuk/keluar.</p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/purchases/new" className="btn-primary h-10 px-4 flex items-center gap-2 text-sm whitespace-nowrap">
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
                onChange={e => {
                  const val = e.target.value
                  setFilterCategory(val)
                  updateQueryParams({ category: val, page: '1' })
                }} 
                options={[
                  { value: "", label: "- Semua Kategori -" },
                  ...categories.map(c => ({ value: c, label: c }))
                ]}
              />
              <CustomSelect 
                value={filterWorkshop} 
                onChange={e => {
                  const val = e.target.value
                  setFilterWorkshop(val)
                  updateQueryParams({ workshop: val, page: '1' })
                }} 
                options={[
                  { value: "", label: "- Semua Workshop -" },
                  ...(workshops.length > 0
                    ? workshops.map(w => ({ value: w.code, label: w.name }))
                    : [
                        { value: "GUDANG", label: "GUDANG" },
                        { value: "GLOBAL", label: "GLOBAL" }
                      ])
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

          {/* Pagination Bar */}
          <div className="p-4 border-t border-white/10 bg-white/5 flex flex-col sm:flex-row justify-between items-center gap-4 text-xs text-foreground/70">
            <div>
              Menampilkan {totalCount === 0 ? 0 : (page - 1) * pageSize + 1} - {Math.min(page * pageSize, totalCount)} dari <span className="font-bold text-foreground">{totalCount}</span> barang
            </div>
            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1}
                onClick={() => updateQueryParams({ page: (page - 1).toString() })}
                className="btn-secondary px-3 py-1.5 text-xs flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-3.5 h-3.5" /> Previous
              </button>
              <span className="px-3 font-medium text-foreground">
                Halaman {page} dari {Math.ceil(totalCount / pageSize) || 1}
              </span>
              <button
                disabled={page >= Math.ceil(totalCount / pageSize)}
                onClick={() => updateQueryParams({ page: (page + 1).toString() })}
                className="btn-secondary px-3 py-1.5 text-xs flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Next <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
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
                {paginatedPipeline.map(pipe => (
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
                {paginatedPipeline.length === 0 && (
                  <tr><td colSpan="7" className="text-center p-8 text-foreground/50">Tidak ada data produk yang ditemukan.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          
          {/* Pagination Controls for Pipeline */}
          <div className="p-4 border-t border-white/10 bg-white/5 flex flex-col sm:flex-row justify-between items-center gap-4 text-xs text-foreground/70">
            <div>
              Menampilkan {filteredPipelineData.length === 0 ? 0 : (pipelinePage - 1) * pipelinePageSize + 1} - {Math.min(pipelinePage * pipelinePageSize, filteredPipelineData.length)} dari <span className="font-bold text-foreground">{filteredPipelineData.length}</span> produk
            </div>
            <div className="flex items-center gap-2">
              <button
                disabled={pipelinePage <= 1}
                onClick={() => setPipelinePage(p => p - 1)}
                className="btn-secondary px-3 py-1.5 text-xs flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-3.5 h-3.5" /> Previous
              </button>
              <span className="px-3 font-medium text-foreground">
                Halaman {pipelinePage} dari {Math.ceil(filteredPipelineData.length / pipelinePageSize) || 1}
              </span>
              <button
                disabled={pipelinePage >= Math.ceil(filteredPipelineData.length / pipelinePageSize)}
                onClick={() => setPipelinePage(p => p + 1)}
                className="btn-secondary px-3 py-1.5 text-xs flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Next <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
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
