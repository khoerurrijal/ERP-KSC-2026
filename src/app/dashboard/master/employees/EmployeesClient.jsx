'use client'

import { useState } from 'react'
import { Plus, Edit2, Trash2, Save, X, Loader2, CheckCircle2, XCircle } from 'lucide-react'
import { saveEmployee, deleteEmployee } from './actions'
import CustomSelect from '@/components/CustomSelect'

export default function EmployeesClient({ initialEmployees, schemas }) {
  const [employees, setEmployees] = useState(initialEmployees)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  
  const [formData, setFormData] = useState({
    id: '',
    username: '',
    password: '',
    full_name: '',
    salary_schema_id: '',
    supervisor_id: '',
    gaji_harian: 0,
    uang_makan: 0,
    is_active: true
  })

  // Find Operator Mesin Schema ID to conditionally show supervisor dropdown
  const operatorMesinSchema = schemas.find(s => s.role_name === 'Operator Mesin')
  const operatorSchema = schemas.find(s => s.role_name === 'Operator')
  const isOperator = formData.salary_schema_id === operatorSchema?.id
  const operatorMesinEmployees = employees.filter(e => e.salary_schema_id === operatorMesinSchema?.id)

  const handleEdit = (emp) => {
    setFormData({
      id: emp.id,
      username: emp.username,
      password: '', // Leave empty on edit
      full_name: emp.full_name,
      salary_schema_id: emp.salary_schema_id || '',
      supervisor_id: emp.supervisor_id || '',
      gaji_harian: emp.gaji_harian || 0,
      uang_makan: emp.uang_makan || 0,
      is_active: emp.is_active
    })
    setIsModalOpen(true)
  }

  const handleAddNew = () => {
    setFormData({
      id: '',
      username: '',
      password: '',
      full_name: '',
      salary_schema_id: '',
      supervisor_id: '',
      gaji_harian: 0,
      uang_makan: 0,
      is_active: true
    })
    setIsModalOpen(true)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!formData.id && !formData.password) {
      alert("Password wajib diisi untuk karyawan baru!")
      return
    }

    setLoading(true)
    try {
      const res = await saveEmployee(formData)
      if (res.success) {
        if (formData.id) {
          const selectedSchema = schemas.find(s => s.id === formData.salary_schema_id)
          setEmployees(employees.map(s => s.id === formData.id ? { 
            ...s, 
            full_name: formData.full_name,
            salary_schema_id: formData.salary_schema_id,
            supervisor_id: formData.supervisor_id,
            gaji_harian: formData.gaji_harian,
            uang_makan: formData.uang_makan,
            is_active: formData.is_active,
            salary_schemas: selectedSchema
          } : s))
        } else {
          // just reload the page to get real data and id
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
    if (confirm('Yakin ingin menghapus karyawan ini? Akses loginnya akan dinonaktifkan.')) {
      const res = await deleteEmployee(id)
      if (res.success) {
        setEmployees(employees.filter(s => s.id !== id))
      } else {
        alert("Gagal menghapus: " + res.error)
      }
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Data Karyawan</h1>
          <p className="text-foreground/60 text-sm mt-1">Kelola daftar karyawan, akses login, dan posisinya.</p>
        </div>
        <button onClick={handleAddNew} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> Tambah Karyawan
        </button>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="text-xs uppercase bg-white/5 text-foreground/60">
            <tr>
              <th className="px-4 py-4 rounded-tl-xl">Nama Lengkap</th>
              <th className="px-4 py-4">Username Login</th>
              <th className="px-4 py-4">Posisi / Jabatan</th>
              <th className="px-4 py-4">Status</th>
              <th className="px-4 py-4 text-center rounded-tr-xl">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {employees.map(emp => (
              <tr key={emp.id} className="hover:bg-white/5 transition-colors">
                <td className="px-4 py-4 font-bold text-white">{emp.full_name}</td>
                <td className="px-4 py-4 text-blue-400">@{emp.username}</td>
                <td className="px-4 py-4">
                  {emp.salary_schemas?.role_name ? (
                    <span className="px-2.5 py-1 bg-white/10 rounded-full text-xs font-medium text-foreground">
                      {emp.salary_schemas.role_name}
                    </span>
                  ) : (
                    <span className="text-foreground/40 italic text-xs">Belum diatur</span>
                  )}
                </td>
                <td className="px-4 py-4">
                  {emp.is_active ? (
                    <span className="flex items-center gap-1 text-green-400 text-xs font-medium">
                      <CheckCircle2 className="w-3 h-3" /> Aktif
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-red-400 text-xs font-medium">
                      <XCircle className="w-3 h-3" /> Nonaktif
                    </span>
                  )}
                </td>
                <td className="px-4 py-4">
                  <div className="flex items-center justify-center gap-2">
                    <button onClick={() => handleEdit(emp)} className="p-2 text-blue-400 hover:bg-blue-400/10 rounded-lg transition-colors">
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDelete(emp.id)} className="p-2 text-red-400 hover:bg-red-400/10 rounded-lg transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {employees.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center py-8 text-foreground/40">Belum ada karyawan terdaftar.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-background border border-white/10 rounded-2xl w-full max-w-md shadow-2xl">
            <div className="border-b border-white/10 px-6 py-4 flex justify-between items-center">
              <h2 className="text-xl font-bold">{formData.id ? 'Edit' : 'Tambah'} Karyawan</h2>
              <button onClick={() => setIsModalOpen(false)} className="p-2 text-foreground/60 hover:text-white rounded-full hover:bg-white/10 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground/80">Nama Lengkap <span className="text-red-400">*</span></label>
                <input 
                  type="text" 
                  required
                  value={formData.full_name} 
                  onChange={e => setFormData({...formData, full_name: e.target.value})} 
                  className="glass-input w-full"
                  placeholder="Misal: Budi Santoso"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground/80">Username Login <span className="text-red-400">*</span></label>
                <input 
                  type="text" 
                  required
                  disabled={!!formData.id}
                  value={formData.username} 
                  onChange={e => setFormData({...formData, username: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '')})} 
                  className="glass-input w-full disabled:opacity-50"
                  placeholder="Misal: budi_s"
                />
                {formData.id && <p className="text-[10px] text-yellow-400/80">Username tidak dapat diubah setelah dibuat.</p>}
              </div>

              {!formData.id && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground/80">Password <span className="text-red-400">*</span></label>
                  <input 
                    type="password" 
                    required={!formData.id}
                    value={formData.password} 
                    onChange={e => setFormData({...formData, password: e.target.value})} 
                    className="glass-input w-full"
                    placeholder="Minimal 6 karakter"
                    minLength={6}
                  />
                </div>
              )}

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground/80 mb-1 block">Posisi / Jabatan</label>
                <CustomSelect 
                  value={formData.salary_schema_id} 
                  onChange={e => setFormData({...formData, salary_schema_id: e.target.value})}
                  options={[
                    { value: "", label: "- Pilih Posisi (Kosongkan jika belum ada) -" },
                    ...schemas.map(s => ({ value: s.id, label: s.role_name }))
                  ]}
                />
              </div>

              {isOperator && (
                <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                  <label className="text-sm font-medium text-foreground/80 mb-1 block">Atasan (Operator Mesin) <span className="text-red-400">*</span></label>
                  <CustomSelect 
                    value={formData.supervisor_id} 
                    onChange={e => setFormData({...formData, supervisor_id: e.target.value})}
                    options={[
                      { value: "", label: "- Pilih Atasan Operator -" },
                      ...operatorMesinEmployees.map(op => ({ value: op.id, label: op.full_name }))
                    ]}
                  />
                  <p className="text-[10px] text-foreground/60">Produksi {formData.full_name || 'karyawan ini'} akan direkap sebagai bonus untuk atasannya.</p>
                </div>
              )}

              {formData.salary_schema_id && (
                <div className="grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground/80">Gaji Pokok (Harian)</label>
                    <input 
                      type="number" 
                      value={formData.gaji_harian} 
                      onChange={e => setFormData({...formData, gaji_harian: Number(e.target.value)})} 
                      className="glass-input w-full"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground/80">Uang Makan (Harian)</label>
                    <input 
                      type="number" 
                      value={formData.uang_makan} 
                      onChange={e => setFormData({...formData, uang_makan: Number(e.target.value)})} 
                      className="glass-input w-full"
                    />
                  </div>
                </div>
              )}

              {formData.id && (
                <div className="space-y-2 pt-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={formData.is_active}
                      onChange={e => setFormData({...formData, is_active: e.target.checked})}
                      className="w-4 h-4 rounded border-white/10 bg-white/5 text-primary focus:ring-primary focus:ring-offset-background"
                    />
                    <span className="text-sm font-medium text-foreground/80">Akun Aktif (Bisa Login)</span>
                  </label>
                </div>
              )}

              <div className="pt-4 mt-2 border-t border-white/10 flex justify-end gap-3">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-sm font-medium text-white bg-white/5 hover:bg-white/10 rounded-xl transition-colors">
                  Batal
                </button>
                <button type="submit" disabled={loading} className="btn-primary flex items-center gap-2">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {loading ? 'Menyimpan...' : 'Simpan Karyawan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
