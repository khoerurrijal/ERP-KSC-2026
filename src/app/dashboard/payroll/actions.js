'use server'

import { createAuthorizedAdminClient } from '@/lib/adminAuth'
import { revalidatePath } from 'next/cache'
import { allocateLoanDeductions, calculatePayrollItems, calculatePayrollTotals, filterLoansAvailableForPayroll, getPayrollLedgerAmount, getPayrollWeekStart } from './calculations.mjs'
import { inferProductionColorPasses } from '@/utils/productionColorPasses.mjs'

const DAY_MS = 24 * 60 * 60 * 1000

function isAttendanceEligible(employee) {
  const schema = Array.isArray(employee.salary_schemas)
    ? employee.salary_schemas[0]
    : employee.salary_schemas
  const role = String(schema?.role_name || '').trim().toLowerCase()
  const name = String(employee.full_name || '').trim().toLowerCase()
  return role !== 'owner' && name !== 'king sablon cup'
}

function getWorkWeekDates(referenceDate) {
  const weekStart = getPayrollWeekStart(referenceDate)
  const start = new Date(`${weekStart}T00:00:00.000Z`)
  const dates = Array.from({ length: 6 }, (_, index) => new Date(start.getTime() + index * DAY_MS).toISOString().slice(0, 10))
  return { weekStart, weekEnd: dates[dates.length - 1], dates }
}

function assertDate(value, label) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) throw new Error(`${label} tidak valid.`)
  const parsed = new Date(`${value}T00:00:00.000Z`)
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new Error(`${label} tidak valid.`)
  }
}

function amount(value, label) {
  const result = Number(value ?? 0)
  if (!Number.isFinite(result) || result < 0) throw new Error(`${label} harus berupa angka nol atau lebih.`)
  return result
}

async function findOverlappingPayroll(supabase, startDate, endDate) {
  const { data, error } = await supabase
    .from('payrolls')
    .select('id, start_date, end_date')
    .lte('start_date', endDate)
    .gte('end_date', startDate)
    .limit(1)
  if (error) throw error
  return data?.[0] || null
}

export async function getWeeklyAttendance(referenceDate) {
  const { supabase } = await createAuthorizedAdminClient(['ADMIN', 'OWNER'])
  try {
    assertDate(referenceDate, 'Tanggal absensi')
    const { weekStart, weekEnd, dates } = getWorkWeekDates(referenceDate)
    const [employeeResult, attendanceResult, payrollResult] = await Promise.all([
      supabase
        .from('employees')
        .select('id, full_name, salary_schemas(role_name)')
        .eq('is_active', true)
        .order('full_name', { ascending: true }),
      supabase
        .from('employee_attendance')
        .select('employee_id, attendance_date, status, late_deduction')
        .gte('attendance_date', weekStart)
        .lte('attendance_date', weekEnd),
      supabase
        .from('payrolls')
        .select('start_date, end_date')
        .lte('start_date', weekEnd)
        .gte('end_date', weekStart)
    ])
    if (employeeResult.error) throw employeeResult.error
    if (attendanceResult.error) throw attendanceResult.error
    if (payrollResult.error) throw payrollResult.error

    const lockedDates = dates.filter(date => (payrollResult.data || []).some(payroll => payroll.start_date <= date && payroll.end_date >= date))
    const byEmployeeDate = new Map((attendanceResult.data || []).map(record => [`${record.employee_id}:${record.attendance_date}`, record]))
    return {
      success: true,
      weekStart,
      weekEnd,
      dates,
      lockedDates,
      employees: (employeeResult.data || []).filter(isAttendanceEligible).map(employee => {
        const schema = Array.isArray(employee.salary_schemas)
          ? employee.salary_schemas[0]
          : employee.salary_schemas
        return {
          id: employee.id,
          full_name: employee.full_name,
          role_name: schema?.role_name || '-',
          attendance: Object.fromEntries(dates.map(date => [date, byEmployeeDate.get(`${employee.id}:${date}`)?.status === 'Hadir'])),
          lateDeduction: Object.fromEntries(dates.map(date => [date, Number(byEmployeeDate.get(`${employee.id}:${date}`)?.late_deduction || 0)]))
        }
      })
    }
  } catch (err) {
    console.error('Error loading weekly attendance:', err)
    return { success: false, error: err.message || 'Gagal memuat absensi mingguan.' }
  }
}

export async function saveWeeklyAttendance(referenceDate, records) {
  const { supabase, user } = await createAuthorizedAdminClient(['ADMIN', 'OWNER'])
  try {
    assertDate(referenceDate, 'Tanggal absensi')
    const { weekStart, weekEnd, dates } = getWorkWeekDates(referenceDate)
    if (!Array.isArray(records)) throw new Error('Data absensi mingguan tidak valid.')

    const { data: overlappingPayrolls, error: payrollError } = await supabase
      .from('payrolls')
      .select('start_date, end_date')
      .lte('start_date', weekEnd)
      .gte('end_date', weekStart)
    if (payrollError) throw payrollError
    const lockedDates = new Set(dates.filter(date => (overlappingPayrolls || []).some(payroll => payroll.start_date <= date && payroll.end_date >= date)))
    const todayJakarta = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit'
    }).format(new Date())
    const editableDates = dates.filter(date => !lockedDates.has(date) && date <= todayJakarta)
    if (!editableDates.length) throw new Error('Belum ada tanggal minggu ini yang bisa disimpan.')

    const { data: activeEmployees, error: employeesError } = await supabase
      .from('employees')
      .select('id, full_name, salary_schemas(role_name)')
      .eq('is_active', true)
    if (employeesError) throw employeesError
    const attendanceEmployees = (activeEmployees || []).filter(isAttendanceEligible)
    if (!attendanceEmployees.length) throw new Error('Belum ada karyawan aktif untuk diabsen.')
    const activeIds = new Set(attendanceEmployees.map(employee => employee.id))
    const uniqueRecords = new Map()
    for (const record of records) {
      const employeeId = record?.employee_id || record?.id
      if (!activeIds.has(employeeId)) throw new Error('Daftar karyawan berubah. Muat ulang absensi.')
      if (!record.attendance || typeof record.attendance !== 'object' || Array.isArray(record.attendance)) {
        throw new Error('Data kehadiran karyawan tidak valid.')
      }
      for (const [date, isPresent] of Object.entries(record.attendance)) {
        if (!dates.includes(date) || typeof isPresent !== 'boolean') throw new Error('Data kehadiran harian tidak valid.')
      }
      if (record.lateDeduction != null && (typeof record.lateDeduction !== 'object' || Array.isArray(record.lateDeduction))) {
        throw new Error('Data terlambat karyawan tidak valid.')
      }
      for (const [date, value] of Object.entries(record.lateDeduction || {})) {
        const parsed = Number(value || 0)
        if (!dates.includes(date) || !Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed < 0) {
          throw new Error('Nominal terlambat harus berupa angka rupiah nol atau lebih.')
        }
      }
      uniqueRecords.set(employeeId, record)
    }

    const rows = editableDates.flatMap(date => attendanceEmployees.map(employee => {
      const record = uniqueRecords.get(employee.id)
      const isPresent = record?.attendance?.[date] === true
      return {
        employee_id: employee.id,
        attendance_date: date,
        status: isPresent ? 'Hadir' : 'Alpa',
        late_deduction: isPresent ? Number(record?.lateDeduction?.[date] || 0) : 0,
        note: null,
        updated_at: new Date().toISOString(),
        updated_by: user?.id || null
      }
    }))
    const { error } = await supabase
      .from('employee_attendance')
      .upsert(rows, { onConflict: 'employee_id,attendance_date' })
    if (error) throw error

    revalidatePath('/dashboard/payroll')
    const presentCount = rows.filter(row => row.status === 'Hadir').length
    return { success: true, savedDays: editableDates.length, savedCount: rows.length, presentCount, absentCount: rows.length - presentCount }
  } catch (err) {
    console.error('Error saving weekly attendance:', err)
    return { success: false, error: err.message || 'Gagal menyimpan absensi mingguan.' }
  }
}

export async function calculatePayroll(startDate, endDate) {
  const { supabase } = await createAuthorizedAdminClient(['ADMIN', 'OWNER'])
  try {
    assertDate(startDate, 'Tanggal awal')
    assertDate(endDate, 'Tanggal akhir')
    if (startDate > endDate) throw new Error('Tanggal awal tidak boleh lebih besar dari tanggal akhir.')

    const overlappingPayroll = await findOverlappingPayroll(supabase, startDate, endDate)
    if (overlappingPayroll) {
      throw new Error(`Periode bertabrakan dengan rekap tersimpan ${overlappingPayroll.start_date} s/d ${overlappingPayroll.end_date}.`)
    }

    const attendanceStart = getPayrollWeekStart(startDate)
    const [employeeResult, logResult, attendanceResult, loanResult] = await Promise.all([
      supabase
        .from('employees')
        .select(`
          id, full_name, supervisor_id, is_active, gaji_harian, uang_makan, bonus_mingguan,
          salary_schemas (
            role_name,
            rate_borongan_sendiri, rate_produksi_bawahan,
            batas_qty_bonus_harian, bonus_harian_dibawah_target,
            batas_qty_target_harian, bonus_target_harian
          )
        `)
        .eq('is_active', true),
      supabase
        .from('production_logs')
        .select('id, employee_id, job_id, qty_processed, processed_date, created_at, notes')
        .gte('processed_date', startDate)
        .lte('processed_date', endDate),
      supabase
        .from('employee_attendance')
        .select('employee_id, attendance_date, status, late_deduction')
        .gte('attendance_date', attendanceStart)
        .lte('attendance_date', endDate),
      supabase
        .from('employee_loans')
        .select('id, employee_id, type, remaining_amount, installment_amount, disbursed_date, created_at')
        .eq('status', 'BELUM LUNAS')
    ])
    if (employeeResult.error) throw employeeResult.error
    if (logResult.error) throw logResult.error
    if (attendanceResult.error) throw attendanceResult.error
    if (loanResult.error) throw loanResult.error

    const jobIds = [...new Set((logResult.data || []).map(log => log.job_id).filter(Boolean))]
    let twoColorJobs = new Set()
    let inferredColorPasses = new Map()
    if (jobIds.length) {
      const { data: salesItems, error: salesItemsError } = await supabase
        .from('sales_items')
        .select('id, notes, qty, unit_multiplier')
        .in('id', jobIds)
      if (salesItemsError) throw salesItemsError
      const twoColorItems = (salesItems || [])
        .filter(item => /2\s*warna|warna\s*ke-?2/i.test(item.notes || ''))
      twoColorJobs = new Set(twoColorItems.map(item => item.id))

      const { data: allJobLogs, error: allJobLogsError } = await supabase
        .from('production_logs')
        .select('id, job_id, qty_processed, processed_date, created_at, notes')
        .in('job_id', jobIds)
      if (allJobLogsError) throw allJobLogsError
      inferredColorPasses = inferProductionColorPasses(twoColorItems, allJobLogs || [])
    }

    const productionLogs = (logResult.data || []).map(log => ({
      ...log,
      is_two_color: twoColorJobs.has(log.job_id),
      color_pass: inferredColorPasses.get(String(log.id)) || null
    }))
    const payrollEmployees = (employeeResult.data || []).filter(isAttendanceEligible)
    const attendanceEmployeeIds = new Set(payrollEmployees.map(employee => employee.id))
    const { items } = calculatePayrollItems({
      employees: payrollEmployees,
      productionLogs,
      attendanceRows: (attendanceResult.data || []).filter(row => attendanceEmployeeIds.has(row.employee_id)),
      loans: filterLoansAvailableForPayroll(loanResult.data || [], endDate),
      startDate,
      endDate
    })

    return { success: true, items }
  } catch (err) {
    console.error('Error calculating payroll:', err)
    return { success: false, error: err.message || 'Gagal menghitung rekap gaji.' }
  }
}

export async function savePayroll(payload) {
  const { supabase, user } = await createAuthorizedAdminClient(['ADMIN', 'OWNER'])
  try {
    assertDate(payload?.startDate, 'Tanggal awal')
    assertDate(payload?.endDate, 'Tanggal akhir')
    if (payload.startDate > payload.endDate) throw new Error('Rentang periode gaji tidak valid.')
    if (!Array.isArray(payload.items) || payload.items.length === 0) throw new Error('Tidak ada karyawan di rekap ini.')

    const overlappingPayroll = await findOverlappingPayroll(supabase, payload.startDate, payload.endDate)
    if (overlappingPayroll) {
      throw new Error(`Periode bertabrakan dengan rekap tersimpan ${overlappingPayroll.start_date} s/d ${overlappingPayroll.end_date}.`)
    }

    // Validate all adjustments and current loan balances before writing any payroll rows.
    const validatedItems = []
    for (const item of payload.items) {
      const [baseSalary, mealAllowance, weeklyBonus, pieceworkAmount, subordinateBonus, dailyBonus,
        twoColorAmount, overtimeAmount, kasbonAmount, pinjamanAmount, lateDeduction] = [
        amount(item.base_salary, 'Gaji hadir'), amount(item.meal_allowance, 'Uang makan'),
        amount(item.weekly_bonus, 'Bonus mingguan'), amount(item.borongan_amount, 'Borongan'),
        amount(item.bawahan_bonus, 'Bonus bawahan'), amount(item.other_bonuses, 'Bonus harian'),
        amount(item.two_color_amount, 'Tambahan 2 warna'), amount(item.overtime_amount, 'Lembur'),
        amount(item.kasbon_amount, 'Potongan kasbon'), amount(item.pinjaman_amount, 'Potongan pinjaman'),
        amount(item.late_deduction, 'Potongan terlambat')
      ]

      const { data: activeLoans, error: activeLoansError } = await supabase
        .from('employee_loans')
        .select('id, remaining_amount, installment_amount, type, notes, disbursed_date, created_at')
        .eq('employee_id', item.employee_id)
        .eq('status', 'BELUM LUNAS')
        .order('created_at', { ascending: true })
      if (activeLoansError) throw activeLoansError

      const payrollLoans = filterLoansAvailableForPayroll(activeLoans || [], payload.endDate)
      const kasbonLimit = payrollLoans.filter(loan => loan.type === 'KASBON')
        .reduce((sum, loan) => sum + Number(loan.remaining_amount || 0), 0)
      const pinjamanLimit = payrollLoans.filter(loan => loan.type === 'PINJAMAN')
        .reduce((sum, loan) => sum + Math.min(Number(loan.installment_amount || 0), Number(loan.remaining_amount || 0)), 0)
      if (kasbonAmount > kasbonLimit || pinjamanAmount > pinjamanLimit) {
        throw new Error(`Potongan kasbon/pinjaman untuk ${item.employee_name} melebihi saldo atau cicilan yang tersedia. Hitung ulang rekap.`)
      }
      const loanAllocation = allocateLoanDeductions(payrollLoans, kasbonAmount, pinjamanAmount)
      if (loanAllocation.kasbon_remaining > 0 || loanAllocation.pinjaman_remaining > 0) {
        throw new Error(`Saldo kasbon/pinjaman ${item.employee_name} berubah. Hitung ulang rekap.`)
      }

      const payrollTotals = calculatePayrollTotals({
        base_salary: baseSalary,
        meal_allowance: mealAllowance,
        weekly_bonus: weeklyBonus,
        borongan_amount: pieceworkAmount,
        bawahan_bonus: subordinateBonus,
        other_bonuses: dailyBonus,
        two_color_amount: twoColorAmount,
        overtime_amount: overtimeAmount,
        kasbon_amount: kasbonAmount,
        pinjaman_amount: pinjamanAmount,
        late_deduction: lateDeduction
      })
      const { gross_total: grossTotal, total_deductions: totalDeductions, total: netTotal } = payrollTotals
      if (netTotal < 0) throw new Error(`Total potongan ${item.employee_name} melebihi pendapatan.`)

      validatedItems.push({
        item,
        activeLoans: payrollLoans,
        loanAllocations: loanAllocation.allocations,
        values: {
          baseSalary, mealAllowance, weeklyBonus, pieceworkAmount, subordinateBonus, dailyBonus,
          twoColorAmount, overtimeAmount, kasbonAmount, pinjamanAmount, lateDeduction,
          grossTotal, totalDeductions, netTotal,
          ledgerSalaryOut: getPayrollLedgerAmount({ total: netTotal, late_deduction: lateDeduction })
        }
      })
    }

    const { data: payrollRow, error: payrollError } = await supabase
      .from('payrolls')
      .insert([{
        start_date: payload.startDate,
        end_date: payload.endDate,
        generated_by: user?.id || null,
        total_amount: validatedItems.reduce((sum, row) => sum + row.values.netTotal, 0)
      }])
      .select('id')
      .single()
    if (payrollError) throw payrollError

    let recalculatedGrandTotal = 0
    let recalculatedLedgerTotal = 0
    const finalItemsToInsert = []

    for (const { item, activeLoans, loanAllocations, values } of validatedItems) {
      const appliedLoanDeductions = []

      for (const allocation of loanAllocations) {
        const loan = activeLoans.find(candidate => candidate.id === allocation.id)
        if (!loan) throw new Error(`Data pinjaman ${item.employee_name} berubah. Hitung ulang rekap.`)
        const { data: updatedLoan, error: updateLoanError } = await supabase
          .from('employee_loans')
          .update({ remaining_amount: allocation.new_remaining_amount, status: allocation.new_remaining_amount === 0 ? 'LUNAS' : 'BELUM LUNAS' })
          .eq('id', allocation.id)
          .eq('remaining_amount', allocation.old_remaining_amount)
          .select('id')
          .maybeSingle()
        if (updateLoanError) throw updateLoanError
        if (!updatedLoan) throw new Error(`Saldo pinjaman ${item.employee_name} baru saja berubah. Hentikan proses dan hitung ulang.`)

        const isLoan = allocation.type === 'PINJAMAN'
        if (isLoan) {
          const empName = item.employee_name || 'Karyawan'
          const { error: transactionError } = await supabase.from('transactions').insert([{
            date: new Date().toISOString().split('T')[0],
            reference: 'PINJAMAN',
            description: `Potongan cicilan pinjaman - ${empName}`,
            payment_method: 'CASH',
            amount_out: 0,
            amount_in: allocation.amount,
            workshop_code: 'TABUNGAN'
          }])
          if (transactionError) throw transactionError
        }
        appliedLoanDeductions.push({ id: loan.id, type: loan.type, amount: allocation.amount })
      }

      recalculatedGrandTotal += values.netTotal
      recalculatedLedgerTotal += values.ledgerSalaryOut
      const snapshot = {
        ...(item.calculation_snapshot || {}),
        component_amounts: {
          base_salary: values.baseSalary,
          meal_allowance: values.mealAllowance,
          borongan_amount: values.pieceworkAmount,
          two_color_amount: values.twoColorAmount,
          weekly_bonus: values.weeklyBonus,
          bawahan_bonus: values.subordinateBonus,
          daily_bonus: values.dailyBonus,
          overtime_amount: values.overtimeAmount,
          kasbon_amount: values.kasbonAmount,
          pinjaman_amount: values.pinjamanAmount,
          late_deduction: values.lateDeduction
        },
        loan_deductions_applied: appliedLoanDeductions
      }

      finalItemsToInsert.push({
        payroll_id: payrollRow.id,
        employee_id: item.employee_id,
        base_salary: values.baseSalary,
        meal_allowance: values.mealAllowance,
        weekly_bonus: values.weeklyBonus,
        borongan_amount: values.pieceworkAmount,
        bawahan_bonus: values.subordinateBonus,
        other_bonuses: values.dailyBonus,
        kasbon_amount: values.kasbonAmount,
        pinjaman_amount: values.pinjamanAmount,
        attendance_days: Number(item.attendance_days || 0),
        piecework_qty: Number(item.myQty || 0),
        piecework_rate: Number(item.piecework_rate || 0),
        two_color_qty: Number(item.twoColorQty || 0),
        two_color_rate: Number(item.two_color_rate || 0),
        two_color_amount: values.twoColorAmount,
        daily_bonus_amount: values.dailyBonus,
        overtime_amount: values.overtimeAmount,
        late_deduction: values.lateDeduction,
        gross_total: values.grossTotal,
        total_deductions: values.totalDeductions,
        weekly_bonus_weeks: Number(item.weekly_bonus_weeks || 0),
        calculation_snapshot: snapshot,
        total: values.netTotal
      })
    }

    const { error: payrollItemsError } = await supabase.from('payroll_items').insert(finalItemsToInsert)
    if (payrollItemsError) throw payrollItemsError

    const { error: updatePayrollError } = await supabase
      .from('payrolls')
      .update({ total_amount: recalculatedGrandTotal })
      .eq('id', payrollRow.id)
    if (updatePayrollError) throw updatePayrollError

    const { error: payrollTransactionError } = await supabase.from('transactions').insert([{
      date: new Date().toISOString().split('T')[0],
      reference: 'GAJI KARYAWAN',
      description: payload.description || 'Gaji Karyawan',
      payment_method: payload.payment_method || 'Cash',
      amount_out: recalculatedLedgerTotal,
      amount_in: 0,
      workshop_code: payload.workshop_code || 'KING'
    }])
    if (payrollTransactionError) throw payrollTransactionError

    revalidatePath('/dashboard/payroll')
    revalidatePath('/dashboard/transactions')
    return { success: true }
  } catch (err) {
    console.error('Error saving payroll:', err)
    return { success: false, error: err.message || 'Gagal menyimpan rekap gaji.' }
  }
}
