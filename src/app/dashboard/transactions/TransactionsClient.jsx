'use client'

import { useState, useMemo } from 'react'
import { Search, Plus, BookOpen, ArrowDownRight, ArrowUpRight, Filter, ChevronUp, ChevronDown, Loader2 } from 'lucide-react'
import { createManualTransaction, updateTransaction, deleteTransaction } from './actions'
import MonthFilter from '@/components/MonthFilter'
import CustomSelect from '@/components/CustomSelect'
import CustomDatePicker from '@/components/CustomDatePicker'

export default function TransactionsClient({ transactions = [], dropdownConfig = {} }) {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editId, setEditId] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  // Tabs
  const [currentTab, setCurrentTab] = useState('UTAMA') // 'UTAMA' | 'VIRTUAL'

  // Filters
  const [filterMonth, setFilterMonth] = useState(() => new Date().toISOString().slice(0, 7))
  const [filterMethod, setFilterMethod] = useState('')
  const [filterWorkshop, setFilterWorkshop] = useState('')
  const [filterRef, setFilterRef] = useState('')

  // Sorting
  const [sortConfig, setSortConfig] = useState({ key: 'date', direction: 'desc' })

  // Dummy form state
  const [formType, setFormType] = useState('MASUK')
  const [formRef, setFormRef] = useState('LAIN-LAIN')
  const [formWorkshop, setFormWorkshop] = useState('KING')
  const [formPaymentMethod, setFormPaymentMethod] = useState('BCA')
  const [formAmount, setFormAmount] = useState('')
  const [formDesc, setFormDesc] = useState('')
  const [formDate, setFormDate] = useState('')

  const handleAddTransaction = () => {
    setEditId(null)
    setFormType('MASUK')
    setFormRef('LAIN-LAIN')
    setFormWorkshop('KING')
    setFormPaymentMethod('BCA')
    setFormAmount('')
    setFormDesc('')
    setFormDate(new Date().toISOString().split('T')[0])
    setIsModalOpen(true)
  }

  const handleEditTransaction = (trx) => {
    setEditId(trx.id)
    setFormType(trx.amount_in > 0 ? 'MASUK' : 'KELUAR')
    setFormRef(trx.reference || 'LAIN-LAIN')
    setFormWorkshop(trx.workshop_code || 'KING')
    setFormPaymentMethod(trx.payment_method || 'BCA')
    setFormAmount(trx.amount_in > 0 ? trx.amount_in : trx.amount_out)
    setFormDesc(trx.description || '')
    setFormDate(trx.date || new Date().toISOString().split('T')[0])
    setIsModalOpen(true)
  }

  const handleDeleteTransaction = async (id) => {
    if (confirm('Yakin ingin menghapus transaksi ini? (Akan mengubah rekap saldo)')) {
      const res = await deleteTransaction(id)
      if (res.success) {
        alert('Transaksi berhasil dihapus!')
      } else {
        alert('Gagal menghapus: ' + res.error)
      }
    }
  }
  const handleSubmit = async () => {
    if (!formAmount || Number(formAmount) <= 0) return alert('Masukkan nominal yang valid!')
    if (!formDesc) return alert('Deskripsi tidak boleh kosong!')
    
    setIsSubmitting(true)
    try {
      const payload = {
        date: formDate,
        type: formType,
        reference: formRef,
        workshop_code: formWorkshop,
        payment_method: formPaymentMethod,
        amount: Number(formAmount),
        description: formDesc
      }
      
      let res;
      if (editId) {
        res = await updateTransaction(editId, payload)
      } else {
        res = await createManualTransaction(payload)
      }

      if (res.success) {
        alert(editId ? 'Transaksi berhasil diperbarui!' : 'Transaksi berhasil ditambahkan!')
        setIsModalOpen(false)
        setFormAmount('')
        setFormDesc('')
      } else {
        alert('Gagal menambahkan transaksi: ' + res.error)
      }
    } catch (err) {
      alert('Terjadi kesalahan')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSort = (key) => {
    let direction = 'asc'
    if (sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc'
    setSortConfig({ key, direction })
  }

  // Generate unique filter options
  const currentMonthStr = new Date().toISOString().slice(0, 7)
  const monthsSet = new Set(transactions.map(t => new Date(t.date).toISOString().slice(0, 7)))
  monthsSet.add(currentMonthStr)
  const months = [...monthsSet].sort().reverse()
  const methods = [...new Set(transactions.map(t => (t.payment_method || '').toUpperCase()).filter(Boolean))]
  const workshops = [...new Set(transactions.map(t => (t.workshop_code || '').toUpperCase()).filter(Boolean))]
  const refs = [...new Set(transactions.map(t => (t.reference || '').toUpperCase()).filter(Boolean))]

  const filteredAndSorted = useMemo(() => {
    let result = transactions.filter(trx => {
      // Tab Filtering
      const methodUpper = (trx.payment_method || '').toUpperCase()
      if (currentTab === 'UTAMA') {
        if (methodUpper === 'VIRTUAL') return false
      } else if (currentTab === 'VIRTUAL') {
        if (methodUpper !== 'VIRTUAL') return false
      }

      const matchSearch = ((trx.description || '').toLowerCase().includes(searchQuery.toLowerCase())) || 
                          ((trx.reference || '').toLowerCase().includes(searchQuery.toLowerCase())) ||
                          ((trx.workshop_code || '').toLowerCase().includes(searchQuery.toLowerCase()))
      
      const matchMonth = filterMonth ? new Date(trx.date).toISOString().slice(0, 7) === filterMonth : true
      const matchMethod = filterMethod ? methodUpper === filterMethod.toUpperCase() : true
      const matchWorkshop = filterWorkshop ? (trx.workshop_code || '').toUpperCase() === filterWorkshop.toUpperCase() : true
      const matchRef = filterRef ? (trx.reference || '').toUpperCase() === filterRef.toUpperCase() : true

      return matchSearch && matchMonth && matchMethod && matchWorkshop && matchRef
    })

    result.sort((a, b) => {
      if (a[sortConfig.key] < b[sortConfig.key]) return sortConfig.direction === 'asc' ? -1 : 1
      if (a[sortConfig.key] > b[sortConfig.key]) return sortConfig.direction === 'asc' ? 1 : -1
      return 0
    })

    return result
  }, [transactions, searchQuery, filterMonth, filterMethod, filterWorkshop, filterRef, sortConfig, currentTab])

  const totalIn = filteredAndSorted.reduce((acc, curr) => acc + Number(curr.amount_in || 0), 0)
  const totalOut = filteredAndSorted.reduce((acc, curr) => acc + Number(curr.amount_out || 0), 0)
  const saldo = totalIn - totalOut

  const renderSortIcon = (key) => {
    if (sortConfig.key !== key) return null
    return sortConfig.direction === 'asc' ? <ChevronUp className="w-3 h-3 inline ml-1" /> : <ChevronDown className="w-3 h-3 inline ml-1" />
  }

  return (
    <div className="space-y-6 animate-in fade-in zoom-in-95 duration-500">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-primary" />
            Buku Besar / Transaksi
          </h1>
          <p className="text-sm text-foreground/60 mt-1">Kelola mutasi kas masuk dan keluar seluruh workshop.</p>
        </div>
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="flex gap-2 w-full sm:w-auto">
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-foreground/40" />
              <input 
                type="text" 
                placeholder="Cari transaksi..." 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="glass-input !pl-10 h-10 w-full text-sm"
              />
            </div>
            <div className="hidden sm:block">
              <MonthFilter value={filterMonth} onChange={setFilterMonth} />
            </div>
            <button onClick={() => setShowFilters(!showFilters)} className={`btn-secondary h-10 px-4 flex items-center gap-2 text-sm ${showFilters ? 'bg-white/10' : ''}`}>
              <Filter className="w-4 h-4" /> Filter
            </button>
          </div>
          <button onClick={handleAddTransaction} className="btn-primary h-10 px-4 flex items-center gap-2 text-sm whitespace-nowrap">
            <Plus className="w-4 h-4" /> Tambah Manual
          </button>
        </div>
      </header>

      {/* Tabs */}
      <div className="flex items-center gap-4 border-b border-white/10 pb-2">
        <button 
          onClick={() => setCurrentTab('UTAMA')} 
          className={`pb-2 px-2 text-sm font-bold transition-colors ${currentTab === 'UTAMA' ? 'text-primary border-b-2 border-primary' : 'text-foreground/50 hover:text-foreground'}`}
        >
          Kas Utama
        </button>
        <button 
          onClick={() => setCurrentTab('VIRTUAL')} 
          className={`pb-2 px-2 text-sm font-bold transition-colors ${currentTab === 'VIRTUAL' ? 'text-primary border-b-2 border-primary' : 'text-foreground/50 hover:text-foreground'}`}
        >
          Mutasi Virtual (HPP)
        </button>
      </div>

      {showFilters && (
        <div className="glass-card p-4 grid grid-cols-1 sm:grid-cols-4 gap-4 animate-in fade-in slide-in-from-top-2 relative z-50">
          <div className="block sm:hidden space-y-1">
             <label className="text-xs text-foreground/60 block">Periode</label>
             <MonthFilter value={filterMonth} onChange={setFilterMonth} />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-foreground/60 block">Metode</label>
            <CustomSelect 
              value={filterMethod} 
              onChange={e => setFilterMethod(e.target.value)} 
              options={[
                { value: "", label: "- Semua Metode -" },
                ...methods.map(m => ({ value: m, label: m }))
              ]}
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-foreground/60 block">Workshop</label>
            <CustomSelect 
              value={filterWorkshop} 
              onChange={e => setFilterWorkshop(e.target.value)} 
              options={[
                { value: "", label: "- Semua Workshop -" },
                ...workshops.map(w => ({ value: w, label: w }))
              ]}
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-foreground/60 block">Referensi</label>
            <CustomSelect 
              value={filterRef} 
              onChange={e => setFilterRef(e.target.value)} 
              options={[
                { value: "", label: "- Semua Referensi -" },
                ...refs.map(r => ({ value: r, label: r }))
              ]}
            />
          </div>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="glass-card p-4 flex items-center gap-4 border-l-4 border-green-500">
          <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center text-green-500">
            <ArrowDownRight className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm text-foreground/60">Total Pemasukan</p>
            <p className="text-2xl font-bold text-foreground">Rp {totalIn.toLocaleString('id-ID')}</p>
          </div>
        </div>
        <div className="glass-card p-4 flex items-center gap-4 border-l-4 border-red-500">
          <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center text-red-500">
            <ArrowUpRight className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm text-foreground/60">Total Pengeluaran</p>
            <p className="text-2xl font-bold text-foreground">Rp {totalOut.toLocaleString('id-ID')}</p>
          </div>
        </div>
        <div className="glass-card p-4 flex items-center gap-4 border-l-4 border-primary">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
            <BookOpen className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm text-foreground/60">Saldo Bersih</p>
            <p className="text-2xl font-bold text-primary">Rp {saldo.toLocaleString('id-ID')}</p>
          </div>
        </div>
      </div>

      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-white/5 border-b border-white/10 text-foreground/70 uppercase text-xs">
              <tr>
                <th className="px-6 py-4 font-medium cursor-pointer hover:text-white" onClick={() => handleSort('date')}>Tanggal {renderSortIcon('date')}</th>
                <th className="px-6 py-4 font-medium cursor-pointer hover:text-white" onClick={() => handleSort('description')}>Keterangan {renderSortIcon('description')}</th>
                <th className="px-6 py-4 font-medium cursor-pointer hover:text-white" onClick={() => handleSort('reference')}>Referensi {renderSortIcon('reference')}</th>
                <th className="px-6 py-4 font-medium cursor-pointer hover:text-white" onClick={() => handleSort('workshop_code')}>Workshop {renderSortIcon('workshop_code')}</th>
                <th className="px-6 py-4 font-medium cursor-pointer hover:text-white" onClick={() => handleSort('payment_method')}>Metode {renderSortIcon('payment_method')}</th>
                <th className="px-6 py-4 font-medium text-right cursor-pointer hover:text-white" onClick={() => handleSort('amount_out')}>Kas Keluar {renderSortIcon('amount_out')}</th>
                <th className="px-6 py-4 font-medium text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredAndSorted.length === 0 ? (
                 <tr>
                    <td colSpan="8" className="px-6 py-12 text-center text-foreground/40">Belum ada data transaksi.</td>
                 </tr>
              ) : filteredAndSorted.map((trx) => (
                <tr key={trx.id} className="hover:bg-white/5 transition-colors">
                  <td className="px-6 py-4 text-foreground/80">{new Date(trx.date).toLocaleDateString('id-ID')}</td>
                  <td className="px-6 py-4 font-medium text-foreground/90">
                    {trx.description && trx.description !== '-' 
                      ? trx.description 
                      : (trx.sales_orders ? `Pesanan: ${trx.sales_orders.customers?.name || 'Unknown'} (${trx.sales_orders.invoice_number})` : (trx.reference || '-'))}
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-2 py-1 rounded text-[10px] font-bold border border-white/10 bg-white/5 text-foreground/60">
                      {trx.reference || '-'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-foreground/80">{trx.workshop_code || '-'}</td>
                  <td className="px-6 py-4 text-foreground/80">{trx.payment_method || '-'}</td>
                  <td className="px-6 py-4 text-right font-medium text-green-400">
                    {trx.amount_in > 0 ? `+ Rp ${Number(trx.amount_in).toLocaleString('id-ID')}` : '-'}
                  </td>
                  <td className="px-6 py-4 text-right font-medium text-red-400">
                    {trx.amount_out > 0 ? `- Rp ${Number(trx.amount_out).toLocaleString('id-ID')}` : '-'}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button onClick={() => handleEditTransaction(trx)} className="text-accent hover:text-accent/80 font-medium text-xs mr-3">Edit</button>
                    <button onClick={() => handleDeleteTransaction(trx.id)} className="text-red-400 hover:text-red-300 font-medium text-xs">Hapus</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Input Transaksi */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-background border border-white/10 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="p-4 border-b border-white/10 bg-white/5">
              <h3 className="font-bold text-foreground">{editId ? 'Edit Transaksi' : 'Tambah Transaksi Manual'}</h3>
            </div>
            
            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-medium text-foreground/60 mb-1 block">Tanggal</label>
                  <CustomDatePicker value={formDate} onChange={setFormDate} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-foreground/60 block">Jenis Mutasi</label>
                  <CustomSelect 
                    value={formType} 
                    onChange={e => setFormType(e.target.value)} 
                    options={[
                      { value: "MASUK", label: "Pemasukan (+)" },
                      { value: "KELUAR", label: "Pengeluaran (-)" }
                    ]}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-foreground/60 block">Workshop / Rekening</label>
                  <CustomSelect 
                    value={formWorkshop} 
                    onChange={e => setFormWorkshop(e.target.value)} 
                    options={(dropdownConfig.kas_account || ["KING", "GLOBAL", "GUDANG", "TABUNGAN"]).map(acc => ({
                      value: acc,
                      label: acc
                    }))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs text-foreground/60 block">Metode Pembayaran</label>
                  <CustomSelect 
                    value={formPaymentMethod} 
                    onChange={e => setFormPaymentMethod(e.target.value)} 
                    options={(dropdownConfig.payment_method || ["BCA", "MANDIRI", "CASH"]).map(method => ({
                      value: method,
                      label: method
                    }))}
                  />
                </div>

                {formWorkshop === 'KING' ? (
                  <div className="space-y-1">
                    <label className="text-xs text-foreground/60 block">Referensi (Kategori)</label>
                    <CustomSelect 
                      value={formRef} 
                      onChange={e => setFormRef(e.target.value)} 
                      options={(dropdownConfig.transaction_reference || ["PENJUALAN", "PENGIRIMAN", "LISTRIK WIFI", "GAJI KARYAWAN", "MAINTENANCE", "NOTA", "LAIN-LAIN"]).map(ref => ({
                        value: ref,
                        label: ref
                      }))}
                    />
                  </div>
                ) : (
                  <div className="space-y-1 opacity-50 pointer-events-none">
                    <label className="text-xs text-foreground/60 block">Referensi (Kategori)</label>
                    <CustomSelect 
                      value="-" 
                      onChange={() => {}} 
                      options={[{ value: "-", label: "-" }]}
                    />
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-foreground/80">Nominal (Rp)</label>
                <input 
                  type="number" 
                  value={formAmount} 
                  onChange={e => setFormAmount(e.target.value)} 
                  placeholder="0"
                  className={`glass-input w-full text-lg font-bold ${formType === 'MASUK' ? 'text-green-400' : 'text-red-400'}`} 
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-foreground/80">Keterangan / Deskripsi</label>
                <textarea 
                  value={formDesc} 
                  onChange={e => setFormDesc(e.target.value)} 
                  className="glass-input w-full h-20" 
                  placeholder="Misal: Beli pulsa listrik workshop King..."
                />
              </div>
            </div>

            <div className="p-4 border-t border-white/10 flex justify-end gap-3 bg-white/5">
              <button onClick={() => setIsModalOpen(false)} className="btn-secondary px-4 h-10 text-sm" disabled={isSubmitting}>Batal</button>
              <button onClick={handleSubmit} className="btn-primary px-4 h-10 text-sm flex items-center gap-2" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Simpan Transaksi
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
