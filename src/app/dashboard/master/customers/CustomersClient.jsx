'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { Search, Plus, Users, CheckCircle2, Trash2, Loader2, ChevronLeft, ChevronRight } from 'lucide-react'
import { addCustomer, deleteCustomer, updateCustomer } from './actions'
import CustomSelect from '@/components/CustomSelect'

export default function CustomersClient({ 
  initialCustomers = [], 
  totalCount = 0,
  page = 1,
  pageSize = 50,
  error, 
  dropdownConfig = {},
  searchParams: passedSearchParams = {}
}) {
  const router = useRouter()
  const pathname = usePathname()
  const currentSearchParams = useSearchParams()

  const [customers, setCustomers] = useState(initialCustomers)
  const [searchQuery, setSearchQuery] = useState(passedSearchParams.search || '')
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState(null)

  useEffect(() => {
    setCustomers(initialCustomers)
  }, [initialCustomers])

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

  // Debounce search -> update URL
  useEffect(() => {
    const timer = setTimeout(() => {
      if ((passedSearchParams.search || '') !== searchQuery) {
        updateQueryParams({ search: searchQuery, page: '1' })
      }
    }, 350)
    return () => clearTimeout(timer)
  }, [searchQuery, passedSearchParams.search, updateQueryParams])

  // Form State
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [type, setType] = useState((dropdownConfig?.customer_type && dropdownConfig.customer_type.length > 0) ? dropdownConfig.customer_type[0] : "REGULLER")
  const [city, setCity] = useState('')
  const [isPending, setIsPending] = useState(false)

  const handleSubmit = async () => {
    if (!name) return alert('Nama pelanggan wajib diisi.')
    
    setIsPending(true)
    let res;

    if (editingId) {
      res = await updateCustomer(editingId, {
        name, phone, type, city
      })
    } else {
      res = await addCustomer({
        customer_code: 'CUST-' + Math.floor(Math.random() * 10000),
        name, phone, type, city,
      })
    }

    setIsPending(false)

    if (res.error) {
      return alert(res.error)
    }

    if (editingId) {
      setCustomers(customers.map(c => c.id === editingId ? res.customer : c))
    } else {
      setCustomers([...customers, res.customer])
    }
    closeModal()
  }

  const closeModal = () => {
    setShowModal(false)
    setEditingId(null)
    setName('')
    setPhone('')
    setType((dropdownConfig?.customer_type && dropdownConfig.customer_type.length > 0) ? dropdownConfig.customer_type[0] : "REGULLER")
    setCity('')
  }

  const openEditModal = (customer) => {
    setEditingId(customer.id)
    setName(customer.name)
    setPhone(customer.phone || '')
    setType(customer.type || ((dropdownConfig?.customer_type && dropdownConfig.customer_type.length > 0) ? dropdownConfig.customer_type[0] : "REGULLER"))
    setCity(customer.city || '')
    setShowModal(true)
  }

  const handleDelete = async (id) => {
    if(!confirm('Hapus pelanggan ini?')) return;
    const res = await deleteCustomer(id)
    if (res.error) {
      alert(res.error)
    } else {
      setCustomers(customers.filter(c => c.id !== id))
    }
  }

  const filteredCustomers = customers

  return (
    <div className="space-y-4 animate-in fade-in zoom-in-95 duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-end gap-3">
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-foreground/40" />
            <input 
              type="text" 
              placeholder="Cari pelanggan..." 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="glass-input !pl-10 h-10 w-64 text-sm"
            />
          </div>
          <button onClick={() => { closeModal(); setShowModal(true); }} className="btn-primary h-10 px-4 flex items-center gap-2 text-sm">
            <Plus className="w-4 h-4" />
            Tambah Pelanggan
          </button>
        </div>
      </div>

      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-white/5 border-b border-white/10 text-foreground/70 uppercase text-xs">
              <tr>
                <th className="px-6 py-4 font-medium">Kode</th>
                <th className="px-6 py-4 font-medium">Nama / Brand</th>
                <th className="px-6 py-4 font-medium">Tipe</th>
                <th className="px-6 py-4 font-medium">Telepon</th>
                <th className="px-6 py-4 font-medium">Kota</th>
                <th className="px-6 py-4 font-medium text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {error ? (
                <tr>
                  <td colSpan="6" className="px-6 py-8 text-center text-red-400">Gagal memuat data pelanggan.</td>
                </tr>
              ) : filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-12 text-center text-foreground/40">
                    Belum ada data pelanggan terdaftar.
                  </td>
                </tr>
              ) : filteredCustomers.map((item) => (
                <tr key={item.id} className="hover:bg-white/5 transition-colors">
                  <td className="px-6 py-4 font-medium text-green-400">{item.customer_code}</td>
                  <td className="px-6 py-4 text-foreground/90 font-medium">{item.name}</td>
                  <td className="px-6 py-4 text-foreground/60">{item.type || 'Reguler'}</td>
                  <td className="px-6 py-4 text-foreground/60">{item.phone || '-'}</td>
                  <td className="px-6 py-4 text-foreground/60">{item.city || '-'}</td>
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

        {/* Pagination Bar */}
        <div className="p-4 border-t border-white/10 bg-white/5 flex flex-col sm:flex-row justify-between items-center gap-4 text-xs text-foreground/70">
          <div>
            Menampilkan {totalCount === 0 ? 0 : (page - 1) * pageSize + 1} - {Math.min(page * pageSize, totalCount)} dari <span className="font-bold text-foreground">{totalCount}</span> pelanggan
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

      {showModal && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onMouseDown={event => event.target === event.currentTarget && closeModal()}>
          <div className="bg-background border border-white/10 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="p-4 border-b border-white/10 bg-white/5 flex items-center gap-2">
              <Plus className="w-5 h-5 text-primary" />
              <h3 className="font-bold text-foreground">{editingId ? 'Edit Pelanggan' : 'Tambah Pelanggan Baru'}</h3>
            </div>
            
            <div className="p-6 space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-medium text-foreground/80">Nama / Brand <span className="text-red-400">*</span></label>
                <input 
                  type="text" 
                  value={name} 
                  onChange={e => setName(e.target.value)} 
                  placeholder="Contoh: Kedai Kopi XYZ"
                  className="glass-input w-full" 
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-medium text-foreground/80">No HP / WhatsApp</label>
                  <input 
                    type="text" 
                    value={phone} 
                    onChange={e => setPhone(e.target.value)} 
                    placeholder="0812..."
                    className="glass-input w-full" 
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-foreground/80 mb-1 block">Tipe Pelanggan</label>
                  <CustomSelect 
                    value={type} 
                    onChange={e => setType(e.target.value)} 
                    options={[
                      ...(dropdownConfig.customer_type || ["REGULLER", "RESELLER", "SHOPEE", "TOKOPEDIA"]).map(t => ({ value: t, label: t }))
                    ]}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-foreground/80">Kota / Alamat</label>
                <input 
                  type="text" 
                  value={city} 
                  onChange={e => setCity(e.target.value)} 
                  placeholder="Misal: Jakarta Barat"
                  className="glass-input w-full" 
                />
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
