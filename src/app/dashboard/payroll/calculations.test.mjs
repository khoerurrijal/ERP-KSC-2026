import assert from 'node:assert/strict'
import test from 'node:test'

import {
  applyProductionReconciliationToPayrollLogs,
  calculatePayrollItems,
  hasMatchingPayrollProductionSnapshot
} from './calculations.mjs'
import { reconcileProductionColorPasses } from '../../../utils/productionColorPasses.mjs'

const employeeId = 'operator-mesin'
const casaJobId = 'casa-two-color'
const otherTwoColorJobId = 'other-two-color'

const jobs = [
  { id: casaJobId, notes: '🎨 2 Warna', qty: 2000, unit_multiplier: 1 },
  { id: otherTwoColorJobId, notes: '🎨 2 Warna', qty: 1000, unit_multiplier: 1 },
  ...Array.from({ length: 11 }, (_, index) => ({
    id: `one-color-${index}`,
    notes: '',
    qty: 5000,
    unit_multiplier: 1
  }))
]

const rawProductionLogs = [
  { id: 'nov9-a', job_id: 'one-color-0', employee_id: employeeId, qty_processed: 1000, processed_date: '2026-11-09', created_at: '2026-11-09T09:51:02Z', notes: '' },
  { id: 'nov9-b', job_id: 'one-color-1', employee_id: employeeId, qty_processed: 1000, processed_date: '2026-11-09', created_at: '2026-11-09T09:52:15Z', notes: '' },
  { id: 'nov9-c', job_id: 'one-color-2', employee_id: employeeId, qty_processed: 500, processed_date: '2026-11-09', created_at: '2026-11-09T09:55:01Z', notes: '' },
  { id: 'nov9-d', job_id: 'one-color-3', employee_id: employeeId, qty_processed: 1000, processed_date: '2026-11-09', created_at: '2026-11-09T09:56:34Z', notes: '' },
  { id: 'nov10-one', job_id: 'one-color-4', employee_id: employeeId, qty_processed: 2000, processed_date: '2026-11-10', created_at: '2026-11-10T09:55:12Z', notes: '' },
  { id: 'nov10-two', job_id: otherTwoColorJobId, employee_id: employeeId, qty_processed: 1000, processed_date: '2026-11-10', created_at: '2026-11-10T09:56:06Z', notes: '' },
  { id: 'nov11-other-w2', job_id: otherTwoColorJobId, employee_id: employeeId, qty_processed: 1000, processed_date: '2026-11-11', created_at: '2026-11-11T09:43:06Z', notes: 'Warna kedua' },
  { id: 'casa-w1-first', job_id: casaJobId, employee_id: employeeId, qty_processed: 1000, processed_date: '2026-11-11', created_at: '2026-11-11T09:43:42Z', notes: 'Warna ke 1' },
  { id: 'casa-w2-canceled', job_id: casaJobId, employee_id: employeeId, qty_processed: 1000, processed_date: '2026-11-11', created_at: '2026-11-11T09:43:59Z', notes: 'Warna ke 2' },
  { id: 'casa-unmarked-canceled', job_id: casaJobId, employee_id: employeeId, qty_processed: 1000, processed_date: '2026-10-31', created_at: '2026-11-12T04:29:22Z', notes: '' },
  { id: 'casa-admin-correction', job_id: casaJobId, employee_id: null, qty_processed: -2000, processed_date: '2026-11-12', created_at: '2026-11-12T10:05:02Z', notes: 'Koreksi Qty oleh Admin' },
  { id: 'casa-w1-reentered', job_id: casaJobId, employee_id: employeeId, qty_processed: 1000, processed_date: '2026-11-11', created_at: '2026-11-12T10:05:26Z', notes: 'Warna ke 1' },
  { id: 'casa-w1-over-target', job_id: casaJobId, employee_id: employeeId, qty_processed: 1000, processed_date: '2026-11-11', created_at: '2026-11-13T07:06:14Z', notes: '[[WARNA_PASS:1]]' },
  { id: 'nov12-one', job_id: 'one-color-5', employee_id: employeeId, qty_processed: 2000, processed_date: '2026-11-12', created_at: '2026-11-12T09:54:53Z', notes: '' },
  { id: 'casa-w2-valid', job_id: casaJobId, employee_id: employeeId, qty_processed: 2000, processed_date: '2026-11-12', created_at: '2026-11-13T17:10:12Z', notes: '[[WARNA_PASS:2]]' },
  { id: 'nov13-one-a', job_id: 'one-color-6', employee_id: employeeId, qty_processed: 500, processed_date: '2026-11-13', created_at: '2026-11-13T09:45:19Z', notes: '' },
  { id: 'nov13-one-b', job_id: 'one-color-7', employee_id: employeeId, qty_processed: 1000, processed_date: '2026-11-13', created_at: '2026-11-13T09:45:40Z', notes: '' },
  { id: 'nov13-one-c', job_id: 'one-color-8', employee_id: employeeId, qty_processed: 500, processed_date: '2026-11-13', created_at: '2026-11-13T09:45:50Z', notes: '' },
  { id: 'nov13-one-d', job_id: 'one-color-9', employee_id: employeeId, qty_processed: 1000, processed_date: '2026-11-13', created_at: '2026-11-13T09:46:11Z', notes: '' },
  { id: 'nov13-one-e', job_id: 'one-color-10', employee_id: employeeId, qty_processed: 1000, processed_date: '2026-11-13', created_at: '2026-11-13T09:46:35Z', notes: '' },
  { id: 'casa-w1-over-target-2', job_id: casaJobId, employee_id: employeeId, qty_processed: 2000, processed_date: '2026-11-13', created_at: '2026-11-13T10:19:38Z', notes: '[[WARNA_PASS:1]]' }
]

const employee = {
  id: employeeId,
  full_name: 'Operator Mesin',
  gaji_harian: 0,
  uang_makan: 0,
  bonus_mingguan: 0,
  salary_schemas: {
    role_name: 'Operator Mesin',
    rate_borongan_sendiri: 20,
    rate_produksi_bawahan: 0,
    batas_qty_bonus_harian: 3000,
    bonus_harian_dibawah_target: 35000,
    batas_qty_target_harian: 5000,
    bonus_target_harian: 20000
  }
}

function calculateWithLogs(logs, attendanceRows = []) {
  return calculatePayrollItems({
    employees: [employee],
    productionLogs: logs,
    attendanceRows,
    loans: [],
    startDate: '2026-11-09',
    endDate: '2026-11-13'
  }).items[0]
}

test('payroll uses the same reconciled two-color quantities as production', () => {
  const reconciliation = reconcileProductionColorPasses(jobs, rawProductionLogs)
  const periodLogs = rawProductionLogs.filter(log => (
    log.employee_id && log.processed_date >= '2026-11-09' && log.processed_date <= '2026-11-13'
  ))
  const attendanceRows = ['2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13']
    .map(attendance_date => ({ employee_id: employeeId, attendance_date, status: 'Hadir' }))
  const rawItem = calculateWithLogs(periodLogs, attendanceRows)
  const twoColorJobIds = new Set([casaJobId, otherTwoColorJobId])
  const reconciledLogs = applyProductionReconciliationToPayrollLogs(periodLogs, reconciliation)
    .map(log => ({ ...log, is_two_color: twoColorJobIds.has(log.job_id) }))
  const payrollItem = calculateWithLogs(reconciledLogs, attendanceRows)

  assert.equal(rawItem.myQty, 21500)
  assert.equal(payrollItem.myQty, 17500)
  assert.equal(payrollItem.dailyQty['2026-11-11'], 3000)
  assert.equal(payrollItem.dailyQty['2026-11-13'], 4000)
  assert.equal(payrollItem.borongan_amount, 350000)
  assert.equal(payrollItem.twoColorQty, 3000)
  assert.equal(payrollItem.two_color_amount, 30000)
  assert.equal(payrollItem.other_bonuses, 0)
})

test('one-color payroll quantities remain unchanged by reconciliation', () => {
  const oneColorJob = { id: 'one-color', notes: '', qty: 1000, unit_multiplier: 1 }
  const oneColorLog = {
    id: 'one-color-log',
    job_id: oneColorJob.id,
    employee_id: employeeId,
    qty_processed: 500,
    processed_date: '2026-11-13',
    created_at: '2026-11-13T12:00:00Z',
    notes: ''
  }
  const reconciliation = reconcileProductionColorPasses([oneColorJob], [oneColorLog])
  const reconciledLogs = applyProductionReconciliationToPayrollLogs([oneColorLog], reconciliation)

  assert.equal(reconciledLogs[0].qty_processed, 500)
  assert.equal(calculateWithLogs(reconciledLogs, [
    { employee_id: employeeId, attendance_date: '2026-11-13', status: 'Hadir' }
  ]).myQty, 500)
})

test('machine operator gets no personal or subordinate production pay on absent dates', () => {
  const operatorMachine = {
    ...employee,
    gaji_harian: 10000,
    salary_schemas: { ...employee.salary_schemas, rate_produksi_bawahan: 5 }
  }
  const operatorSablon = {
    id: 'operator-sablon',
    full_name: 'Operator Sablon',
    supervisor_id: employeeId,
    salary_schemas: { role_name: 'Operator' }
  }
  const result = calculatePayrollItems({
    employees: [operatorMachine, operatorSablon],
    productionLogs: [
      { employee_id: employeeId, qty_processed: 4000, processed_date: '2026-11-09' },
      { employee_id: employeeId, qty_processed: 6000, processed_date: '2026-11-10', is_two_color: true, color_pass: 2 },
      { employee_id: operatorSablon.id, qty_processed: 1000, processed_date: '2026-11-09' },
      { employee_id: operatorSablon.id, qty_processed: 5000, processed_date: '2026-11-10' }
    ],
    attendanceRows: [
      { employee_id: employeeId, attendance_date: '2026-11-09', status: 'Hadir' },
      { employee_id: employeeId, attendance_date: '2026-11-10', status: 'Tidak Hadir' }
    ],
    loans: [],
    startDate: '2026-11-09',
    endDate: '2026-11-10'
  }).items[0]

  assert.equal(result.attendance_days, 1)
  assert.equal(result.myQty, 4000)
  assert.equal(result.dailyQty['2026-11-10'] || 0, 0)
  assert.equal(result.twoColorQty, 0)
  assert.equal(result.borongan_amount, 80000)
  assert.equal(result.bawahanQtyTotal, 1000)
  assert.equal(result.bawahan_bonus, 5000)
})

test('payroll save accepts an unchanged production snapshot despite edited pay components', () => {
  const production = {
    qty: 500,
    piecework_qty: 500,
    two_color_qty: 0,
    subordinate_qty: 0,
    daily_qty: { '2026-11-13': 500 },
    daily_two_color_qty: {},
    low_production_pay_dates: [],
    low_production_pay_top_up: 0
  }
  assert.equal(hasMatchingPayrollProductionSnapshot(
    { production, component_amounts: { overtime_amount: 10000 } },
    { production: { ...production }, component_amounts: { overtime_amount: 0 } }
  ), true)
})

test('payroll save rejects production edits after preview, including changed W2 allocation', () => {
  const preview = {
    production: {
      qty: 1000,
      piecework_qty: 1000,
      two_color_qty: 500,
      subordinate_qty: 0,
      daily_qty: { '2026-11-13': 1000 },
      daily_two_color_qty: { '2026-11-13': 500 },
      low_production_pay_dates: [],
      low_production_pay_top_up: 0
    }
  }
  const current = {
    production: {
      ...preview.production,
      daily_two_color_qty: { '2026-11-13': 0 }
    }
  }
  assert.equal(hasMatchingPayrollProductionSnapshot(preview, current), false)
})
