'use client'

import { useState } from 'react'
import { createPortal } from 'react-dom'
import { Plus, CheckCircle2, X, Loader2, Trash2, Pencil, ArrowUpDown, ChevronUp, ChevronDown } from 'lucide-react'
import { createLoans, deleteLoan, updateLoan } from './actions'
import CustomSelect from '@/components/CustomSelect'
import CustomDatePicker from '@/components/CustomDatePicker'

const getTodayInJakarta = () => {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())
  const part = type => parts.find(item => item.type === type)?.value
  return `${part('year')}-${part('month')}-${part('day')}`
}

const getDateInputValue = value => {
  if (!value) return getTodayInJakarta()
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(value))
  const part = type => parts.find(item => item.type === type)?.value
  return `${part('year')}-${part('month')}-${part('day')}`
}

const createEmptyEntry = paymentMethod => ({
  employee_id: '',
  type: 'KASBON',
  amount: '',
  date: getTodayInJakarta(),
  tenor_weeks: 1,
  payment_method: paymentMethod,
  notes: '',
})

export default function LoansClient({ employees = [], initialLoans = [], error = null, dropdownConfig = {} }) {
  const [loans, setLoans] = useState(initialLoans)
  const [showModal, setShowModal] = useState(false)
  const [loading, setLoading] = useState(false)
  const [editingLoanId, setEditingLoanId] = useState(null)
  const [formEntries, setFormEntries] = useState([])
  const [sortConfig, setSortConfig] = useState({ key: 'date', direction: 'desc' })
  const paymentMethods = dropdownConfig.payment_method || ['BCA', 'MANDIRI', 'CASH']

  const handleAddNew = () => {
    setEditingLoanId(null)
    setFormEntries([createEmptyEntry('Cash')])
    setShowModal(true)
  }

  const handleEdit = item => {
    setEditingLoanId(item.id)
    setFormEntries([{
      employee_id: item.employee_id,
      type: item.type,
      amount: String(item.amount ?? ''),
      date: getDateInputValue(item.disbursed_date || item.created_at),
      tenor_weeks: item.tenor_weeks || 1,
      payment_method: 'Cash',
      notes: item.notes || '',
    }])
    setShowModal(true)
  }

  const updateEntry = (index, field, value) => {
    setFormEntries(current => current.map((entry, entryIndex) => (
      entryIndex === index ? { ...entry, [field]: value } : entry
    )))
  }

  const addEntry = () => setFormEntries(current => [...current, createEmptyEntry('Cash')])

  const removeEntry = index => setFormEntries(current => current.filter((_, entryIndex) => entryIndex !== index))

  const handleSave = async () => {
    if (!formEntries.length || formEntries.some(entry => !entry.employee_id || !entry.amount || !entry.date)) {
      return alert('Tanggal, karyawan, dan nominal wajib diisi untuk setiap pengajuan.')
    }

    setLoading(true)
    try {
      const payloads = formEntries.map(entry => ({
        ...entry,
        amount: Number(String(entry.amount).replace(/[^0-9]/g, '')),
      }))
      const result = editingLoanId
        ? await updateLoan(editingLoanId, payloads[0])
        : await createLoans(payloads)

      if (result.success) {
        alert(editingLoanId
          ? 'Data kasbon/pinjaman dan Buku Besar berhasil diperbarui.'
          : `${result.createdCount || payloads.length} pengajuan berhasil disimpan dan dicatat di Buku Besar.`)
        setShowModal(false)
        window.location.reload()
      } else {
        alert('Gagal menyimpan: ' + result.error)
      }
    } catch (err) {
      alert('Terjadi kesalahan: ' + (err?.message || 'silakan coba lagi.'))
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id) => {
    if (confirm('Yakin ingin menghapus data ini? Peringatan: Penghapusan ini tidak akan mengembalikan uang di Buku Besar secara otomatis.')) {
      const res = await deleteLoan(id)
      if (res.success) {
        setLoans(loans.filter(l => l.id !== id))
      } else {
        alert('Gagal menghapus: ' + res.error)
      }
    }
  }

  const formatRp = (val) => {
    if (!val) return ''
    const num = val.toString().replace(/[^0-9]/g, '')
    return Number(num).toLocaleString('id-ID', { maximumFractionDigits: 0 })
  }

  const displayDate = value => new Date(value).toLocaleDateString('id-ID', { timeZone: 'Asia/Jakarta' })
  const collator = new Intl.Collator('id', { numeric: true, sensitivity: 'base' })
  const sortedLoans = [...loans].sort((left, right) => {
    let comparison = 0
    if (sortConfig.key === 'date') {
      comparison = new Date(left.disbursed_date || left.created_at).getTime() - new Date(right.disbursed_date || right.created_at).getTime()
    } else if (sortConfig.key === 'employee') {
      comparison = collator.compare(left.employees?.full_name || '', right.employees?.full_name || '')
    } else if (sortConfig.key === 'type' || sortConfig.key === 'status') {
      comparison = collator.compare(String(left[sortConfig.key] || ''), String(right[sortConfig.key] || ''))
    } else if (sortConfig.key === 'amount') {
      comparison = Number(left.amount) - Number(right.amount)
    } else if (sortConfig.key === 'remaining') {
      comparison = Number(left.remaining_amount) - Number(right.remaining_amount)
    }
    return sortConfig.direction === 'asc' ? comparison : -comparison
  })

  const sortHeader = (label, key) => (
    <th scope="col" aria-sort={sortConfig.key === key ? (sortConfig.direction === 'asc' ? 'ascending' : 'descending') : 'none'} className="px-6 py-4 font-medium">
      <button
        type="button"
        onClick={() => setSortConfig(current => ({
          key,
          direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc',
        }))}
        className="inline-flex items-center gap-1.5 text-left hover:text-foreground transition-colors"
      >
        {label}
        {sortConfig.key === key
          ? (sortConfig.direction === 'asc' ? <ChevronUp className="w-3.5 h-3.5 shrink-0" /> : <ChevronDown className="w-3.5 h-3.5 shrink-0" />)
          : <ArrowUpDown className="w-3.5 h-3.5 shrink-0 opacity-50" />}
      </button>
    </th>
  )

  return (
    <div className="space-y-4 animate-in fade-in zoom-in-95 duration-500 pb-12">
      <div className="flex justify-end">
        <button onClick={handleAddNew} className="btn-primary h-10 px-4 flex items-center gap-2 text-sm">
          <Plus className="w-4 h-4" /> Tambah Baru
        </button>
      </div>

      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm text-left">
            <thead className="bg-white/5 border-b border-white/10 text-foreground/70 uppercase text-xs">
              <tr>
                {sortHeader('Tanggal', 'date')}
                {sortHeader('Nama Karyawan', 'employee')}
                {sortHeader('Jenis', 'type')}
                {sortHeader('Nominal Pinjaman', 'amount')}
                {sortHeader('Sisa Hutang', 'remaining')}
                {sortHeader('Status', 'status')}
                <th className="px-6 py-4 font-medium text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {error ? (
                <tr><td colSpan="7" className="px-6 py-8 text-center text-red-400">Gagal memuat data.</td></tr>
              ) : loans.length === 0 ? (
                <tr><td colSpan="7" className="px-6 py-12 text-center text-foreground/40">Belum ada data kasbon/pinjaman.</td></tr>
              ) : sortedLoans.map((item) => (
                <tr
                  key={item.id}
                  onClick={() => handleEdit(item)}
                  onKeyDown={event => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      handleEdit(item)
                    }
                  }}
                  tabIndex={0}
                  aria-label={`Edit ${item.type} ${item.employees?.full_name || ''}`}
                  className="hover:bg-white/5 transition-colors cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
                >
                  <td className="px-6 py-4 text-foreground/80">{displayDate(item.disbursed_date || item.created_at)}</td>
                  <td className="px-6 py-4 text-foreground/90 font-bold">{item.employees?.full_name}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${item.type === 'KASBON' ? 'bg-orange-500/20 text-orange-400' : 'bg-blue-500/20 text-blue-400'}`}>
                      {item.type}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-foreground/80 font-medium">Rp {item.amount.toLocaleString('id-ID', { maximumFractionDigits: 0 })}</td>
                  <td className="px-6 py-4 text-red-400 font-bold">Rp {item.remaining_amount.toLocaleString('id-ID', { maximumFractionDigits: 0 })}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-full text-[10px] font-bold whitespace-nowrap ${item.status === 'LUNAS' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                      {item.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right whitespace-nowrap">
                    <button
                      onClick={event => { event.stopPropagation(); handleEdit(item) }}
                      aria-label="Edit pengajuan"
                      className="p-2 text-foreground/70 hover:text-primary hover:bg-white/5 rounded-lg transition-colors"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={event => { event.stopPropagation(); handleDelete(item.id) }}
                      onKeyDown={event => event.stopPropagation()}
                      aria-label="Hapus pengajuan"
                      className="p-2 text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onMouseDown={event => event.target === event.currentTarget && setShowModal(false)}>
          <div className="bg-background border border-white/10 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="p-4 border-b border-white/10 bg-white/5 flex justify-between items-center shrink-0">
              <h3 className="font-bold text-foreground">{editingLoanId ? 'Edit Kasbon / Pinjaman' : 'Ajukan Kasbon / Pinjaman'}</h3>
              <button onClick={() => setShowModal(false)} className="text-foreground/50 hover:text-white"><X className="w-5 h-5" /></button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto">
              {!editingLoanId && (
                <div className="flex justify-end">
                  <button type="button" onClick={addEntry} className="btn-secondary h-9 px-3 flex items-center gap-2 text-sm">
                    <Plus className="w-4 h-4" /> Tambah Pengajuan
                  </button>
                </div>
              )}

              {formEntries.map((entry, index) => (
                <section key={index} className="rounded-xl border border-white/10 p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold text-foreground">{editingLoanId ? 'Data Pengajuan' : `Pengajuan ${index + 1}`}</h4>
                    {!editingLoanId && formEntries.length > 1 && (
                      <button type="button" onClick={() => removeEntry(index)} className="text-red-400 hover:bg-red-400/10 rounded-lg p-2" aria-label={`Hapus pengajuan ${index + 1}`}>
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-foreground/80 mb-1 block">Nama Karyawan</label>
                      <CustomSelect
                        value={entry.employee_id}
                        menuZIndex={10010}
                        onChange={event => updateEntry(index, 'employee_id', event.target.value)}
                        options={[
                          { value: '', label: '- Pilih Karyawan -' },
                          ...employees.map(employee => ({ value: employee.id, label: employee.full_name })),
                        ]}
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-medium text-foreground/80 mb-1 block">Jenis Pengajuan</label>
                      <CustomSelect
                        value={entry.type}
                        menuZIndex={10010}
                        onChange={event => updateEntry(index, 'type', event.target.value)}
                        options={[
                          { value: 'KASBON', label: 'Kasbon (Potong Lunas Minggu Ini - Dari Kas KING)' },
                          { value: 'PINJAMAN', label: 'Pinjaman (Dicicil - Dari TABUNGAN)' },
                        ]}
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-medium text-foreground/80">Tanggal Pengajuan</label>
                      <CustomDatePicker value={entry.date} onChange={value => updateEntry(index, 'date', value)} menuZIndex={10010} />
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-medium text-foreground/80">Nominal (Rp)</label>
                      <input type="text" value={formatRp(entry.amount)} onChange={event => updateEntry(index, 'amount', event.target.value)} placeholder="0" className="glass-input w-full" />
                    </div>

                    {!editingLoanId && (
                      <div className="space-y-2">
                        <label className="text-xs font-medium text-foreground/80 mb-1 block">Metode Pembayaran</label>
                        <CustomSelect
                          value={entry.payment_method}
                          menuZIndex={10010}
                          onChange={event => updateEntry(index, 'payment_method', event.target.value)}
                          options={[
                            ...(!paymentMethods.includes(entry.payment_method) ? [{ value: entry.payment_method, label: entry.payment_method }] : []),
                            ...paymentMethods.map(method => ({ value: method, label: method })),
                          ]}
                        />
                      </div>
                    )}

                    {entry.type === 'PINJAMAN' && (
                      <div className="space-y-2">
                        <label className="text-xs font-medium text-foreground/80">Tenor (Berapa Minggu Cicilan)</label>
                        <input type="number" min="1" value={entry.tenor_weeks} onChange={event => updateEntry(index, 'tenor_weeks', parseInt(event.target.value, 10) || 1)} className="glass-input w-full" />
                        <p className="text-[10px] text-yellow-400">Cicilan per minggu: Rp {Math.ceil(Number(String(entry.amount).replace(/[^0-9]/g, '')) / entry.tenor_weeks || 0).toLocaleString('id-ID', { maximumFractionDigits: 0 })}</p>
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-medium text-foreground/80">Catatan/Keterangan</label>
                    <textarea value={entry.notes} onChange={event => updateEntry(index, 'notes', event.target.value)} placeholder="Misal: Untuk biaya sekolah anak..." className="glass-input w-full min-h-[60px]" />
                  </div>
                </section>
              ))}
            </div>

            <div className="p-4 border-t border-white/10 flex justify-end gap-3 bg-white/5 shrink-0">
              <button onClick={() => setShowModal(false)} className="btn-secondary px-4 h-10 text-sm">Batal</button>
              <button disabled={loading} onClick={handleSave} className="btn-primary px-4 h-10 text-sm flex items-center gap-2 disabled:opacity-50">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                {editingLoanId ? 'Simpan Perubahan' : `Simpan ${formEntries.length} Pengajuan`}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
