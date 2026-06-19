'use client'

import { useState } from 'react'
import { Calendar, CheckCircle2, Loader2, Calculator, Receipt } from 'lucide-react'
import CustomDatePicker from '@/components/CustomDatePicker'
import { calculatePayroll, savePayroll } from './actions'

export default function PayrollClient({ employees = [], dropdownConfig = {} }) {
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  
  const [payrollData, setPayrollData] = useState(null)
  const [loanDeductions, setLoanDeductions] = useState([])

  // States for save modal
  const [saveModalOpen, setSaveModalOpen] = useState(false)
  const [saveDesc, setSaveDesc] = useState('Gaji Karyawan')
  const [savePaymentMethod, setSavePaymentMethod] = useState('BCA')
  const [saveWorkshop, setSaveWorkshop] = useState('KING')

  const handleGenerate = async () => {
    if (!startDate || !endDate) return alert('Pilih rentang tanggal terlebih dahulu')
    if (new Date(startDate) > new Date(endDate)) return alert('Tanggal awal tidak boleh lebih besar dari tanggal akhir')

    setLoading(true)
    try {
      const res = await calculatePayroll(startDate, endDate)
      if (res.success) {
        // Build the payroll items
        const items = employees.map(emp => {
          const schema = emp.salary_schemas || {}
          
          // 1. Borongan Sendiri
          const myQty = res.qtyPerEmployee[emp.id] || 0
          const rateBorongan = schema.rate_borongan_sendiri || 0
          const borongan_amount = myQty * rateBorongan

          // 2. Bonus Harian (Cek per hari dari qtyPerEmployeeDate)
          let totalBonusHarian = 0
          const myDailyQty = res.qtyPerEmployeeDate[emp.id] || {}
          
          Object.values(myDailyQty).forEach(qty => {
            if (schema.batas_qty_bonus_harian > 0 && qty < schema.batas_qty_bonus_harian) {
              totalBonusHarian += schema.bonus_harian_dibawah_target || 0
            }
            if (schema.batas_qty_target_harian > 0 && qty > schema.batas_qty_target_harian) {
              totalBonusHarian += schema.bonus_target_harian || 0
            }
          })

          // 3. Bawahan Bonus (Hanya jika dia punya bawahan)
          // Cari bawahan yang supervisor_id-nya adalah dia
          const subordinates = employees.filter(e => e.supervisor_id === emp.id)
          let bawahanQtyTotal = 0
          subordinates.forEach(sub => {
            bawahanQtyTotal += res.qtyPerEmployee[sub.id] || 0
          })
          const rateBawahan = schema.rate_produksi_bawahan || 0
          const bawahan_bonus = bawahanQtyTotal * rateBawahan

          // 4. Hitung Hari Kerja (sederhana: jika ada qty, dihitung 1 hari kerja)
          const daysWorked = Object.keys(myDailyQty).length
          const base_salary = (emp.gaji_harian || 0) * daysWorked
          const meal_allowance = (emp.uang_makan || 0) * daysWorked
          const weekly_bonus = schema.bonus_mingguan || 0

          // Ambil total deduction otomatis (kasbon + cicilan pinjaman)
          const loanData = res.deductionsPerEmployee[emp.id]
          const autoDeduction = loanData ? loanData.totalDeduction : 0

          const total_sebelum_kasbon = base_salary + meal_allowance + weekly_bonus + borongan_amount + bawahan_bonus + totalBonusHarian
          const total = total_sebelum_kasbon - autoDeduction

          return {
            employee_id: emp.id,
            employee_name: emp.full_name,
            role_name: schema.role_name || '-',
            myQty,
            bawahanQtyTotal,
            daysWorked,
            base_salary,
            meal_allowance,
            weekly_bonus,
            borongan_amount,
            bawahan_bonus,
            other_bonuses: totalBonusHarian,
            kasbon_amount: autoDeduction,
            total
          }
        })

        // Hanya tampilkan yang punya total > 0 atau ada role operator
        const filteredItems = items.filter(i => i.total !== 0 || i.myQty > 0 || i.role_name.toLowerCase().includes('operator'))

        const grandTotal = filteredItems.reduce((acc, curr) => acc + curr.total, 0)
        
        // Kumpulkan semua detail loanIds
        let allDeductions = []
        Object.values(res.deductionsPerEmployee || {}).forEach(d => {
          if (d.loanIds) allDeductions = [...allDeductions, ...d.loanIds]
        })
        setLoanDeductions(allDeductions)

        setPayrollData({
          startDate,
          endDate,
          items: filteredItems,
          grandTotal
        })
      } else {
        alert('Gagal mengambil data produksi: ' + res.error)
      }
    } catch (err) {
      alert('Terjadi kesalahan')
    } finally {
      setLoading(false)
    }
  }

  const handleKasbonChange = (employee_id, value) => {
    setPayrollData(prev => {
      const newItems = prev.items.map(item => {
        if (item.employee_id === employee_id) {
          const numValue = Number(value.replace(/[^0-9]/g, '')) || 0
          // Hitung ulang total (kasbon dikurangi dari total_sebelum_kasbon)
          const total_sebelum_kasbon = item.base_salary + item.meal_allowance + item.weekly_bonus + item.borongan_amount + item.bawahan_bonus + item.other_bonuses
          return { ...item, kasbon_amount: numValue, total: total_sebelum_kasbon - numValue }
        }
        return item
      })
      const grandTotal = newItems.reduce((acc, curr) => acc + curr.total, 0)
      return { ...prev, items: newItems, grandTotal }
    })
  }

  const handleSave = () => {
    if (!payrollData) return
    setSaveModalOpen(true)
  }

  const handleSaveSubmit = async () => {
    setSaveModalOpen(false)
    setSaving(true)
    try {
      const payload = {
        startDate: payrollData.startDate,
        endDate: payrollData.endDate,
        grandTotal: payrollData.grandTotal,
        items: payrollData.items,
        loanDeductions,
        description: saveDesc,
        payment_method: savePaymentMethod,
        workshop_code: saveWorkshop
      }
      const res = await savePayroll(payload)
      if (res.success) {
        alert('Rekap gaji berhasil disimpan!')
        setPayrollData(null) // Reset form
      } else {
        alert('Gagal menyimpan: ' + res.error)
      }
    } catch (e) {
      alert('Terjadi kesalahan')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6 animate-in fade-in zoom-in-95 duration-500 pb-20">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Receipt className="w-6 h-6 text-green-400" />
            Rekap Gaji & Borongan
          </h1>
          <p className="text-sm text-foreground/60 mt-1">Kalkulasi otomatis berdasarkan absensi produksi dan skema jabatan.</p>
        </div>
      </header>

      <div className="glass-card p-6">
        <h2 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
          <Calendar className="w-5 h-5 text-primary" /> Filter Periode
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground/80">Tanggal Awal</label>
            <CustomDatePicker value={startDate} onChange={setStartDate} />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground/80">Tanggal Akhir</label>
            <CustomDatePicker value={endDate} onChange={setEndDate} />
          </div>
          <div className="pt-2">
            <button disabled={loading} onClick={handleGenerate} className="btn-primary w-full h-11 flex items-center justify-center gap-2 disabled:opacity-50">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Calculator className="w-4 h-4" />}
              {loading ? 'Menghitung...' : 'Hitung Gaji'}
            </button>
          </div>
        </div>
      </div>

      {payrollData && (
        <div className="glass-card overflow-hidden animate-in fade-in slide-in-from-bottom-4">
          <div className="p-4 border-b border-white/10 bg-white/5 flex justify-between items-center">
            <div>
              <h3 className="font-bold text-primary">Hasil Kalkulasi: {new Date(payrollData.startDate).toLocaleDateString('id-ID')} - {new Date(payrollData.endDate).toLocaleDateString('id-ID')}</h3>
              <p className="text-sm text-foreground/60">Total Beban Gaji: <strong className="text-foreground">Rp {payrollData.grandTotal.toLocaleString('id-ID')}</strong></p>
            </div>
            <button disabled={saving} onClick={handleSave} className="btn-primary h-10 px-4 text-sm flex items-center gap-2 shadow-[0_0_15px_rgba(212,175,55,0.3)] disabled:opacity-50">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              {saving ? 'Menyimpan...' : 'Simpan Rekap'}
            </button>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-white/5 border-b border-white/10 text-foreground/70 uppercase text-xs">
                <tr>
                  <th className="px-6 py-4 font-medium">Nama Karyawan</th>
                  <th className="px-6 py-4 font-medium">Posisi / Jabatan</th>
                  <th className="px-6 py-4 font-medium">Kinerja Qty</th>
                  <th className="px-6 py-4 font-medium">Gaji + Makan (Hr)</th>
                  <th className="px-6 py-4 font-medium">Hasil Borongan</th>
                  <th className="px-6 py-4 font-medium">Bonus (Mingguan+Bawahan+Lain)</th>
                  <th className="px-6 py-4 font-medium text-red-400">Potong Kasbon/Bon</th>
                  <th className="px-6 py-4 font-medium text-right text-green-400">Total Take Home Pay</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {payrollData.items.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="px-6 py-12 text-center text-foreground/40">Tidak ada data produksi untuk periode ini.</td>
                  </tr>
                ) : payrollData.items.map((item, i) => (
                  <tr key={i} className="hover:bg-white/5 transition-colors">
                    <td className="px-6 py-4 text-foreground/90 font-bold">{item.employee_name}</td>
                    <td className="px-6 py-4 text-primary">{item.role_name}</td>
                    <td className="px-6 py-4 text-foreground/80">
                      <div>Sendiri: <strong className="text-foreground">{item.myQty} pcs</strong></div>
                      {item.bawahanQtyTotal > 0 && <div className="text-xs mt-1">Bawahan: {item.bawahanQtyTotal} pcs</div>}
                    </td>
                    <td className="px-6 py-4 text-foreground/80">
                      <div>Gaji: Rp {item.base_salary.toLocaleString('id-ID')}</div>
                      <div>Makan: Rp {item.meal_allowance.toLocaleString('id-ID')}</div>
                      <div className="text-[10px] text-foreground/40 mt-1">({item.daysWorked} hari absensi)</div>
                    </td>
                    <td className="px-6 py-4 font-medium text-blue-400">Rp {item.borongan_amount.toLocaleString('id-ID')}</td>
                    <td className="px-6 py-4 text-foreground/80">
                      <div>Bawahan: Rp {item.bawahan_bonus.toLocaleString('id-ID')}</div>
                      <div>Mingguan: Rp {item.weekly_bonus.toLocaleString('id-ID')}</div>
                      {item.other_bonuses > 0 && <div>Lainnya: Rp {item.other_bonuses.toLocaleString('id-ID')}</div>}
                    </td>
                    <td className="px-6 py-4">
                      <input 
                        type="text" 
                        value={item.kasbon_amount === 0 ? '' : item.kasbon_amount.toLocaleString('id-ID')}
                        onChange={(e) => handleKasbonChange(item.employee_id, e.target.value)}
                        placeholder="Rp 0"
                        className="glass-input w-24 text-sm text-red-400 font-bold text-right"
                      />
                    </td>
                    <td className="px-6 py-4 text-right font-bold text-green-400 text-lg">
                      Rp {item.total.toLocaleString('id-ID')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {/* Modal Simpan Rekap */}
      {saveModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="glass-card w-full max-w-md p-6 flex flex-col gap-6 animate-in zoom-in-95 duration-200 shadow-2xl border border-white/10">
            <div>
              <h3 className="text-xl font-bold text-primary">Simpan Rekap Gaji</h3>
              <p className="text-sm text-foreground/60 mt-1">Konfirmasi pembayaran dan penyimpanan rekap gaji ini.</p>
            </div>
            
            <div className="p-4 rounded-xl bg-primary/10 border border-primary/20 flex justify-between items-center">
              <span className="text-sm font-medium text-primary">Total Tagihan Gaji</span>
              <span className="text-lg font-bold text-primary">Rp {(payrollData?.grandTotal || 0).toLocaleString('id-ID')}</span>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-medium text-foreground/80">Keterangan Gaji</label>
                <input 
                  type="text" 
                  value={saveDesc} 
                  onChange={e => setSaveDesc(e.target.value)} 
                  className="glass-input w-full"
                  placeholder="Cth: Gaji Karyawan Bulan ... Minggu Ke ..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-medium text-foreground/80">Metode Pembayaran</label>
                  <CustomSelect 
                    value={savePaymentMethod} 
                    onChange={e => setSavePaymentMethod(e.target.value)} 
                    options={(dropdownConfig.payment_method || ["BCA", "MANDIRI", "CASH"]).map(method => ({
                      value: method,
                      label: method
                    }))}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-foreground/80">Potong Kas Dari</label>
                  <CustomSelect 
                    value={saveWorkshop} 
                    onChange={e => setSaveWorkshop(e.target.value)} 
                    options={[
                      { value: "KING", label: "KING" },
                      { value: "TABUNGAN", label: "TABUNGAN" }
                    ]}
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-white/5">
              <button 
                onClick={() => setSaveModalOpen(false)}
                className="btn-secondary px-4 py-2 text-sm"
              >
                Batal
              </button>
              <button 
                onClick={handleSaveSubmit}
                className="btn-primary px-4 py-2 text-sm flex items-center gap-2"
              >
                Proses Pembayaran
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
