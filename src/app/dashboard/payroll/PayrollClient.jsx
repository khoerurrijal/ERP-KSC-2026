'use client'

import { Fragment, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Calendar, Check, CheckCircle2, ClipboardCheck, Calculator, ChevronDown, Loader2, Printer, Wallet } from 'lucide-react'
import CustomDatePicker from '@/components/CustomDatePicker'
import CustomSelect from '@/components/CustomSelect'
import { calculatePayroll, getWeeklyAttendance, saveWeeklyAttendance, savePayroll } from './actions'
import { calculatePayrollTotals, getPayrollLedgerAmount, getPayrollWeekStart } from './calculations.mjs'

const currency = value => `Rp ${Number(value || 0).toLocaleString('id-ID', { maximumFractionDigits: 0 })}`
const todayKey = () => {
  const today = new Date()
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
}
const formatAttendanceDate = date => new Intl.DateTimeFormat('id-ID', {
  day: 'numeric', month: 'short', timeZone: 'UTC'
}).format(new Date(`${date}T00:00:00.000Z`))
const formatAttendanceWeekday = date => new Intl.DateTimeFormat('id-ID', {
  weekday: 'short', timeZone: 'UTC'
}).format(new Date(`${date}T00:00:00.000Z`)).replace(/\./g, '')
const formatAttendanceWeek = (start, end) => {
  if (!start || !end) return ''
  const format = date => new Intl.DateTimeFormat('id-ID', {
    day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC'
  }).format(new Date(`${date}T00:00:00.000Z`))
  return `${format(start)} – ${format(end)}`
}
const parseAmount = value => Math.max(0, Number.parseInt(value, 10) || 0)
const formatInteger = value => Number(value || 0).toLocaleString('id-ID', { maximumFractionDigits: 0 })

const PAY_COMPONENTS = [
  { key: 'base_salary', label: 'Gaji hadir' },
  { key: 'meal_allowance', label: 'Uang makan' },
  { key: 'borongan_amount', label: 'Borongan normal (semua qty)' },
  { key: 'two_color_amount', label: 'Bonus tambahan 2 warna' },
  { key: 'weekly_bonus', label: 'Bonus mingguan' },
  { key: 'bawahan_bonus', label: 'Bonus bawahan' },
  { key: 'other_bonuses', label: 'Bonus harian' },
  { key: 'overtime_amount', label: 'Lembur' }
]

const DEDUCTION_COMPONENTS = [
  { key: 'kasbon_amount', label: 'BON / Kasbon' },
  { key: 'pinjaman_amount', label: 'Cicilan pinjaman' },
  { key: 'late_deduction', label: 'Terlambat (Rp)' }
]

const PRODUCTION_COMPONENT_KEYS = new Set([
  'borongan_amount', 'two_color_amount', 'bawahan_bonus', 'other_bonuses'
])
const isAdminRole = item => ['admin', 'administrator'].includes(String(item.role_name || '').trim().toLowerCase())
const isProductionOperatorRole = item => ['operator', 'operator mesin'].includes(String(item.role_name || '').trim().toLowerCase())
const getDailyProductionEntries = item => Object.entries(item.dailyQty || {})
  .map(([date, qty]) => ({ date, qty: Number(qty || 0), twoColorQty: Number(item.dailyTwoColorQty?.[date] || 0) }))
  .filter(entry => Number.isFinite(entry.qty) && (entry.qty !== 0 || entry.twoColorQty !== 0))
  .sort((a, b) => a.date.localeCompare(b.date))
const getPayrollIncomeComponents = item => {
  const role = String(item.role_name || '').trim().toLowerCase()
  const isOperator = role === 'operator' || role === 'operator mesin'
  const isOperatorMachine = role === 'operator mesin'
  return PAY_COMPONENTS.filter(component => {
    if (isAdminRole(item) && PRODUCTION_COMPONENT_KEYS.has(component.key)) return false
    if (component.key === 'two_color_amount' && !isOperator) return false
    if (component.key === 'bawahan_bonus' && !isOperatorMachine) return false
    return true
  })
}

const getPayrollPrintBreakdown = item => {
  return {
    income: getPayrollIncomeComponents(item).filter(component => Number(item[component.key] || 0) > 0),
    deductions: DEDUCTION_COMPONENTS.filter(component => Number(item[component.key] || 0) > 0)
  }
}

export default function PayrollClient({ dropdownConfig = {} }) {
  const [activeTab, setActiveTab] = useState('attendance')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [payrollData, setPayrollData] = useState(null)
  const [expandedPayrollId, setExpandedPayrollId] = useState(null)

  const [attendanceDate, setAttendanceDate] = useState(() => getPayrollWeekStart(todayKey()))
  const [attendanceRows, setAttendanceRows] = useState([])
  const [attendanceWeek, setAttendanceWeek] = useState(null)
  const [attendanceLoaded, setAttendanceLoaded] = useState(false)
  const [attendanceLoading, setAttendanceLoading] = useState(true)
  const [attendanceSaving, setAttendanceSaving] = useState(false)
  const [attendanceDirty, setAttendanceDirty] = useState(false)
  const [attendanceSaveMessage, setAttendanceSaveMessage] = useState('')
  const [attendanceNotice, setAttendanceNotice] = useState('')
  const [focusedLateInput, setFocusedLateInput] = useState(null)
  const attendanceDraftsRef = useRef(new Map())

  const [saveModalOpen, setSaveModalOpen] = useState(false)
  const [saveDesc, setSaveDesc] = useState('Gaji Karyawan')
  const [savePaymentMethod, setSavePaymentMethod] = useState('BCA')
  const [saveWorkshop, setSaveWorkshop] = useState('KING')

  const updateAttendanceRows = transform => {
    const updatedRows = transform(attendanceRows)
    setAttendanceRows(updatedRows)
    attendanceDraftsRef.current.set(attendanceDate, { rows: updatedRows, dirty: true, error: '' })
    setAttendanceDirty(true)
    setAttendanceSaveMessage('')
  }

  const openAttendance = () => {
    setActiveTab('attendance')
    setAttendanceLoaded(false)
    setAttendanceLoading(true)
  }

  const persistAttendance = async (referenceDate = attendanceDate, records = attendanceRows) => {
    setAttendanceSaving(true)
    try {
      const result = await saveWeeklyAttendance(referenceDate, records)
      if (!result.success) throw new Error(result.error)
      const savedWeek = getPayrollWeekStart(referenceDate)
      attendanceDraftsRef.current.delete(savedWeek)
      if (![...attendanceDraftsRef.current.values()].some(draft => draft.dirty)) setAttendanceNotice('')
      if (savedWeek === attendanceDate) {
        setAttendanceDirty(false)
        setAttendanceSaveMessage('')
      }
      return result
    } finally {
      setAttendanceSaving(false)
    }
  }

  const changeAttendanceWeek = async date => {
    const weekStart = getPayrollWeekStart(date)
    if (weekStart === attendanceDate || attendanceSaving) return
    if (attendanceDirty) {
      const currentDraft = { rows: attendanceRows, dirty: true, error: '' }
      attendanceDraftsRef.current.set(attendanceDate, currentDraft)
      try {
        await persistAttendance(attendanceDate, attendanceRows)
      } catch (error) {
        const message = error.message || 'Perubahan absensi gagal disimpan.'
        attendanceDraftsRef.current.set(attendanceDate, { ...currentDraft, error: message })
        setAttendanceNotice(`Minggu ${formatAttendanceDate(attendanceDate)} belum tersimpan. Draft tetap tersedia; buka minggu itu lagi untuk mencoba simpan.`)
      }
    }
    setAttendanceDate(weekStart)
    setAttendanceLoaded(false)
    setAttendanceLoading(true)
    setAttendanceDirty(false)
    setAttendanceSaveMessage('')
  }

  useEffect(() => {
    if (activeTab !== 'attendance') return undefined
    let cancelled = false
    getWeeklyAttendance(attendanceDate)
      .then(result => {
        if (cancelled) return
        if (!result.success) throw new Error(result.error)
        const draft = attendanceDraftsRef.current.get(attendanceDate)
        setAttendanceRows(draft?.rows || result.employees)
        setAttendanceWeek(result)
        setAttendanceLoaded(true)
        setAttendanceDirty(Boolean(draft?.dirty))
        setAttendanceSaveMessage(draft?.dirty ? (draft.error || '') : '')
      })
      .catch(error => {
        if (!cancelled) alert(error.message || 'Gagal memuat absensi.')
      })
      .finally(() => {
        if (!cancelled) setAttendanceLoading(false)
      })
    return () => { cancelled = true }
  }, [activeTab, attendanceDate])

  const saveAttendance = async () => {
    try {
      const result = await persistAttendance()
      alert(`Absensi minggu ini tersimpan: ${result.presentCount} hadir, ${result.absentCount} absen.`)
    } catch (error) {
      const message = error.message || 'Gagal menyimpan absensi.'
      attendanceDraftsRef.current.set(attendanceDate, { rows: attendanceRows, dirty: true, error: message })
      setAttendanceSaveMessage(message)
      alert(message)
    }
  }

  const handleGenerate = async () => {
    if (!startDate || !endDate) return alert('Pilih rentang tanggal terlebih dahulu.')
    if (startDate > endDate) return alert('Tanggal awal tidak boleh lebih besar dari tanggal akhir.')
    setLoading(true)
    try {
      const result = await calculatePayroll(startDate, endDate)
      if (!result.success) throw new Error(result.error)
      const items = result.items.map(item => ({
        ...item,
        overtime_amount: 0
      }))
      setPayrollData({
        startDate,
        endDate,
        items,
        grandTotal: items.reduce((sum, item) => sum + item.total, 0)
      })
      setExpandedPayrollId(null)
    } catch (error) {
      alert(error.message || 'Gagal menghitung rekap gaji.')
    } finally {
      setLoading(false)
    }
  }

  const updatePayrollItem = (employeeId, field, value) => {
    setPayrollData(previous => {
      if (!previous) return previous
      const items = previous.items.map(item => {
        if (item.employee_id !== employeeId) return item
        const nextValue = parseAmount(value)
        const updated = { ...item, [field]: nextValue }
        Object.assign(updated, calculatePayrollTotals(updated))
        updated.calculation_snapshot = {
          ...(updated.calculation_snapshot || {}),
          component_amounts: {
            ...(updated.calculation_snapshot?.component_amounts || {}),
            [field]: nextValue
          }
        }
        return updated
      })
      return { ...previous, items, grandTotal: items.reduce((sum, item) => sum + item.total, 0) }
    })
  }

  const handleSaveSubmit = async () => {
    if (!payrollData) return
    setSaveModalOpen(false)
    setSaving(true)
    try {
      const result = await savePayroll({
        startDate: payrollData.startDate,
        endDate: payrollData.endDate,
        grandTotal: payrollData.grandTotal,
        items: payrollData.items,
        description: saveDesc,
        payment_method: savePaymentMethod,
        workshop_code: saveWorkshop
      })
      if (!result.success) throw new Error(result.error)
      alert('Rekap gaji berhasil disimpan.')
      setPayrollData(null)
    } catch (error) {
      alert(error.message || 'Gagal menyimpan rekap gaji.')
    } finally {
      setSaving(false)
    }
  }

  const payrollSummary = payrollData?.items.reduce((summary, item) => ({
    ledger: summary.ledger + getPayrollLedgerAmount(item),
    deductions: summary.deductions + Number(item.total_deductions || 0),
    late: summary.late + Number(item.late_deduction || 0),
    net: summary.net + Number(item.total || 0)
  }), { ledger: 0, deductions: 0, late: 0, net: 0 }) || { ledger: 0, deductions: 0, late: 0, net: 0 }
  const payrollPages = []
  for (let index = 0; index < (payrollData?.items.length || 0); index += 4) {
    const items = payrollData.items.slice(index, index + 4)
    const totals = items.reduce((sum, item) => ({
      ledger: sum.ledger + getPayrollLedgerAmount(item),
      net: sum.net + Number(item.total || 0)
    }), { ledger: 0, net: 0 })
    payrollPages.push({ items, totals })
  }

  return (
    <div className="space-y-4 animate-in fade-in zoom-in-95 duration-500 pb-12">
      <div className="flex border-b border-white/10">
        <button type="button" onClick={openAttendance} className={`px-4 py-3 text-sm font-semibold border-b-2 ${activeTab === 'attendance' ? 'text-primary border-primary' : 'text-foreground/60 border-transparent'}`}>
          <span className="inline-flex items-center gap-2"><ClipboardCheck className="w-4 h-4" /> Absensi</span>
        </button>
        <button type="button" onClick={() => setActiveTab('payroll')} className={`px-4 py-3 text-sm font-semibold border-b-2 ${activeTab === 'payroll' ? 'text-primary border-primary' : 'text-foreground/60 border-transparent'}`}>
          <span className="inline-flex items-center gap-2"><Wallet className="w-4 h-4" /> Rekap Gaji</span>
        </button>
      </div>

      {activeTab === 'attendance' ? (
        <div className="space-y-4">
          {attendanceNotice && <p role="status" className="rounded-lg border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-300">{attendanceNotice}</p>}
          <section className="glass-card p-4 space-y-3">
            <div>
              <h2 className="font-bold text-foreground">Absensi Mingguan</h2>
              <p className="text-sm text-foreground/60">Klik kotak untuk menandai Hadir. Kotak kosong dihitung absen.</p>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-end gap-3">
              <div className="w-full sm:max-w-xs space-y-2">
                <label className="text-sm text-foreground/80">Pilih minggu</label>
                <CustomDatePicker value={attendanceDate} onChange={changeAttendanceWeek} />
              </div>
              {attendanceLoaded && (
                <button type="button" onClick={saveAttendance} disabled={attendanceSaving || attendanceLoading || !attendanceWeek?.dates?.some(date => date <= todayKey() && !attendanceWeek.lockedDates.includes(date))} className="btn-primary h-10 px-4 inline-flex items-center justify-center gap-2 disabled:opacity-50">
                  {attendanceSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  {attendanceSaving ? 'Menyimpan...' : 'Simpan Minggu'}
                </button>
              )}
              {attendanceSaving && <span role="status" className="text-xs font-medium text-amber-300">Menyimpan...</span>}
              {!attendanceSaving && attendanceDirty && <span role="status" className="text-xs font-medium text-amber-400">Belum disimpan</span>}
              {!attendanceSaving && !attendanceDirty && attendanceLoaded && <span role="status" className="text-xs font-medium text-emerald-400">Tersimpan</span>}
              {attendanceSaveMessage && <span role="alert" className="text-xs font-medium text-red-300">{attendanceSaveMessage}</span>}
            </div>
            {attendanceWeek && <p className="text-xs text-foreground/50">Minggu {formatAttendanceWeek(attendanceWeek.weekStart, attendanceWeek.weekEnd)} · Hanya Senin–Sabtu.</p>}
          </section>

          {attendanceLoading ? (
            <div className="glass-card p-8 text-center text-foreground/60"><Loader2 className="w-5 h-5 animate-spin inline-block mr-2" />Memuat absensi mingguan...</div>
          ) : attendanceLoaded && (
            <section className="glass-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[700px] text-sm text-left md:min-w-[820px]">
                  <thead className="bg-white/5 text-foreground/70">
                    <tr>
                      <th className="sticky left-0 min-w-[110px] bg-background px-2 py-3 md:px-4">Karyawan</th>
                      {attendanceWeek.dates.map(date => (
                        <th key={date} className="min-w-[82px] px-1 py-2 text-center md:px-2 md:py-3">
                          <span className="block text-[10px] font-semibold uppercase md:text-xs">{formatAttendanceWeekday(date)}</span>
                          <span className="block text-xs md:text-sm">{new Date(`${date}T00:00:00.000Z`).getUTCDate()}</span>
                        </th>
                      ))}
                      <th className="min-w-[112px] px-2 py-3 text-right text-xs uppercase">Total Terlambat</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {attendanceRows.map(employee => {
                      const weeklyLateTotal = attendanceWeek.dates.reduce((sum, date) => sum + (
                        employee.attendance[date] ? Number(employee.lateDeduction?.[date] || 0) : 0
                      ), 0)
                      return (
                        <tr key={employee.id} className="hover:bg-white/[0.03]">
                          <td className="sticky left-0 min-w-[110px] bg-background px-2 py-3 font-semibold md:px-4">{employee.full_name}</td>
                        {attendanceWeek.dates.map(date => {
                          const locked = attendanceWeek.lockedDates.includes(date)
                          const future = date > todayKey()
                          const present = employee.attendance[date] === true
                          return (
                            <td key={date} className="px-1 py-2 text-center md:px-2">
                              <div className="flex flex-col items-center gap-1.5">
                                <button
                                  type="button"
                                  aria-label={`${employee.full_name}, ${formatAttendanceDate(date)}: ${present ? 'Hadir' : 'Absen'}`}
                                  aria-pressed={present}
                                  title={locked ? 'Tanggal sudah masuk rekap gaji tersimpan' : future ? 'Absensi tanggal mendatang belum dibuka' : present ? 'Hadir (klik untuk kosongkan)' : 'Tandai hadir'}
                                  disabled={locked || future || attendanceSaving}
                                  onClick={() => {
                                    updateAttendanceRows(rows => rows.map(row => {
                                      if (row.id !== employee.id) return row
                                      const nextPresent = !row.attendance[date]
                                      return {
                                        ...row,
                                        attendance: { ...row.attendance, [date]: nextPresent },
                                        lateDeduction: { ...row.lateDeduction, [date]: nextPresent ? row.lateDeduction?.[date] || 0 : 0 }
                                      }
                                    }))
                                  }}
                                  className={`mx-auto flex h-7 w-7 items-center justify-center rounded-lg border transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${present ? 'border-primary bg-primary text-primary-foreground' : 'border-white/15 bg-white/[0.03] hover:border-primary/60'}`}
                                >
                                  {present && <Check className="h-4 w-4" />}
                                </button>
                                <label className="sr-only" htmlFor={`late-${employee.id}-${date}`}>Terlambat {employee.full_name} {formatAttendanceDate(date)} dalam rupiah</label>
                                <input
                                  id={`late-${employee.id}-${date}`}
                                  type="text"
                                  inputMode="numeric"
                                  value={focusedLateInput === `${employee.id}:${date}`
                                    ? String(present && Number(employee.lateDeduction?.[date] || 0) !== 0 ? employee.lateDeduction[date] : '')
                                    : formatInteger(present ? employee.lateDeduction?.[date] ?? 0 : 0)}
                                  disabled={locked || future || attendanceSaving || !present}
                                  onFocus={() => {
                                    setFocusedLateInput(`${employee.id}:${date}`)
                                  }}
                                  onChange={event => {
                                    const digits = event.target.value.replace(/\D/g, '')
                                    const value = digits === '' ? '' : Number(digits)
                                    updateAttendanceRows(rows => rows.map(row => row.id !== employee.id ? row : {
                                      ...row,
                                      lateDeduction: { ...row.lateDeduction, [date]: value }
                                    }))
                                  }}
                                  onBlur={() => setFocusedLateInput(null)}
                                  className="glass-input h-6 w-16 px-1 text-center text-[10px] disabled:opacity-40"
                                  style={{ minHeight: '24px', height: '24px', fontSize: '10px', lineHeight: '12px' }}
                                />
                              </div>
                            </td>
                          )
                        })}
                          <td className="px-3 py-3 text-right font-semibold text-red-300">{currency(weeklyLateTotal)}</td>
                        </tr>
                      )
                    })}
                    {!attendanceRows.length && <tr><td colSpan={1 + attendanceWeek.dates.length + 1} className="px-4 py-10 text-center text-foreground/50">Belum ada karyawan aktif.</td></tr>}
                  </tbody>
                </table>
              </div>
              {attendanceWeek.lockedDates.length > 0 && <p className="border-t border-white/10 px-4 py-3 text-xs text-amber-400">Tanggal yang masuk rekap gaji tersimpan terkunci dan tidak dapat diubah.</p>}
            </section>
          )}
        </div>
      ) : (
        <>
          <section className="glass-card p-4">
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
              <button type="button" disabled={loading} onClick={handleGenerate} className="btn-primary w-full h-11 flex items-center justify-center gap-2 disabled:opacity-50">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Calculator className="w-4 h-4" />}
                {loading ? 'Menghitung...' : 'Hitung Gaji'}
              </button>
            </div>
            <p className="text-xs text-foreground/50 mt-3">Periode yang sudah direkap tidak bisa dihitung atau diubah ulang.</p>
          </section>

          {payrollData && (
            <section className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
              <div className="glass-card p-4 space-y-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="font-bold text-primary">Rekap Payroll</h3>
                    <p className="text-sm text-foreground/60">Periode {formatAttendanceWeek(payrollData.startDate, payrollData.endDate)} · {payrollData.items.length} karyawan</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => window.print()} className="btn-secondary h-10 px-4 text-sm inline-flex items-center justify-center gap-2">
                      <Printer className="h-4 w-4" /> Cetak Payroll
                    </button>
                    <button type="button" disabled={saving} onClick={() => setSaveModalOpen(true)} className="btn-primary h-10 px-4 text-sm inline-flex items-center justify-center gap-2 disabled:opacity-50">
                      {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                      Simpan Rekap
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/5 p-3">
                    <span className="block text-xs text-foreground/60">Total Gaji di Buku Besar</span>
                    <strong className="mt-1 block text-lg text-emerald-400">{currency(payrollSummary.ledger)}</strong>
                  </div>
                  <div className="rounded-xl border border-red-400/20 bg-red-400/5 p-3">
                    <span className="block text-xs text-foreground/60">Total Potongan</span>
                    <strong className="mt-1 block text-lg text-red-400">{currency(payrollSummary.deductions)}</strong>
                  </div>
                  <div className="rounded-xl border border-primary/25 bg-primary/5 p-3">
                    <span className="block text-xs text-foreground/60">Total Gaji Bersih</span>
                    <strong className="mt-1 block text-lg text-primary">{currency(payrollSummary.net)}</strong>
                  </div>
                </div>
              </div>

              <div className="glass-card overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[760px] text-sm text-left">
                    <thead className="bg-white/5 text-xs uppercase text-foreground/60">
                      <tr>
                        <th className="px-4 py-3">Karyawan</th>
                        <th className="px-3 py-3 text-center">Hadir</th>
                        <th className="px-3 py-3 text-right">Pendapatan</th>
                        <th className="px-3 py-3 text-right">Potongan</th>
                        <th className="px-3 py-3 text-right">Gaji Bersih</th>
                        <th className="px-4 py-3 text-right">Rincian</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/10">
                      {payrollData.items.map(item => {
                        const expanded = expandedPayrollId === item.employee_id
                        const dailyProductionEntries = getDailyProductionEntries(item)
                        return (
                          <Fragment key={item.employee_id}>
                            <tr className={`transition-colors ${expanded ? 'bg-white/[0.04]' : 'hover:bg-white/[0.03]'}`}>
                              <td className="px-4 py-3">
                                <span className="block font-semibold text-foreground">{item.employee_name}</span>
                                <span className="text-xs text-foreground/50">
                                  {isAdminRole(item) ? item.role_name : `${item.role_name} · ${Number(item.myQty || 0).toLocaleString('id-ID')} pcs garapan`}
                                </span>
                              </td>
                              <td className="px-3 py-3 text-center">{Number(item.attendance_days || 0)} hari</td>
                              <td className="px-3 py-3 text-right font-medium text-emerald-400">{currency(item.gross_total)}</td>
                              <td className="px-3 py-3 text-right font-medium text-red-400">{currency(item.total_deductions)}</td>
                              <td className="px-3 py-3 text-right font-bold text-primary">{currency(item.total)}</td>
                              <td className="px-4 py-3 text-right">
                                <button
                                  type="button"
                                  aria-expanded={expanded}
                                  onClick={() => setExpandedPayrollId(expanded ? null : item.employee_id)}
                                  className="inline-flex h-8 items-center gap-1 rounded-lg border border-white/10 px-2 text-xs text-foreground/70 hover:border-primary/40 hover:text-primary"
                                >
                                  Rincian <ChevronDown className={`h-3.5 w-3.5 transition-transform ${expanded ? 'rotate-180' : ''}`} />
                                </button>
                              </td>
                            </tr>
                            {expanded && (
                              <tr>
                                <td colSpan={6} className="bg-white/[0.02] p-3 md:p-4">
                                  {isProductionOperatorRole(item) && dailyProductionEntries.length > 0 && (
                                    <section className="mb-4 rounded-xl border border-primary/15 p-3">
                                      <h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-primary">Garapan Harian</h4>
                                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
                                        {dailyProductionEntries.map(entry => (
                                          <div key={entry.date} className="flex items-center justify-between gap-2 rounded-lg bg-white/[0.04] px-2.5 py-2 text-xs">
                                            <span className="text-foreground/65">{formatAttendanceDate(entry.date)}</span>
                                            <span className="text-right">
                                              <strong className="block whitespace-nowrap text-emerald-400">{formatInteger(entry.qty)} pcs</strong>
                                              {entry.twoColorQty !== 0 && <span className="block whitespace-nowrap text-primary">Warna ke-2 {formatInteger(entry.twoColorQty)} pcs</span>}
                                            </span>
                                          </div>
                                        ))}
                                      </div>
                                    </section>
                                  )}
                                  <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                                    <section className="rounded-xl border border-emerald-400/15 p-3">
                                      <h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-emerald-400">Rincian Pendapatan</h4>
                                      <div className="divide-y divide-white/5">
                                        {getPayrollIncomeComponents(item).map(component => (
                                          <label key={component.key} className="flex items-center justify-between gap-3 py-2">
                                            <span className="min-w-0">
                                              <span className="block text-xs text-foreground/80">{component.label}</span>
                                            </span>
                                            <input
                                              aria-label={`${component.label} ${item.employee_name}`}
                                              type="number" min="0" step="1" inputMode="numeric"
                                              value={item[component.key] || 0}
                                              onChange={event => updatePayrollItem(item.employee_id, component.key, event.target.value)}
                                              className="glass-input h-8 w-32 text-right text-xs"
                                            />
                                          </label>
                                        ))}
                                      </div>
                                      <div className="mt-2 flex justify-between border-t border-white/10 pt-2 text-xs">
                                        <span className="text-foreground/60">Total Pendapatan</span>
                                        <strong className="text-emerald-400">{currency(item.gross_total)}</strong>
                                      </div>
                                    </section>
                                    <section className="rounded-xl border border-red-400/15 p-3">
                                      <h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-red-400">Rincian Potongan</h4>
                                      <div className="divide-y divide-white/5">
                                        {DEDUCTION_COMPONENTS.map(component => (
                                          <label key={component.key} className="flex items-center justify-between gap-3 py-2">
                                            <span className="min-w-0">
                                              <span className="block text-xs text-foreground/80">{component.label}</span>
                                            </span>
                                            <input
                                              aria-label={`${component.label} ${item.employee_name}`}
                                              type="number" min="0" step="1" inputMode="numeric"
                                              value={item[component.key] || 0}
                                              onChange={event => updatePayrollItem(item.employee_id, component.key, event.target.value)}
                                              className="glass-input h-8 w-32 text-right text-xs text-red-300"
                                            />
                                          </label>
                                        ))}
                                      </div>
                                      <div className="mt-2 flex justify-between border-t border-white/10 pt-2 text-xs">
                                        <span className="text-foreground/60">Total Potongan</span>
                                        <strong className="text-red-400">{currency(item.total_deductions)}</strong>
                                      </div>
                                    </section>
                                  </div>
                                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-primary/10 px-3 py-2">
                                    <span className="text-xs text-foreground/70">Gaji bersih {item.total < 0 ? '· potongan melebihi pendapatan' : ''}</span>
                                    <strong className="text-sm text-primary">{currency(item.total)}</strong>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </Fragment>
                        )
                      })}
                      {!payrollData.items.length && <tr><td colSpan={6} className="px-4 py-10 text-center text-foreground/50">Tidak ada karyawan untuk periode ini.</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          )}
        </>
      )}

      {payrollData && typeof document !== 'undefined' && createPortal(
        <div id="payroll-print-root" className="payroll-print-root" aria-hidden="true">
          {payrollPages.map((page, pageIndex) => (
            <article className="payroll-print-page" key={`payroll-print-page-${pageIndex}`}>
              <header className="payroll-print-header">
                <div>
                  <strong>KING SABLON</strong>
                  <span>Rekap Penggajian Karyawan</span>
                </div>
                <div className="payroll-print-period">
                  <strong>Periode</strong>
                  <span>{formatAttendanceWeek(payrollData.startDate, payrollData.endDate)}</span>
                  <span>Lembar {pageIndex + 1} dari {payrollPages.length} · Maks. 4 karyawan</span>
                </div>
              </header>

              <div className="payroll-print-page-totals">
                <span>Gaji di Buku Besar: <strong>{currency(page.totals.ledger)}</strong></span>
                <span>Gaji bersih dibayarkan: <strong>{currency(page.totals.net)}</strong></span>
              </div>

              <div className="payroll-print-employees">
                {page.items.map(item => {
                  const breakdown = getPayrollPrintBreakdown(item)
                  return (
                  <section className="payroll-print-employee" key={`print-${item.employee_id}`}>
                    <header className="payroll-print-employee-header">
                      <div>
                        <strong>{item.employee_name}</strong>
                        <span>
                          {item.role_name} · {Number(item.attendance_days || 0)} hari hadir
                          {!isAdminRole(item) && ` · ${Number(item.myQty || 0).toLocaleString('id-ID')} pcs garapan`}
                        </span>
                      </div>
                      <div className="payroll-print-net">
                        <span>Gaji bersih</span>
                        <strong>{currency(item.total)}</strong>
                      </div>
                    </header>
                    <div className="payroll-print-breakdown">
                      <div>
                        <h4>Pendapatan</h4>
                        {breakdown.income.map(component => (
                          <div className="payroll-print-line" key={component.key}>
                            <span>{component.label}</span>
                            <strong>{currency(item[component.key])}</strong>
                          </div>
                        ))}
                        {!breakdown.income.length && <div className="payroll-print-line"><span>-</span><strong>{currency(0)}</strong></div>}
                        <div className="payroll-print-subtotal"><span>Total pendapatan</span><strong>{currency(item.gross_total)}</strong></div>
                      </div>
                      <div>
                        <h4>Potongan</h4>
                        {breakdown.deductions.map(component => (
                          <div className="payroll-print-line" key={component.key}>
                            <span>{component.label}</span>
                            <strong>{currency(item[component.key])}</strong>
                          </div>
                        ))}
                        {!breakdown.deductions.length && <div className="payroll-print-line"><span>-</span><strong>{currency(0)}</strong></div>}
                        <div className="payroll-print-subtotal"><span>Total potongan</span><strong>{currency(item.total_deductions)}</strong></div>
                      </div>
                    </div>
                  </section>
                  )
                })}
              </div>

              <footer className="payroll-print-signatures">
                <div>Dibuat oleh</div>
                <div>Diperiksa</div>
                <div>Disetujui</div>
              </footer>
            </article>
          ))}
        </div>,
        document.body
      )}

      <style jsx global>{`
        .payroll-print-root { display: none; }
        @media print {
          @page { size: A4 portrait; margin: 8mm; }
          html, body { margin: 0 !important; padding: 0 !important; background: #fff !important; }
          body > *:not(#payroll-print-root) { display: none !important; }
          #payroll-print-root {
            display: block !important;
            position: static !important;
            width: 194mm !important;
            color: #111 !important;
            background: #fff !important;
            font-family: Arial, sans-serif !important;
          }
          .payroll-print-page {
            box-sizing: border-box;
            width: 194mm;
            height: 281mm;
            display: grid;
            grid-template-rows: auto auto minmax(0, 1fr) auto;
            gap: 3mm;
            break-after: page;
            page-break-after: always;
            overflow: hidden;
          }
          .payroll-print-page:last-child { break-after: auto; page-break-after: auto; }
          .payroll-print-header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 0.4mm solid #222; padding-bottom: 2mm; }
          .payroll-print-header > div:first-child { display: grid; gap: 1mm; }
          .payroll-print-header > div:first-child strong { font-size: 13pt; letter-spacing: 0.3mm; }
          .payroll-print-header > div:first-child span { font-size: 8pt; }
          .payroll-print-period { display: grid; justify-items: end; gap: 0.6mm; font-size: 7pt; }
          .payroll-print-period strong { text-transform: uppercase; font-size: 6pt; }
          .payroll-print-page-totals { display: flex; justify-content: space-between; border: 0.25mm solid #777; padding: 1.5mm 2mm; font-size: 8pt; }
          .payroll-print-employees { min-height: 0; display: grid; grid-template-rows: repeat(4, minmax(0, 1fr)); gap: 2mm; }
          .payroll-print-employee { min-height: 0; box-sizing: border-box; border: 0.25mm solid #888; padding: 1.8mm 2mm; display: grid; grid-template-rows: auto minmax(0, 1fr); gap: 1.2mm; break-inside: avoid; overflow: hidden; }
          .payroll-print-employee-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 0.2mm solid #bbb; padding-bottom: 1mm; }
          .payroll-print-employee-header > div:first-child { display: grid; gap: 0.6mm; }
          .payroll-print-employee-header > div:first-child strong { font-size: 9pt; }
          .payroll-print-employee-header > div:first-child span, .payroll-print-net span { font-size: 6.5pt; color: #444; }
          .payroll-print-net { display: grid; justify-items: end; gap: 0.6mm; }
          .payroll-print-net strong { font-size: 9pt; }
          .payroll-print-breakdown { min-height: 0; display: grid; grid-template-columns: 1fr 0.8fr; gap: 4mm; }
          .payroll-print-breakdown h4 { font-size: 6pt; text-transform: uppercase; margin: 0 0 0.6mm; letter-spacing: 0.2mm; }
          .payroll-print-line, .payroll-print-subtotal { display: flex; justify-content: space-between; gap: 2mm; font-size: 6.2pt; line-height: 1.15; padding: 0.35mm 0; border-bottom: 0.1mm solid #e5e5e5; }
          .payroll-print-line strong, .payroll-print-subtotal strong { white-space: nowrap; }
          .payroll-print-subtotal { font-weight: 700; border-bottom: 0; border-top: 0.2mm solid #888; margin-top: 0.5mm; padding-top: 0.7mm; }
          .payroll-print-signatures { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8mm; font-size: 6.5pt; text-align: center; padding-top: 5mm; }
          .payroll-print-signatures div { border-top: 0.2mm solid #777; padding-top: 1mm; }
        }
      `}</style>

      {saveModalOpen && payrollData && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" onMouseDown={event => event.target === event.currentTarget && setSaveModalOpen(false)}>
          <div className="glass-card w-full max-w-md p-6 flex flex-col gap-5 shadow-2xl border border-white/10">
            <div>
              <h3 className="text-xl font-bold text-primary">Simpan Rekap Gaji</h3>
              <p className="text-sm text-foreground/60 mt-1">Buku Besar mencatat gaji bersih ditambah terlambat. Payroll tetap menyimpan terlambat sebagai potongan.</p>
            </div>
            <div className="p-4 rounded-xl bg-primary/10 border border-primary/20 flex justify-between items-center">
              <span className="text-sm font-medium text-primary">Total Pengeluaran Buku Besar</span>
              <span className="text-lg font-bold text-primary">{currency(payrollSummary.ledger)}</span>
            </div>
            <p className="-mt-3 text-xs text-foreground/60">Gaji bersih {currency(payrollSummary.net)} + terlambat {currency(payrollSummary.late)}</p>
            <div className="space-y-4">
              <label className="block space-y-2">
                <span className="text-xs font-medium text-foreground/80">Keterangan Gaji</span>
                <input type="text" value={saveDesc} onChange={event => setSaveDesc(event.target.value)} className="glass-input w-full" placeholder="Gaji Karyawan" />
              </label>
              <div className="grid grid-cols-2 gap-4">
                <label className="block space-y-2">
                  <span className="text-xs font-medium text-foreground/80">Metode Pembayaran</span>
                  <CustomSelect value={savePaymentMethod} onChange={event => setSavePaymentMethod(event.target.value)} options={(dropdownConfig.payment_method || ['BCA', 'MANDIRI', 'CASH']).map(method => ({ value: method, label: method }))} />
                </label>
                <label className="block space-y-2">
                  <span className="text-xs font-medium text-foreground/80">Potong Kas Dari</span>
                  <CustomSelect value={saveWorkshop} onChange={event => setSaveWorkshop(event.target.value)} options={(dropdownConfig.kas_account || ['KING', 'TABUNGAN']).map(account => ({ value: account, label: account }))} />
                </label>
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-4 border-t border-white/5">
              <button type="button" onClick={() => setSaveModalOpen(false)} className="btn-secondary px-4 py-2 text-sm">Batal</button>
              <button type="button" onClick={handleSaveSubmit} disabled={saving || payrollData.items.some(item => item.total < 0)} className="btn-primary px-4 py-2 text-sm flex items-center gap-2 disabled:opacity-50">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                Proses Pembayaran
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
