'use client'

import { useState } from 'react'
import { Plus, CheckCircle2, Wallet, X, Loader2, Trash2 } from 'lucide-react'
import { createLoan, deleteLoan } from './actions'
import CustomSelect from '@/components/CustomSelect'

export default function LoansClient({ employees = [], initialLoans = [], error }) {
  const [loans, setLoans] = useState(initialLoans)
  const [showModal, setShowModal] = useState(false)
  const [loading, setLoading] = useState(false)

  // Form State
  const [formData, setFormData] = useState({
    employee_id: '',
    type: 'KASBON',
    amount: '',
    tenor_weeks: 1,
    payment_method: 'Cash',
    notes: ''
  })

  const handleAddNew = () => {
    setFormData({ employee_id: '', type: 'KASBON', amount: '', tenor_weeks: 1, payment_method: 'Cash', notes: '' })
    setShowModal(true)
  }

  const handleSave = async () => {
    if (!formData.employee_id || !formData.amount) return alert('Karyawan dan Nominal wajib diisi.')
    
    setLoading(true)
    try {
      const payload = {
        ...formData,
        amount: Number(formData.amount.replace(/[^0-9]/g, ''))
      }
      const res = await createLoan(payload)
      if (res.success) {
        alert('Data berhasil disimpan dan tercatat di Buku Besar.')
        window.location.reload()
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
    return Number(num).toLocaleString('id-ID')
  }

  return (
    <div className="space-y-6 animate-in fade-in zoom-in-95 duration-500 pb-20">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Wallet className="w-6 h-6 text-purple-400" />
            Kasbon & Pinjaman
          </h1>
          <p className="text-sm text-foreground/60 mt-1">Kelola hutang karyawan. Pencairan akan otomatis mengurangi Buku Besar/Tabungan.</p>
        </div>
        <button onClick={handleAddNew} className="btn-primary h-10 px-4 flex items-center gap-2 text-sm">
          <Plus className="w-4 h-4" /> Tambah Baru
        </button>
      </header>

      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-white/5 border-b border-white/10 text-foreground/70 uppercase text-xs">
              <tr>
                <th className="px-6 py-4 font-medium">Tanggal</th>
                <th className="px-6 py-4 font-medium">Nama Karyawan</th>
                <th className="px-6 py-4 font-medium">Jenis</th>
                <th className="px-6 py-4 font-medium">Nominal Pinjaman</th>
                <th className="px-6 py-4 font-medium">Sisa Hutang</th>
                <th className="px-6 py-4 font-medium">Status</th>
                <th className="px-6 py-4 font-medium text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {error ? (
                <tr><td colSpan="7" className="px-6 py-8 text-center text-red-400">Gagal memuat data.</td></tr>
              ) : loans.length === 0 ? (
                <tr><td colSpan="7" className="px-6 py-12 text-center text-foreground/40">Belum ada data kasbon/pinjaman.</td></tr>
              ) : loans.map((item) => (
                <tr key={item.id} className="hover:bg-white/5 transition-colors">
                  <td className="px-6 py-4 text-foreground/80">{new Date(item.created_at).toLocaleDateString('id-ID')}</td>
                  <td className="px-6 py-4 text-foreground/90 font-bold">{item.employees?.full_name}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${item.type === 'KASBON' ? 'bg-orange-500/20 text-orange-400' : 'bg-blue-500/20 text-blue-400'}`}>
                      {item.type}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-foreground/80 font-medium">Rp {item.amount.toLocaleString('id-ID')}</td>
                  <td className="px-6 py-4 text-red-400 font-bold">Rp {item.remaining_amount.toLocaleString('id-ID')}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${item.status === 'LUNAS' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                      {item.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button onClick={() => handleDelete(item.id)} className="p-2 text-red-400 hover:bg-red-400/10 rounded-lg transition-colors">
                      <Trash2 className="w-4 h-4" />
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
            <div className="p-4 border-b border-white/10 bg-white/5 flex justify-between items-center">
              <h3 className="font-bold text-foreground">Ajukan Kasbon / Pinjaman</h3>
              <button onClick={() => setShowModal(false)} className="text-foreground/50 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            
            <div className="p-6 space-y-4">
              <div className="space-y-2">
                <CustomSelect 
                  value={formData.employee_id} 
                  onChange={e => setFormData({...formData, employee_id: e.target.value})} 
                  options={[
                    { value: "", label: "- Pilih Karyawan -" },
                    ...employees.map(emp => ({ value: emp.id, label: emp.full_name }))
                  ]}
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-foreground/80 mb-1 block">Jenis Pengajuan</label>
                <CustomSelect 
                  value={formData.type} 
                  onChange={e => setFormData({...formData, type: e.target.value})} 
                  options={[
                    { value: "KASBON", label: "Kasbon (Potong Lunas Minggu Ini - Dari Kas KING)" },
                    { value: "PINJAMAN", label: "Pinjaman (Dicicil - Dari TABUNGAN)" }
                  ]}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-medium text-foreground/80">Nominal (Rp)</label>
                  <input type="text" value={formatRp(formData.amount)} onChange={e => setFormData({...formData, amount: e.target.value})} placeholder="0" className="glass-input w-full" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-foreground/80 mb-1 block">Metode Pembayaran</label>
                  <CustomSelect 
                    value={formData.payment_method} 
                    onChange={e => setFormData({...formData, payment_method: e.target.value})} 
                    options={[
                      { value: "Cash", label: "Cash" },
                      { value: "BCA", label: "BCA" },
                      { value: "Mandiri", label: "Mandiri" }
                    ]}
                  />
                </div>
              </div>

              {formData.type === 'PINJAMAN' && (
                <div className="space-y-2 animate-in fade-in">
                  <label className="text-xs font-medium text-foreground/80">Tenor (Berapa Minggu Cicilan)</label>
                  <input type="number" min="1" value={formData.tenor_weeks} onChange={e => setFormData({...formData, tenor_weeks: parseInt(e.target.value) || 1})} className="glass-input w-full" />
                  <p className="text-[10px] text-yellow-400">Cicilan per minggu: Rp {Math.ceil(Number(formData.amount.replace(/[^0-9]/g, '')) / formData.tenor_weeks || 0).toLocaleString('id-ID')}</p>
                </div>
              )}

              <div className="space-y-2">
                <label className="text-xs font-medium text-foreground/80">Catatan/Keterangan</label>
                <textarea value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} placeholder="Misal: Untuk biaya sekolah anak..." className="glass-input w-full min-h-[60px]" />
              </div>
            </div>

            <div className="p-4 border-t border-white/10 flex justify-end gap-3 bg-white/5">
              <button onClick={() => setShowModal(false)} className="btn-secondary px-4 h-10 text-sm">Batal</button>
              <button disabled={loading} onClick={handleSave} className="btn-primary px-4 h-10 text-sm flex items-center gap-2 disabled:opacity-50">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} Simpan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
