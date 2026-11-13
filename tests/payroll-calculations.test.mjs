import test from 'node:test'
import assert from 'node:assert/strict'
import { allocateLoanDeductions, calculatePayrollItems, calculatePayrollTotals } from '../src/app/dashboard/payroll/calculations.mjs'

const schema = overrides => ({
  role_name: 'Operator',
  gaji_harian: 50000,
  uang_makan: 10000,
  bonus_mingguan: 60000,
  rate_borongan_sendiri: 5,
  rate_produksi_bawahan: 8,
  batas_qty_bonus_harian: 1000,
  bonus_harian_dibawah_target: 2000,
  batas_qty_target_harian: 5000,
  bonus_target_harian: 3000,
  ...overrides
})

const employee = (id, role, overrides = {}) => {
  const salarySchema = schema({ role_name: role, ...overrides })
  return {
    id,
    full_name: id,
    supervisor_id: null,
    gaji_harian: salarySchema.gaji_harian,
    uang_makan: salarySchema.uang_makan,
    bonus_mingguan: salarySchema.bonus_mingguan,
    salary_schemas: salarySchema
  }
}

const attendanceFor = (employeeId, dates, status = 'Hadir') => dates.map(attendance_date => ({
  employee_id: employeeId,
  attendance_date,
  status
}))

test('only Hadir on Monday-Saturday earns daily pay and meal; missing and Sunday attendance are unpaid', () => {
  const { items } = calculatePayrollItems({
    employees: [employee('operator', 'Operator')],
    productionLogs: [],
    attendanceRows: [
      ...attendanceFor('operator', ['2026-11-02', '2026-11-03']),
      ...attendanceFor('operator', ['2026-11-04'], 'Izin'),
      ...attendanceFor('operator', ['2026-11-08'])
    ],
    loans: [],
    startDate: '2026-11-02',
    endDate: '2026-11-08'
  })

  assert.equal(items[0].attendance_days, 2)
  assert.equal(items[0].base_salary, 100000)
  assert.equal(items[0].meal_allowance, 20000)
})

test('late deductions sum only on attended dates inside the payroll period', () => {
  const { items } = calculatePayrollItems({
    employees: [employee('operator', 'Operator')],
    productionLogs: [],
    attendanceRows: [
      { employee_id: 'operator', attendance_date: '2026-11-02', status: 'Hadir', late_deduction: 2000 },
      { employee_id: 'operator', attendance_date: '2026-11-03', status: 'Alpa', late_deduction: 5000 },
      { employee_id: 'operator', attendance_date: '2026-11-08', status: 'Hadir', late_deduction: 9000 },
      { employee_id: 'operator', attendance_date: '2026-11-09', status: 'Hadir', late_deduction: 3000 }
    ],
    loans: [],
    startDate: '2026-11-02',
    endDate: '2026-11-08'
  })

  assert.equal(items[0].late_deduction, 2000)
  assert.equal(items[0].total_deductions, 2000)
})

test('piecework and the fixed second-color premium use production quantity for operator roles only', () => {
  const { items } = calculatePayrollItems({
    employees: [employee('operator', 'Operator'), employee('machine', 'Operator Mesin'), employee('admin', 'Admin')],
    productionLogs: [
      { employee_id: 'operator', processed_date: '2026-11-03', qty_processed: 100, is_two_color: true, color_pass: 1 },
      { employee_id: 'operator', processed_date: '2026-11-04', qty_processed: 100, is_two_color: true, color_pass: 2 },
      { employee_id: 'machine', processed_date: '2026-11-03', qty_processed: 50, is_two_color: true, color_pass: 2 },
      { employee_id: 'admin', processed_date: '2026-11-03', qty_processed: 25, is_two_color: true, color_pass: 2 }
    ],
    attendanceRows: [],
    loans: [],
    startDate: '2026-11-02',
    endDate: '2026-11-07'
  })

  assert.equal(items[0].borongan_amount, 1000)
  assert.equal(items[0].two_color_amount, 1000)
  assert.equal(items[1].two_color_amount, 500)
  assert.equal(items[2].twoColorQty, 0)
  assert.equal(items[2].two_color_amount, 0)
})

test('Operator Mesin earns the schema target bonus at exactly 5,000 pcs', () => {
  const { items } = calculatePayrollItems({
    employees: [employee('machine', 'Operator Mesin', {
      gaji_harian: 0,
      uang_makan: 0,
      bonus_mingguan: 0,
      rate_borongan_sendiri: 20,
      batas_qty_bonus_harian: 3000,
      bonus_harian_dibawah_target: 35000,
      batas_qty_target_harian: 5000,
      bonus_target_harian: 20000
    })],
    productionLogs: [
      { employee_id: 'machine', processed_date: '2026-11-07', qty_processed: 5000 }
    ],
    attendanceRows: [],
    loans: [],
    startDate: '2026-11-02',
    endDate: '2026-11-07'
  })

  assert.equal(items[0].borongan_amount, 100000)
  assert.equal(items[0].other_bonuses, 20000)
  assert.equal(items[0].weekly_bonus, 0)
})

test('Operator Mesin under 3,000 pcs gets minimum attended-day pay instead of piecework', () => {
  const { items } = calculatePayrollItems({
    employees: [employee('machine', 'Operator Mesin', {
      gaji_harian: 0,
      uang_makan: 0,
      bonus_mingguan: 0,
      rate_borongan_sendiri: 20,
      batas_qty_bonus_harian: 3000,
      bonus_harian_dibawah_target: 35000,
      batas_qty_target_harian: 5000,
      bonus_target_harian: 20000
    })],
    productionLogs: [
      { employee_id: 'machine', processed_date: '2026-11-02', qty_processed: 2500 },
      { employee_id: 'machine', processed_date: '2026-11-03', qty_processed: 3000 }
    ],
    attendanceRows: attendanceFor('machine', ['2026-11-02', '2026-11-03']),
    loans: [],
    startDate: '2026-11-02',
    endDate: '2026-11-07'
  })

  assert.equal(items[0].base_salary, 35000)
  assert.equal(items[0].borongan_amount, 60000)
  assert.equal(items[0].other_bonuses, 0)
  assert.deepEqual(items[0].calculation_snapshot.production.low_production_pay_dates, ['2026-11-02'])
})

test('subordinate bonus only accrues to the assigned Operator Mesin from Operator production', () => {
  const employees = [
    { ...employee('machine', 'Operator Mesin'), salary_schemas: schema({ role_name: 'Operator Mesin', rate_produksi_bawahan: 8 }) },
    { ...employee('operator', 'Operator'), supervisor_id: 'machine' },
    employee('admin', 'Admin')
  ]
  const { items } = calculatePayrollItems({
    employees,
    productionLogs: [
      { employee_id: 'operator', processed_date: '2026-11-03', qty_processed: 100 },
      { employee_id: 'machine', processed_date: '2026-11-03', qty_processed: 10 }
    ],
    attendanceRows: [],
    loans: [],
    startDate: '2026-11-02',
    endDate: '2026-11-07'
  })

  assert.equal(items[0].bawahanQtyTotal, 100)
  assert.equal(items[0].bawahan_bonus, 800)
  assert.equal(items[1].bawahan_bonus, 0)
  assert.equal(items[2].bawahan_bonus, 0)
})

test('weekly bonus requires all six attended days and is counted only for Saturdays in the period', () => {
  const week = ['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07']
  const { items } = calculatePayrollItems({
    employees: [employee('full', 'Operator'), employee('missing', 'Operator')],
    productionLogs: [],
    attendanceRows: attendanceFor('full', week).concat(attendanceFor('missing', week.slice(0, 5))),
    loans: [],
    startDate: '2026-11-02',
    endDate: '2026-11-07'
  })

  assert.equal(items[0].weekly_bonus_weeks, 1)
  assert.equal(items[0].weekly_bonus, 60000)
  assert.equal(items[1].weekly_bonus_weeks, 0)
  assert.equal(items[1].weekly_bonus, 0)
})

test('weekly bonus is allocated to the period containing Saturday, even when the week starts earlier', () => {
  const fullWeek = ['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07']
  const { items: saturdayPayroll } = calculatePayrollItems({
    employees: [employee('operator', 'Operator')],
    productionLogs: [],
    attendanceRows: attendanceFor('operator', fullWeek),
    loans: [],
    startDate: '2026-11-07',
    endDate: '2026-11-07'
  })
  const { items: alreadyPaidSaturday } = calculatePayrollItems({
    employees: [employee('operator', 'Operator')],
    productionLogs: [],
    attendanceRows: attendanceFor('operator', fullWeek),
    loans: [],
    startDate: '2026-11-07',
    endDate: '2026-11-07',
    blockedWeekSaturdays: ['2026-11-07']
  })

  assert.equal(saturdayPayroll[0].weekly_bonus, 60000)
  assert.equal(alreadyPaidSaturday[0].weekly_bonus, 0)
})

test('earnings, overtime, kasbon, loan, and lateness are separated into gross, deductions, and net', () => {
  assert.deepEqual(calculatePayrollTotals({
    base_salary: 300000,
    meal_allowance: 30000,
    borongan_amount: 50000,
    two_color_amount: 10000,
    weekly_bonus: 20000,
    bawahan_bonus: 5000,
    other_bonuses: 7000,
    overtime_amount: 12000,
    kasbon_amount: 25000,
    pinjaman_amount: 15000,
    late_deduction: 5000
  }), { gross_total: 434000, total_deductions: 45000, total: 389000 })
})

test('loan deductions are allocated FIFO within each loan type and cannot exceed available installments', () => {
  const allocation = allocateLoanDeductions([
    { id: 'k1', type: 'KASBON', remaining_amount: 20000 },
    { id: 'p1', type: 'PINJAMAN', remaining_amount: 100000, installment_amount: 30000 },
    { id: 'k2', type: 'KASBON', remaining_amount: 40000 },
    { id: 'p2', type: 'PINJAMAN', remaining_amount: 50000, installment_amount: 20000 }
  ], 25000, 40000)

  assert.deepEqual(allocation.allocations.map(({ id, amount, new_remaining_amount }) => ({ id, amount, new_remaining_amount })), [
    { id: 'k1', amount: 20000, new_remaining_amount: 0 },
    { id: 'p1', amount: 30000, new_remaining_amount: 70000 },
    { id: 'k2', amount: 5000, new_remaining_amount: 35000 },
    { id: 'p2', amount: 10000, new_remaining_amount: 40000 }
  ])
  assert.equal(allocation.kasbon_remaining, 0)
  assert.equal(allocation.pinjaman_remaining, 0)
})

test('kasbon and loan installments retain existing deduction rules and snapshot rates/components', () => {
  const sourceSchema = schema()
  const { items } = calculatePayrollItems({
    employees: [employee('operator', 'Operator', sourceSchema)],
    productionLogs: [{ employee_id: 'operator', processed_date: '2026-11-03', qty_processed: 100, is_two_color: true, color_pass: 1 }],
    attendanceRows: attendanceFor('operator', ['2026-11-03']),
    loans: [
      { id: 'k1', employee_id: 'operator', type: 'KASBON', remaining_amount: 25000 },
      { id: 'p1', employee_id: 'operator', type: 'PINJAMAN', remaining_amount: 90000, installment_amount: 30000 }
    ],
    startDate: '2026-11-02',
    endDate: '2026-11-07'
  })
  const savedSnapshot = structuredClone(items[0].calculation_snapshot)
  sourceSchema.gaji_harian = 999999

  assert.equal(items[0].kasbon_amount, 25000)
  assert.equal(items[0].pinjaman_amount, 30000)
  assert.equal(items[0].gross_total, 62500)
  assert.equal(items[0].total_deductions, 55000)
  assert.equal(items[0].total, 7500)
  assert.equal(items[0].two_color_amount, 0)
  assert.equal(items[0].calculation_snapshot.rates.daily, 50000)
  assert.deepEqual(items[0].calculation_snapshot, savedSnapshot)
})
