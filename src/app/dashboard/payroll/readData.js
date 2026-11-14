import 'server-only'

import { createAuthorizedAdminClient } from '@/lib/adminAuth'
import { getPayrollWeekStart } from './calculations.mjs'

const DAY_MS = 24 * 60 * 60 * 1000

function getJakartaDateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(date)
  const part = type => parts.find(item => item.type === type)?.value
  return `${part('year')}-${part('month')}-${part('day')}`
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

function isAttendanceEligible(employee) {
  const schema = Array.isArray(employee.salary_schemas)
    ? employee.salary_schemas[0]
    : employee.salary_schemas
  const role = String(schema?.role_name || '').trim().toLowerCase()
  const name = String(employee.full_name || '').trim().toLowerCase()
  return role !== 'owner' && name !== 'king sablon cup'
}

export async function loadWeeklyAttendanceData(supabase, referenceDate) {
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

  const lockedDates = dates.filter(date => (payrollResult.data || []).some(payroll => (
    payroll.start_date <= date && payroll.end_date >= date
  )))
  const byEmployeeDate = new Map((attendanceResult.data || []).map(record => [
    `${record.employee_id}:${record.attendance_date}`, record
  ]))

  return {
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
        attendance: Object.fromEntries(dates.map(date => [
          date,
          byEmployeeDate.get(`${employee.id}:${date}`)?.status === 'Hadir'
        ])),
        lateDeduction: Object.fromEntries(dates.map(date => [
          date,
          Number(byEmployeeDate.get(`${employee.id}:${date}`)?.late_deduction || 0)
        ]))
      }
    })
  }
}

export async function loadSavedPayrollSummaries(supabase) {
  const { data: payrolls, error } = await supabase
    .from('payrolls')
    .select('id, start_date, end_date, total_amount, created_at, payroll_items(employee_id)')
    .order('start_date', { ascending: false })
    .order('created_at', { ascending: false })
  if (error) throw error

  return (payrolls || []).map(payroll => ({
    id: payroll.id,
    startDate: payroll.start_date,
    endDate: payroll.end_date,
    totalAmount: Number(payroll.total_amount || 0),
    employeeCount: new Set((payroll.payroll_items || []).map(item => item.employee_id).filter(Boolean)).size
  }))
}

export async function getPayrollInitialPageData() {
  const { supabase } = await createAuthorizedAdminClient(['ADMIN', 'OWNER'])
  const today = getJakartaDateKey()
  const [settingsResult, attendanceResult, payrollsResult] = await Promise.all([
    supabase.from('system_settings').select('value').eq('key', 'dropdown_config').maybeSingle(),
    loadWeeklyAttendanceData(supabase, today)
      .then(data => ({ success: true, data }))
      .catch(error => ({ success: false, error: String(error?.message || error) })),
    loadSavedPayrollSummaries(supabase)
      .then(payrolls => ({ success: true, payrolls }))
      .catch(error => ({ success: false, error: String(error?.message || error) }))
  ])

  if (settingsResult.error) console.error('Error loading payroll dropdown settings:', settingsResult.error)
  return {
    dropdownConfig: settingsResult.data?.value || {},
    initialAttendance: attendanceResult.success
      ? { success: true, ...attendanceResult.data }
      : { success: false, error: attendanceResult.error },
    initialSavedPayrolls: payrollsResult
  }
}
