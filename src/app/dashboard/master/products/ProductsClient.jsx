'use client'

import { useState, useRef } from 'react'
import { Search, Plus, Box, Trash2, CheckCircle2, Loader2, X, Upload } from 'lucide-react'
import { addProduct, deleteProduct, updateProduct, upsertProductsBulk } from './actions'
import CustomSelect from '@/components/CustomSelect'

export default function ProductsClient({ products: initialProducts = [], error = null }) {
  const [products, setProducts] = useState(initialProducts)
  const [searchQuery, setSearchQuery] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState(null)
  
  // Extract unique categories for datalist
  const uniqueCategories = Array.from(new Set(products.map(p => p.category).filter(Boolean)))
  
  const [name, setName] = useState('')
  const [category, setCategory] = useState('CUP')
  const [workshop, setWorkshop] = useState('GLOBAL')
  const [sellingPrice, setSellingPrice] = useState(0)
  const [isActive, setIsActive] = useState(true)
  const [units, setUnits] = useState([]) // Array of { unit_name, multiplier }
  const [isPending, setIsPending] = useState(false)
  const fileInputRef = useRef(null)

  const handleFileUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    
    setIsPending(true)
    const reader = new FileReader()
    reader.onload = async (event) => {
      const text = event.target.result
      const rows = text.split('\n').map(row => row.split(','))
      const headers = rows[0].map(h => h.trim().toLowerCase().replace(/"/g, ''))
      
      const parsedData = []
      for (let i = 1; i < rows.length; i++) {
        if (!rows[i] || rows[i].length < headers.length) continue
        const obj = {}
        headers.forEach((header, index) => {
          let val = rows[i][index]?.trim()?.replace(/"/g, '')
          if (val === '') return
          if (header === 'is_active') val = val.toUpperCase() === 'TRUE'
          obj[header] = val
        })
        if (obj.product_code) parsedData.push(obj)
      }
      
      if (parsedData.length === 0) {
        alert('File kosong atau format salah.')
        setIsPending(false)
        return
      }

      const res = await upsertProductsBulk(parsedData)
      setIsPending(false)
      if (res.error) {
        alert('Error import: ' + res.error)
      } else {
        alert('Berhasil mengupdate ' + parsedData.length + ' produk!')
        window.location.reload()
      }
    }
    reader.readAsText(file)
    e.target.value = null
  }

  const handleSubmit = async () => {
    if (!name) return alert('Nama produk wajib diisi.')
    if (!category) return alert('Kategori wajib diisi.')
    
    setIsPending(true)
    let res;

    if (editingId) {
      res = await updateProduct(editingId, {
        name, category, workshop_code: workshop, price_polos: Number(sellingPrice), is_active: isActive, units
      })
    } else {
      res = await addProduct({
        product_code: 'PRD-' + Date.now().toString().slice(-6),
        name, category, workshop_code: workshop, price_polos: Number(sellingPrice), is_active: isActive, units
      })
    }

    setIsPending(false)

    if (res.error) return alert(res.error)

    if (editingId) {
      setProducts(products.map(p => p.id === editingId ? res.product : p))
    } else {
      setProducts([res.product, ...products])
    }
    closeModal()
  }

  const closeModal = () => {
    setShowModal(false)
    setEditingId(null)
    setName('')
    setCategory('CUP')
    setSellingPrice(0)
    setIsActive(true)
    setUnits([])
  }

  const openEditModal = (product) => {
    setEditingId(product.id)
    setName(product.name)
    setCategory(product.category || '')
    setWorkshop(product.workshop_code || 'GLOBAL')
    setSellingPrice(product.price_polos || 0)
    setIsActive(product.is_active !== false) // Default true if undefined
    setUnits(product.product_units || [])
    setShowModal(true)
  }

  const handleDelete = async (id) => {
    if(!confirm('Hapus produk ini?')) return;
    const res = await deleteProduct(id)
    if (res.error) alert(res.error)
    else setProducts(products.filter(p => p.id !== id))
  }

  const filteredProducts = products.filter(p => 
    (p.name || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
    (p.product_code || '').toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="space-y-6 animate-in fade-in zoom-in-95 duration-500">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Box className="w-6 h-6 text-accent" />
            Produk (Products)
          </h1>
          <p className="text-sm text-foreground/60 mt-1">Daftar produk jadi yang siap dijual ke Pelanggan atau Marketplace.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-foreground/40" />
            <input 
              type="text" 
              placeholder="Cari barang jadi..." 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="glass-input !pl-10 h-10 w-64 text-sm"
            />
          </div>
            
          <input type="file" accept=".csv" className="hidden" ref={fileInputRef} onChange={handleFileUpload} />
          <button disabled={isPending} onClick={() => fileInputRef.current?.click()} className="btn-secondary h-10 px-4 flex items-center gap-2 text-sm bg-white/5 border border-white/10 hover:bg-white/10 rounded-xl transition-all">
            {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            Import CSV
          </button>

          <button onClick={() => { closeModal(); setShowModal(true); }} className="btn-primary h-10 px-4 flex items-center gap-2 text-sm">
            <Plus className="w-4 h-4" />
            Tambah Produk
          </button>
        </div>
      </header>

      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-white/5 border-b border-white/10 text-foreground/70 uppercase text-xs">
              <tr>
                <th className="px-6 py-4 font-medium">Kode</th>
                <th className="px-6 py-4 font-medium">Nama Produk</th>
                <th className="px-6 py-4 font-medium">Kategori</th>
                <th className="px-6 py-4 font-medium">Workshop</th>
                <th className="px-6 py-4 font-medium">HPP Murni (Modal)</th>
                <th className="px-6 py-4 font-medium text-center">Status</th>
                <th className="px-6 py-4 font-medium text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {error ? (
                <tr>
                  <td colSpan="7" className="px-6 py-8 text-center text-red-400">Gagal memuat data produk.</td>
                </tr>
              ) : filteredProducts?.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-12 text-center text-foreground/40">
                    Belum ada data barang jadi. Silakan tambah data baru.
                  </td>
                </tr>
              ) : filteredProducts?.map((item) => (
                <tr key={item.id} className="hover:bg-white/5 transition-colors">
                  <td className="px-6 py-4 font-medium text-accent">{item.product_code}</td>
                  <td className="px-6 py-4 text-foreground/90">{item.name}</td>
                  <td className="px-6 py-4 text-foreground/60">{item.category || '-'}</td>
                  <td className="px-6 py-4 text-foreground/80">{item.workshops?.name || '-'}</td>
                  <td className="px-6 py-4 text-foreground/90 font-semibold">
                    Rp {Number(item.price_polos || 0).toLocaleString('id-ID')}
                  </td>
                  <td className="px-6 py-4 text-center">
                    {item.is_active !== false ? (
                      <span className="px-2 py-1 text-[10px] font-bold bg-green-500/20 text-green-400 rounded-full border border-green-500/20">Aktif</span>
                    ) : (
                      <span className="px-2 py-1 text-[10px] font-bold bg-red-500/20 text-red-400 rounded-full border border-red-500/20">Non-Aktif</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right flex items-center justify-end gap-3">
                    <button onClick={() => openEditModal(item)} className="text-accent hover:text-accent/80 font-medium text-xs flex items-center gap-1">
                      Edit
                    </button>
                    <button onClick={() => handleDelete(item.id)} className="text-red-400 hover:text-red-300 font-medium text-xs flex items-center gap-1">
                      <Trash2 className="w-3 h-3" /> Hapus
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-background border border-white/10 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="p-4 border-b border-white/10 bg-white/5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Box className="w-5 h-5 text-primary" />
                <h3 className="font-bold text-foreground">{editingId ? 'Edit Produk' : 'Tambah Produk'}</h3>
              </div>
              <button onClick={closeModal} className="text-foreground/50 hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-medium text-foreground/80">Nama Produk <span className="text-red-400">*</span></label>
                <input 
                  type="text" 
                  value={name} 
                  onChange={e => setName(e.target.value)} 
                  placeholder="Contoh: Cup 16oz Sablon"
                  className="glass-input w-full" 
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-medium text-foreground/80">Kategori</label>
                  <input 
                    list="categories" 
                    value={category} 
                    onChange={e => setCategory(e.target.value)} 
                    placeholder="Pilih atau ketik baru..."
                    className="glass-input w-full"
                  />
                  <datalist id="categories">
                    {uniqueCategories.map(cat => (
                      <option key={cat} value={cat} />
                    ))}
                  </datalist>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-foreground/80 mb-1 block">Workshop</label>
                  <CustomSelect 
                    value={workshop} 
                    onChange={e => setWorkshop(e.target.value)} 
                    options={[
                      { value: "GLOBAL", label: "GLOBAL" },
                      { value: "KING", label: "KING" },
                      { value: "GUDANG", label: "GUDANG" }
                    ]}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-medium text-foreground/80">HPP Murni Dasar (Rp)</label>
                  <input 
                    type="number" 
                    value={sellingPrice} 
                    onChange={e => setSellingPrice(e.target.value)} 
                    className="glass-input w-full" 
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-foreground/80 mb-1 block">Status Produk</label>
                  <label className="flex items-center gap-2 cursor-pointer pt-1">
                    <input 
                      type="checkbox" 
                      checked={isActive} 
                      onChange={e => setIsActive(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-white/10 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500 relative"></div>
                    <span className="text-sm font-medium text-foreground/80">{isActive ? 'Aktif' : 'Non-Aktif'}</span>
                  </label>
                </div>
              </div>

              <div className="pt-4 border-t border-white/10">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-medium text-foreground/80">Satuan Konversi (Beli/Jual)</label>
                  <button 
                    onClick={() => setUnits([...units, { unit_name: 'DUS', multiplier: 1000 }])}
                    className="text-xs text-accent hover:text-accent/80 flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" /> Tambah Satuan
                  </button>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <input type="text" value="PCS" disabled className="glass-input w-24 bg-white/5 opacity-50 text-center" />
                    <span className="text-xs text-foreground/50">=</span>
                    <input type="number" value="1" disabled className="glass-input flex-1 bg-white/5 opacity-50" />
                    <span className="text-xs text-foreground/50">pcs</span>
                    <div className="w-8"></div>
                  </div>
                  {units.map((u, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input 
                        type="text" 
                        value={u.unit_name} 
                        onChange={e => {
                          const newUnits = [...units];
                          newUnits[i].unit_name = e.target.value.toUpperCase();
                          setUnits(newUnits);
                        }}
                        className="glass-input w-24 text-center uppercase" 
                      />
                      <span className="text-xs text-foreground/50">=</span>
                      <input 
                        type="number" 
                        value={u.multiplier} 
                        onChange={e => {
                          const newUnits = [...units];
                          newUnits[i].multiplier = Number(e.target.value);
                          setUnits(newUnits);
                        }}
                        className="glass-input flex-1" 
                      />
                      <span className="text-xs text-foreground/50">pcs</span>
                      <button onClick={() => setUnits(units.filter((_, idx) => idx !== i))} className="w-8 h-8 flex items-center justify-center text-red-400 hover:bg-red-400/10 rounded-lg">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-white/10 flex justify-end gap-3 bg-white/5">
              <button onClick={closeModal} className="btn-secondary px-4 h-10 text-sm" disabled={isPending}>Batal</button>
              <button onClick={handleSubmit} disabled={isPending} className="btn-primary px-4 h-10 text-sm flex items-center gap-2">
                {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} 
                {isPending ? 'Menyimpan...' : 'Simpan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
