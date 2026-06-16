'use client'

import { useState } from 'react'
import { Search, Plus, Truck, CheckCircle2, Edit2, Trash2, X, Loader2 } from 'lucide-react'
import { saveSupplier, deleteSupplier } from './actions'

export default function SuppliersClient({ initialSuppliers = [], error }) {
  const [suppliers, setSuppliers] = useState(initialSuppliers)
  const [searchQuery, setSearchQuery] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [loading, setLoading] = useState(false)

  // Form State
  const [formData, setFormData] = useState({
    id: '',
    supplier_name: '',
    phone: '',
    address: ''
  })

  const handleAddNew = () => {
    setFormData({ id: '', supplier_name: '', phone: '', address: '' })
    setShowModal(true)
  }

  const handleEdit = (supp) => {
    setFormData({
      id: supp.id,
      supplier_name: supp.supplier_name,
      phone: supp.phone || '',
      address: supp.address || ''
    })
    setShowModal(true)
  }

  const handleSave = async () => {
    if (!formData.supplier_name) return alert('Nama supplier wajib diisi.')
    
    setLoading(true)
    try {
      const res = await saveSupplier(formData)
      if (res.success) {
        // Optimistic update
        if (formData.id) {
          setSuppliers(suppliers.map(s => s.id === formData.id ? { ...s, ...formData } : s))
        } else {
          setSuppliers([{ ...formData, id: 'temp-' + Date.now(), created_at: new Date().toISOString() }, ...suppliers])
          // In a real scenario we might reload to get the real DB ID, but optimistic is fine for now
          window.location.reload()
        }
        setShowModal(false)
      } else {
        alert('Gagal menyimpan: ' + res.error)
      }
    } catch (err) {
      alert('Terjadi kesalahan')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id) => {
    if (confirm('Yakin ingin menghapus supplier ini?')) {
      const res = await deleteSupplier(id)
      if (res.success) {
        setSuppliers(suppliers.filter(s => s.id !== id))
      } else {
        alert('Gagal menghapus: ' + res.error)
      }
    }
  }

  const filteredSuppliers = suppliers.filter(c => 
    ((c.supplier_name || '').toLowerCase().includes(searchQuery.toLowerCase()))
  )

  return (
    <div className="space-y-6 animate-in fade-in zoom-in-95 duration-500">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Truck className="w-6 h-6 text-yellow-400" />
            Data Supplier
          </h1>
          <p className="text-sm text-foreground/60 mt-1">Daftar pemasok barang / bahan baku (Otomatis tersinkron dengan histori PO).</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-foreground/40" />
            <input 
              type="text" 
              placeholder="Cari supplier..." 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="glass-input !pl-10 h-10 w-64 text-sm"
            />
          </div>
          <button onClick={handleAddNew} className="btn-primary h-10 px-4 flex items-center gap-2 text-sm">
            <Plus className="w-4 h-4" />
            Tambah Supplier
          </button>
        </div>
      </header>

      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-white/5 border-b border-white/10 text-foreground/70 uppercase text-xs">
              <tr>
                <th className="px-6 py-4 font-medium">Nama Supplier</th>
                <th className="px-6 py-4 font-medium">No. Telepon</th>
                <th className="px-6 py-4 font-medium">Alamat</th>
                <th className="px-6 py-4 font-medium text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {error ? (
                <tr>
                  <td colSpan="4" className="px-6 py-8 text-center text-red-400">Gagal memuat data supplier.</td>
                </tr>
              ) : filteredSuppliers.length === 0 ? (
                <tr>
                  <td colSpan="4" className="px-6 py-12 text-center text-foreground/40">
                    Belum ada data supplier terdaftar.
                  </td>
                </tr>
              ) : filteredSuppliers.map((item) => (
                <tr key={item.id} className="hover:bg-white/5 transition-colors">
                  <td className="px-6 py-4 text-foreground/90 font-bold">{item.supplier_name}</td>
                  <td className="px-6 py-4 text-foreground/60">{item.phone || '-'}</td>
                  <td className="px-6 py-4 text-foreground/60">{item.address || '-'}</td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => handleEdit(item)} className="p-2 text-blue-400 hover:bg-blue-400/10 rounded-lg transition-colors">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDelete(item.id)} className="p-2 text-red-400 hover:bg-red-400/10 rounded-lg transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
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
            <div className="p-4 border-b border-white/10 bg-white/5 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Truck className="w-5 h-5 text-primary" />
                <h3 className="font-bold text-foreground">{formData.id ? 'Edit' : 'Tambah'} Supplier</h3>
              </div>
              <button onClick={() => setShowModal(false)} className="text-foreground/50 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-medium text-foreground/80">Nama Supplier <span className="text-red-400">*</span></label>
                <input 
                  type="text" 
                  value={formData.supplier_name} 
                  onChange={e => setFormData({...formData, supplier_name: e.target.value})} 
                  placeholder="Contoh: PT. Plastik Maju"
                  className="glass-input w-full" 
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-foreground/80">No HP / WhatsApp</label>
                <input 
                  type="text" 
                  value={formData.phone} 
                  onChange={e => setFormData({...formData, phone: e.target.value})} 
                  placeholder="0812..."
                  className="glass-input w-full" 
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-foreground/80">Alamat</label>
                <textarea 
                  value={formData.address} 
                  onChange={e => setFormData({...formData, address: e.target.value})} 
                  placeholder="Misal: Jl. Raya Bogor"
                  className="glass-input w-full min-h-[80px]" 
                />
              </div>
            </div>

            <div className="p-4 border-t border-white/10 flex justify-end gap-3 bg-white/5">
              <button onClick={() => setShowModal(false)} className="btn-secondary px-4 h-10 text-sm">Batal</button>
              <button disabled={loading} onClick={handleSave} className="btn-primary px-4 h-10 text-sm flex items-center gap-2 disabled:opacity-50">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} 
                {loading ? 'Menyimpan...' : 'Simpan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
