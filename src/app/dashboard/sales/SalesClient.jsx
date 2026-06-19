'use client'

import { useState, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Search, Plus, TrendingUp, Filter, ChevronUp, ChevronDown, Edit, X, Save, Clock, Edit3, Share2, ExternalLink } from 'lucide-react'
import { createClient } from '@/utils/supabase/client'
import { addSalesPayment } from '@/app/actions/sales'
import MonthFilter from '@/components/MonthFilter'
import CustomSelect from '@/components/CustomSelect'
import CustomDatePicker from '@/components/CustomDatePicker'

export default function SalesClient({ salesOrders = [], dropdownConfig = {} }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  const [searchQuery, setSearchQuery] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [filterStatus, setFilterStatus] = useState('BELUM_LUNAS') // ACTIVE, SELESAI, ALL
  
  const filterMonth = searchParams.get('month') || (() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })()
  
  const [sortConfig, setSortConfig] = useState({ key: 'date', direction: 'desc' })
  
  // Modal Edit State
  const [editingOrder, setEditingOrder] = useState(null)
  const [paymentHistory, setPaymentHistory] = useState([])
  const [isLoadingHistory, setIsLoadingHistory] = useState(false)
  
  const [newPaymentAmount, setNewPaymentAmount] = useState('')
  const [newPaymentMethod, setNewPaymentMethod] = useState('BCA')
  const [newPaymentDate, setNewPaymentDate] = useState(new Date().toISOString().split('T')[0])
  const [isSaving, setIsSaving] = useState(false)

  const handleEditClick = async (order) => {
    setEditingOrder(order)
    setNewPaymentAmount('')
    setNewPaymentMethod('BCA')
    setNewPaymentDate(new Date().toISOString().split('T')[0])
    
    setIsLoadingHistory(true)
    const { data } = await supabase.from('transactions')
      .select('*')
      .eq('so_id', order.id)
      .eq('reference', 'PENJUALAN')
      .order('date', { ascending: true })
    setPaymentHistory(data || [])
    setIsLoadingHistory(false)
  }

  const closeEditModal = () => {
    setEditingOrder(null)
  }

  const handleSaveEdit = async () => {
    if (!newPaymentAmount || Number(newPaymentAmount) <= 0) {
      alert('Masukkan nominal pembayaran yang valid!')
      return
    }

    setIsSaving(true)
    try {
      const res = await addSalesPayment(editingOrder.id, Number(newPaymentAmount), newPaymentMethod, newPaymentDate)
      if (res.success) {
        alert('Pembayaran berhasil ditambahkan!')
        closeEditModal()
        router.refresh()
      } else {
        alert('Gagal menambah pembayaran: ' + res.error)
      }
    } catch (err) {
      console.error(err)
      alert('Terjadi kesalahan')
    } finally {
      setIsSaving(false)
    }
  }

  const handleSort = (key) => {
    let direction = 'asc'
    if (sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc'
    setSortConfig({ key, direction })
  }

  const renderSortIcon = (key) => {
    if (sortConfig.key !== key) return null
    return sortConfig.direction === 'asc' ? <ChevronUp className="w-3 h-3 inline ml-1" /> : <ChevronDown className="w-3 h-3 inline ml-1" />
  }

  // Pisahkan order marketplace. Marketplace hanya jika marketplace_receipt ada isinya
  const nonMarketplaceOrders = salesOrders.filter(so => !so.marketplace_receipt)

  const filteredAndSorted = useMemo(() => {
    let result = nonMarketplaceOrders.filter(so => {
      const query = String(searchQuery || '').toLowerCase()
      const matchSearch = String(so.invoice_number || '').toLowerCase().includes(query) || 
                          String(so.customers?.name || '').toLowerCase().includes(query)
      
      // Filter payment status
      let matchStatus = true
      if (filterStatus === 'LUNAS') {
        matchStatus = so.payment_status === 'LUNAS'
      } else if (filterStatus === 'BELUM_LUNAS') {
        matchStatus = so.payment_status === 'BELUM LUNAS' || so.payment_status === 'DP'
      }

      let matchMonth = true
      if (filterMonth && !searchQuery) {
        const orderMonth = new Date(so.date).toISOString().substring(0, 7) // YYYY-MM
        matchMonth = orderMonth === filterMonth
      }

      return matchSearch && matchStatus && matchMonth
    })

    result.sort((a, b) => {
      let valA = a[sortConfig.key]
      let valB = b[sortConfig.key]
      
      // Handle nested fields if needed (e.g., customers.name)
      if (sortConfig.key === 'customers_name') {
         valA = a.customers?.name || ''
         valB = b.customers?.name || ''
      }

      if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1
      if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1
      return 0
    })

    return result
  }, [nonMarketplaceOrders, searchQuery, filterStatus, filterMonth, sortConfig])

  return (
    <div className="space-y-6 animate-in fade-in zoom-in-95 duration-500">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-green-400" />
            Daftar Sales Orders (SO)
          </h1>
          <p className="text-sm text-foreground/60 mt-1">Kelola penjualan dan riwayat pesanan (Non-Marketplace).</p>
        </div>
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-foreground/40" />
            <input 
              type="text" 
              placeholder="Cari invoice/pelanggan..." 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="glass-input !pl-10 h-10 w-full text-sm"
            />
          </div>
          <div className="hidden sm:block">
            <MonthFilter />
          </div>
          <button onClick={() => setShowFilters(!showFilters)} className={`btn-secondary h-10 px-4 flex items-center gap-2 text-sm ${showFilters ? 'bg-white/10' : ''}`}>
            <Filter className="w-4 h-4" /> Filter
          </button>
          <Link href="/dashboard/sales/new" className="btn-primary h-10 px-4 flex items-center gap-2 text-sm whitespace-nowrap">
            <Plus className="w-4 h-4" />
            Buat SO Baru
          </Link>
        </div>
      </header>

      {showFilters && (
        <div className="glass-card p-4 grid grid-cols-1 md:grid-cols-3 gap-4 animate-in fade-in slide-in-from-top-2 mb-6 relative z-50">
          <div className="space-y-1 block sm:hidden">
            <label className="text-xs text-foreground/60">Bulan</label>
            <MonthFilter />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-foreground/60">Status Pembayaran</label>
            <CustomSelect 
              value={filterStatus} 
              onChange={e => setFilterStatus(e.target.value)} 
              options={[
                { value: "ALL", label: "Semua Pembayaran" },
                { value: "BELUM_LUNAS", label: "Belum Lunas / DP" },
                { value: "LUNAS", label: "Lunas" }
              ]}
            />
          </div>
        </div>
      )}

      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-white/5 border-b border-white/10 text-foreground/70 uppercase text-xs">
              <tr>
                <th className="px-6 py-4 font-medium cursor-pointer hover:text-white" onClick={() => handleSort('date')}>Tanggal {renderSortIcon('date')}</th>
                <th className="px-6 py-4 font-medium cursor-pointer hover:text-white" onClick={() => handleSort('customers_name')}>Pelanggan {renderSortIcon('customers_name')}</th>
                <th className="px-6 py-4 font-medium cursor-pointer hover:text-white" onClick={() => handleSort('grand_total')}>Total Nominal {renderSortIcon('grand_total')}</th>
                <th className="px-6 py-4 font-medium cursor-pointer hover:text-white" onClick={() => handleSort('payment_status')}>Status Bayar {renderSortIcon('payment_status')}</th>
                <th className="px-6 py-4 font-medium text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredAndSorted.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-6 py-12 text-center text-foreground/40">
                    Belum ada riwayat Sales Order.
                  </td>
                </tr>
              ) : filteredAndSorted.map((item) => {
                return (
                  <tr key={item.id} className="hover:bg-white/5 transition-colors">
                    <td className="px-6 py-4 text-foreground/90">{new Date(item.date).toLocaleDateString('id-ID')}</td>
                    <td className="px-6 py-4 text-foreground/90 font-medium">{item.customers?.name}</td>
                    <td className="px-6 py-4 font-semibold text-green-400">Rp {Number(item.grand_total || item.total_amount || 0).toLocaleString('id-ID')}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-bold border border-white/10 ${item.payment_status === 'LUNAS' ? 'bg-green-500/20 text-green-400' : item.payment_status === 'DP' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-red-500/20 text-red-400'}`}>
                        {item.payment_status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right flex items-center justify-end gap-3">
                      {(item.payment_status === 'BELUM LUNAS' || item.payment_status === 'DP') && (
                        <Link href={`/dashboard/sales/edit/${item.id}`} className="text-blue-400 hover:text-blue-300 font-medium text-xs flex items-center gap-1">
                          <Edit3 className="w-3 h-3" /> Edit Item
                        </Link>
                      )}
                      <Link 
                        href={`/track/${item.id}`}
                        target="_blank"
                        className="text-green-400 hover:text-green-300 font-medium text-xs flex items-center gap-1"
                        title="Buka Layar Pelacakan"
                      >
                        <ExternalLink className="w-3 h-3" /> Tracking
                      </Link>
                      <button onClick={() => handleEditClick(item)} className="text-purple-400 hover:text-purple-300 font-medium text-xs flex items-center gap-1">
                        <Edit className="w-3 h-3" /> Update
                      </button>
                      <Link href={`/dashboard/sales/${item.id}/invoice`} className="text-primary hover:text-primary/80 font-medium text-xs flex items-center gap-1">
                        Invoice
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
      
      {/* Modal Edit */}
      {editingOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-background border border-white/10 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="p-4 border-b border-white/10 flex justify-between items-center bg-white/5">
              <h3 className="font-bold text-foreground">Riwayat & Tambah Pembayaran</h3>
              <button onClick={closeEditModal} className="text-foreground/50 hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              <div className="bg-primary/10 border border-primary/20 p-3 rounded-xl text-sm mb-4">
                <p className="text-foreground/80">Ref: <span className="font-bold text-primary">{editingOrder.invoice_number}</span></p>
                <p className="text-foreground/80">Pelanggan: <span className="font-bold text-foreground">{editingOrder.customers?.name}</span></p>
                <p className="text-foreground/80 mt-2">Total Invoice: <span className="font-bold">Rp {Number(editingOrder.total_amount || 0).toLocaleString('id-ID')}</span></p>
                <p className="text-foreground/80">Telah Dibayar: <span className="font-bold text-green-400">Rp {Number(editingOrder.dp_amount || 0).toLocaleString('id-ID')}</span></p>
                <p className="text-foreground/80">Sisa Tagihan: <span className="font-bold text-orange-400">Rp {Math.max(0, Number(editingOrder.total_amount || 0) - Number(editingOrder.dp_amount || 0)).toLocaleString('id-ID')}</span></p>
              </div>

              {/* History Pembayaran */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground/80 flex items-center gap-2"><Clock className="w-4 h-4" /> Riwayat Pembayaran</label>
                {isLoadingHistory ? (
                  <p className="text-xs text-foreground/40">Memuat riwayat...</p>
                ) : paymentHistory.length === 0 ? (
                  <p className="text-xs text-foreground/40 italic">Belum ada pembayaran sama sekali.</p>
                ) : (
                  <div className="space-y-2">
                    {paymentHistory.map(trx => (
                      <div key={trx.id} className="flex justify-between items-center p-2 rounded-lg bg-white/5 border border-white/10 text-xs">
                        <div>
                          <p className="font-semibold text-foreground/90">{new Date(trx.date).toLocaleDateString('id-ID')}</p>
                          <p className="text-foreground/60">{trx.payment_method}</p>
                        </div>
                        <p className="font-bold text-green-400">+ Rp {Number(trx.amount_in).toLocaleString('id-ID')}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Tambah Pembayaran Baru */}
              {editingOrder.payment_status !== 'LUNAS' && (
                <div className="mt-6 pt-4 border-t border-white/10 space-y-4">
                  <h4 className="text-sm font-bold text-foreground">Tambah Pembayaran Baru</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs text-foreground/60">Tanggal</label>
                      <CustomDatePicker value={newPaymentDate} onChange={setNewPaymentDate} className="!h-10" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-foreground/60">Metode Pembayaran</label>
                      <CustomSelect 
                        value={newPaymentMethod} 
                        onChange={e => setNewPaymentMethod(e.target.value)} 
                        options={(dropdownConfig.payment_method || ["BCA", "MANDIRI", "CASH"]).map(method => ({
                          value: method,
                          label: method
                        }))}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-foreground/80">Nominal Pembayaran Baru (Rp)</label>
                    <input 
                      type="number" 
                      value={newPaymentAmount} 
                      onChange={e => setNewPaymentAmount(e.target.value)} 
                      placeholder="Masukkan nominal..."
                      className="glass-input w-full h-10" 
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-white/10 flex justify-end gap-3 bg-white/5">
              <button onClick={closeEditModal} className="btn-secondary px-4 h-10 text-sm">Batal</button>
              {editingOrder.payment_status !== 'LUNAS' && (
                <button onClick={handleSaveEdit} disabled={isSaving} className="btn-primary px-4 h-10 text-sm flex items-center gap-2">
                  <Save className="w-4 h-4" /> {isSaving ? 'Menyimpan...' : 'Simpan Pembayaran'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
