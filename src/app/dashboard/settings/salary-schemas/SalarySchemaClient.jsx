'use client'

import { useState } from 'react'
import { Plus, Edit2, Trash2, Save, X, Loader2 } from 'lucide-react'
import { saveSalarySchema, deleteSalarySchema } from './actions'

const parseRp = (val) => {
  if (!val) return 0;
  return Number(val.toString().replace(/[^0-9]/g, ''))
}

const formatRp = (val) => {
  if (!val) return '0';
  return val.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".")
}

export default function SalarySchemaClient({ initialSchemas }) {
  const [schemas, setSchemas] = useState(initialSchemas)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  
  const [formData, setFormData] = useState({
    id: '',
    role_name: '',
    bonus_mingguan: 0,
    rate_borongan_sendiri: 0,
    rate_produksi_bawahan: 0,
    batas_qty_bonus_harian: 0,
    bonus_harian_dibawah_target: 0,
    batas_qty_target_harian: 0,
    bonus_target_harian: 0,
    fee_2_warna: 0
  })

  const handleEdit = (schema) => {
    setFormData(schema)
    setIsModalOpen(true)
  }

  const handleAddNew = () => {
    setFormData({
      id: '',
      role_name: '',
      bonus_mingguan: 0,
      rate_borongan_sendiri: 0,
      rate_produksi_bawahan: 0,
      batas_qty_bonus_harian: 0,
      bonus_harian_dibawah_target: 0,
      batas_qty_target_harian: 0,
      bonus_target_harian: 0,
      fee_2_warna: 0
    })
    setIsModalOpen(true)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await saveSalarySchema(formData)
      if (res.success) {
        if (formData.id) {
          setSchemas(schemas.map(s => s.id === formData.id ? { ...formData } : s))
        } else {
          // just reload the page to get real ID
          window.location.reload()
        }
        setIsModalOpen(false)
      } else {
        alert(res.error)
      }
    } catch (err) {
      alert("Terjadi kesalahan.")
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id) => {
    if (confirm('Yakin ingin menghapus skema gaji ini?')) {
      const res = await deleteSalarySchema(id)
      if (res.success) {
        setSchemas(schemas.filter(s => s.id !== id))
      } else {
        alert("Gagal menghapus: " + res.error)
      }
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Skema Gaji (Jabatan)</h1>
          <p className="text-foreground/60 text-sm mt-1">Kelola komponen gaji untuk masing-masing jabatan.</p>
        </div>
        <button onClick={handleAddNew} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> Tambah Jabatan
        </button>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="text-xs uppercase bg-white/5 text-foreground/60">
            <tr>
              <th className="px-4 py-4 rounded-tl-xl">Jabatan</th>
              <th className="px-4 py-4">Bonus Mingguan</th>
              <th className="px-4 py-4">Borongan (Sendiri/Bawahan)</th>
              <th className="px-4 py-4">Bonus Harian & Lainnya</th>
              <th className="px-4 py-4 text-center rounded-tr-xl">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {schemas.map(schema => (
              <tr key={schema.id} className="hover:bg-white/5 transition-colors">
                <td className="px-4 py-4 font-bold text-primary">{schema.role_name}</td>
                <td className="px-4 py-4 text-xs">
                  {schema.bonus_mingguan > 0 ? `Rp ${schema.bonus_mingguan.toLocaleString('id-ID')}` : '-'}
                </td>
                <td className="px-4 py-4 text-xs text-foreground/80">
                  {schema.rate_borongan_sendiri > 0 && <div>Sendiri: Rp {schema.rate_borongan_sendiri.toLocaleString('id-ID')}</div>}
                  {schema.rate_produksi_bawahan > 0 && <div>Bawahan: Rp {schema.rate_produksi_bawahan.toLocaleString('id-ID')}</div>}
                  {schema.rate_borongan_sendiri === 0 && schema.rate_produksi_bawahan === 0 && <span className="text-foreground/40 italic">-</span>}
                </td>
                <td className="px-4 py-4 text-xs text-foreground/60">
                  {schema.bonus_harian_dibawah_target > 0 && <div>Bns Qty {'<'}{schema.batas_qty_bonus_harian}: Rp {schema.bonus_harian_dibawah_target.toLocaleString('id-ID')}</div>}
                  {schema.bonus_target_harian > 0 && <div>Bns Qty {'>'}={schema.batas_qty_target_harian}: Rp {schema.bonus_target_harian.toLocaleString('id-ID')}</div>}
                  {schema.fee_2_warna > 0 && <div>Fee 2 Warna: Rp {schema.fee_2_warna.toLocaleString('id-ID')}</div>}
                </td>
                <td className="px-4 py-4">
                  <div className="flex items-center justify-center gap-2">
                    <button onClick={() => handleEdit(schema)} className="p-2 text-blue-400 hover:bg-blue-400/10 rounded-lg transition-colors">
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDelete(schema.id)} className="p-2 text-red-400 hover:bg-red-400/10 rounded-lg transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {schemas.length === 0 && (
              <tr>
                <td colSpan={7} className="text-center py-8 text-foreground/40">Belum ada skema gaji.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-background border border-white/10 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="sticky top-0 bg-background/95 backdrop-blur-sm border-b border-white/10 px-6 py-4 flex justify-between items-center z-10">
              <h2 className="text-xl font-bold">{formData.id ? 'Edit' : 'Tambah'} Skema Gaji</h2>
              <button onClick={() => setIsModalOpen(false)} className="p-2 text-foreground/60 hover:text-white rounded-full hover:bg-white/10 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground/80">Nama Jabatan <span className="text-red-400">*</span></label>
                <input 
                  type="text" 
                  required
                  value={formData.role_name} 
                  onChange={e => setFormData({...formData, role_name: e.target.value})} 
                  className="glass-input w-full"
                  placeholder="Misal: Operator Mesin"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2 md:col-span-2">
                  <label className="text-xs font-medium text-foreground/80">Bonus Full Seminggu (Rp)</label>
                  <input type="text" value={formatRp(formData.bonus_mingguan)} onChange={e => setFormData({...formData, bonus_mingguan: parseRp(e.target.value)})} className="glass-input w-full" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-foreground/80">Rate Borongan Sendiri (Rp/Pcs)</label>
                  <input type="text" value={formatRp(formData.rate_borongan_sendiri)} onChange={e => setFormData({...formData, rate_borongan_sendiri: parseRp(e.target.value)})} className="glass-input w-full" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-foreground/80">Rate Produksi Bawahan (Rp/Pcs)</label>
                  <input type="text" value={formatRp(formData.rate_produksi_bawahan)} onChange={e => setFormData({...formData, rate_produksi_bawahan: parseRp(e.target.value)})} className="glass-input w-full" />
                </div>
                
                <div className="col-span-2 border-t border-white/10 my-2 pt-2">
                  <p className="text-xs font-bold text-foreground/80 mb-2">Target & Bonus Harian</p>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-medium text-foreground/80">Batas Qty Kurang Dari (Pcs)</label>
                  <input type="number" value={formData.batas_qty_bonus_harian} onChange={e => setFormData({...formData, batas_qty_bonus_harian: parseInt(e.target.value)||0})} className="glass-input w-full" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-foreground/80">Bonus Harian (Jika Qty Kurang) (Rp)</label>
                  <input type="text" value={formatRp(formData.bonus_harian_dibawah_target)} onChange={e => setFormData({...formData, bonus_harian_dibawah_target: parseRp(e.target.value)})} className="glass-input w-full" />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-medium text-foreground/80">Batas Qty Target (Pcs)</label>
                  <input type="number" value={formData.batas_qty_target_harian} onChange={e => setFormData({...formData, batas_qty_target_harian: parseInt(e.target.value)||0})} className="glass-input w-full" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-foreground/80">Bonus Target (Jika Qty Lebih) (Rp)</label>
                  <input type="text" value={formatRp(formData.bonus_target_harian)} onChange={e => setFormData({...formData, bonus_target_harian: parseRp(e.target.value)})} className="glass-input w-full" />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <label className="text-xs font-medium text-foreground/80">Fee Sablon 2 Warna (Rp)</label>
                  <input type="text" value={formatRp(formData.fee_2_warna)} onChange={e => setFormData({...formData, fee_2_warna: parseRp(e.target.value)})} className="glass-input w-full" />
                </div>
              </div>

              <div className="pt-4 border-t border-white/10 flex justify-end gap-3">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-sm font-medium text-white bg-white/5 hover:bg-white/10 rounded-xl transition-colors">
                  Batal
                </button>
                <button type="submit" disabled={loading} className="btn-primary flex items-center gap-2">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {loading ? 'Menyimpan...' : 'Simpan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
