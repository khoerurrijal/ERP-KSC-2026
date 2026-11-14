const DAY_MS = 24 * 60 * 60 * 1000
const TWO_COLOR_RATE_PER_PIECE = 10

const toDate = value => new Date(`${value}T00:00:00.000Z`)
const dateKey = date => date.toISOString().slice(0, 10)
const jakartaDateKey = value => {
  if (!value) return ''
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return ''
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(date)
  const part = type => parts.find(item => item.type === type)?.value
  return `${part('year')}-${part('month')}-${part('day')}`
}
const roleOf = employee => {
  const schema = Array.isArray(employee.salary_schemas)
    ? employee.salary_schemas[0]
    : employee.salary_schemas
  return { schema: schema || {}, roleName: String(schema?.role_name || '').trim() }
}
const isOperator = roleName => ['operator', 'operator mesin'].includes(String(roleName).toLowerCase())
const isWeekday = date => date.getUTCDay() !== 0

export function calculatePayrollTotals(item) {
  const earnings = [
    'base_salary', 'meal_allowance', 'borongan_amount', 'two_color_amount',
    'weekly_bonus', 'bawahan_bonus', 'other_bonuses', 'overtime_amount'
  ].reduce((total, key) => total + Number(item[key] || 0), 0)
  const deductions = ['kasbon_amount', 'pinjaman_amount', 'late_deduction']
    .reduce((total, key) => total + Number(item[key] || 0), 0)
  return { gross_total: earnings, total_deductions: deductions, total: earnings - deductions }
}

export function getPayrollLedgerAmount(item) {
  return Number(item.total || 0) + Number(item.late_deduction || 0)
}

export function applyProductionReconciliationToPayrollLogs(productionLogs, reconciliation) {
  const effectiveQtyByLogId = reconciliation?.effectiveQtyByLogId
  const colorPassByLogId = reconciliation?.colorPassByLogId

  return (productionLogs || []).map(log => {
    const logId = String(log.id || '')
    return {
      ...log,
      qty_processed: effectiveQtyByLogId?.get(logId) ?? Number(log.qty_processed || 0),
      color_pass: colorPassByLogId?.get(logId) ?? log.color_pass ?? null
    }
  })
}

function normalizeDailyQuantities(quantities) {
  return Object.entries(quantities || {})
    .map(([day, qty]) => [day, Number(qty || 0)])
    .sort(([dayA], [dayB]) => dayA.localeCompare(dayB))
}

export function hasMatchingPayrollProductionSnapshot(previewSnapshot, currentSnapshot) {
  const preview = previewSnapshot?.production
  const current = currentSnapshot?.production
  if (!preview || !current) return false

  const quantityFields = [
    'qty', 'piecework_qty', 'two_color_qty', 'subordinate_qty', 'low_production_pay_top_up'
  ]
  if (!quantityFields.every(field => Number(preview[field] || 0) === Number(current[field] || 0))) return false

  const previewLowProductionDates = [...(preview.low_production_pay_dates || [])].sort()
  const currentLowProductionDates = [...(current.low_production_pay_dates || [])].sort()
  return JSON.stringify(normalizeDailyQuantities(preview.daily_qty)) === JSON.stringify(normalizeDailyQuantities(current.daily_qty)) &&
    JSON.stringify(normalizeDailyQuantities(preview.daily_two_color_qty)) === JSON.stringify(normalizeDailyQuantities(current.daily_two_color_qty)) &&
    JSON.stringify(previewLowProductionDates) === JSON.stringify(currentLowProductionDates)
}

export function allocateLoanDeductions(loans, kasbonAmount, pinjamanAmount) {
  let kasbonRemaining = Number(kasbonAmount || 0)
  let pinjamanRemaining = Number(pinjamanAmount || 0)
  const allocations = []

  for (const loan of loans || []) {
    const isKasbon = loan.type === 'KASBON'
    const isPinjaman = loan.type === 'PINJAMAN'
    if ((!isKasbon && !isPinjaman) || (isKasbon && kasbonRemaining <= 0) || (isPinjaman && pinjamanRemaining <= 0)) continue
    const remaining = Number(loan.remaining_amount || 0)
    const capacity = isPinjaman ? Math.min(remaining, Number(loan.installment_amount || 0)) : remaining
    const requested = isKasbon ? kasbonRemaining : pinjamanRemaining
    const deducted = Math.min(capacity, requested)
    if (deducted <= 0) continue
    if (isKasbon) kasbonRemaining -= deducted
    else pinjamanRemaining -= deducted
    allocations.push({
      id: loan.id,
      type: loan.type,
      old_remaining_amount: remaining,
      amount: deducted,
      new_remaining_amount: remaining - deducted
    })
  }

  return { allocations, kasbon_remaining: kasbonRemaining, pinjaman_remaining: pinjamanRemaining }
}

export function filterLoansAvailableForPayroll(loans, endDate) {
  return (loans || []).filter(loan => {
    const issuedDate = jakartaDateKey(loan.disbursed_date || loan.created_at)
    // Keep legacy outstanding balances with no usable date, while excluding loans
    // disbursed after the payroll period being calculated.
    return !issuedDate || issuedDate <= endDate
  })
}

export function getPayrollWeekStart(date) {
  const value = toDate(date)
  const daysSinceMonday = (value.getUTCDay() + 6) % 7
  return dateKey(new Date(value.getTime() - daysSinceMonday * DAY_MS))
}

export function calculatePayrollItems({
  employees,
  productionLogs,
  attendanceRows,
  loans,
  startDate,
  endDate,
  blockedWeekSaturdays = []
}) {
  const logsByEmployee = new Map()
  const logsByEmployeeDate = new Map()
  for (const log of productionLogs || []) {
    if (!log.employee_id) continue
    const employeeLogs = logsByEmployee.get(log.employee_id) || []
    employeeLogs.push(log)
    logsByEmployee.set(log.employee_id, employeeLogs)
    const key = `${log.employee_id}:${log.processed_date}`
    logsByEmployeeDate.set(key, (logsByEmployeeDate.get(key) || 0) + Number(log.qty_processed || 0))
  }

  const attendanceByEmployeeDate = new Map()
  for (const row of attendanceRows || []) {
    attendanceByEmployeeDate.set(`${row.employee_id}:${row.attendance_date}`, row)
  }

  const loansByEmployee = new Map()
  for (const loan of filterLoansAvailableForPayroll(loans, endDate)) {
    const bucket = loansByEmployee.get(loan.employee_id) || { kasbon: [], pinjaman: [] }
    if (loan.type === 'KASBON') bucket.kasbon.push(loan)
    if (loan.type === 'PINJAMAN') bucket.pinjaman.push(loan)
    loansByEmployee.set(loan.employee_id, bucket)
  }

  const periodDays = []
  for (let date = toDate(startDate); date <= toDate(endDate); date = new Date(date.getTime() + DAY_MS)) {
    periodDays.push(dateKey(date))
  }

  const saturdays = periodDays.filter(day => toDate(day).getUTCDay() === 6 && !blockedWeekSaturdays.includes(day))
  const items = (employees || []).map(employee => {
    const { schema, roleName } = roleOf(employee)
    const workDates = periodDays.filter(day => {
      const currentDate = toDate(day)
      return isWeekday(currentDate) && attendanceByEmployeeDate.get(`${employee.id}:${day}`)?.status === 'Hadir'
    })
    const attendanceDays = workDates.length
    const logs = logsByEmployee.get(employee.id) || []
    const myQty = logs.reduce((sum, log) => sum + Number(log.qty_processed || 0), 0)
    const isOperatorMesin = roleName.toLowerCase() === 'operator mesin'
    const lowQtyThreshold = Number(schema.batas_qty_bonus_harian || 0)
    const lowQtyPay = Number(schema.bonus_harian_dibawah_target || 0)
    const targetQtyThreshold = Number(schema.batas_qty_target_harian || 0)
    const targetQtyBonus = Number(schema.bonus_target_harian || 0)

    let dailyBonus = 0
    const dailyQty = {}
    const dailyTwoColorQty = {}
    for (const [key, qty] of logsByEmployeeDate.entries()) {
      const [employeeId, day] = key.split(':')
      if (employeeId === employee.id && day >= startDate && day <= endDate) dailyQty[day] = qty
    }
    if (isOperator(roleName)) {
      for (const log of logs) {
        const day = String(log.processed_date || '').slice(0, 10)
        if (!log.is_two_color || Number(log.color_pass) !== 2 || day < startDate || day > endDate) continue
        dailyTwoColorQty[day] = (dailyTwoColorQty[day] || 0) + Number(log.qty_processed || 0)
      }
    }
    const twoColorQty = Object.values(dailyTwoColorQty).reduce((sum, qty) => sum + qty, 0)
    for (const qty of Object.values(dailyQty)) {
      // Operator Mesin receives the low-output amount as guaranteed daily pay,
      // and does not earn piecework for that day's production.
      if (!isOperatorMesin && lowQtyThreshold > 0 && qty < lowQtyThreshold) {
        dailyBonus += lowQtyPay
      }
      if (targetQtyThreshold > 0 && qty >= targetQtyThreshold) {
        dailyBonus += targetQtyBonus
      }
    }

    const employeeLoans = loansByEmployee.get(employee.id) || { kasbon: [], pinjaman: [] }
    const kasbonLimit = employeeLoans.kasbon.reduce((sum, loan) => sum + Number(loan.remaining_amount || 0), 0)
    const pinjamanLimit = employeeLoans.pinjaman.reduce((sum, loan) => sum + Math.min(
      Number(loan.installment_amount || 0), Number(loan.remaining_amount || 0)
    ), 0)
    const kasbonAmount = kasbonLimit
    const pinjamanAmount = pinjamanLimit
    const loanSnapshot = [
      ...employeeLoans.kasbon.map(loan => ({ id: loan.id, type: 'KASBON', planned_amount: Number(loan.remaining_amount || 0) })),
      ...employeeLoans.pinjaman.map(loan => ({
        id: loan.id,
        type: 'PINJAMAN',
        planned_amount: Math.min(Number(loan.installment_amount || 0), Number(loan.remaining_amount || 0))
      }))
    ].filter(loan => loan.planned_amount > 0)

    const dailyRate = Number(employee.gaji_harian || 0)
    const mealRate = Number(employee.uang_makan || 0)
    const pieceworkRate = Number(schema.rate_borongan_sendiri || 0)
    const twoColorRate = isOperator(roleName) ? TWO_COLOR_RATE_PER_PIECE : 0
    const lowProductionDates = isOperatorMesin && lowQtyThreshold > 0
      ? workDates.filter(day => Number(dailyQty[day] || 0) < lowQtyThreshold)
      : []
    const minimumPayTopUp = lowProductionDates.length * Math.max(0, lowQtyPay - dailyRate)
    const pieceworkQty = isOperatorMesin && lowQtyThreshold > 0
      ? Object.entries(dailyQty).reduce((sum, [day, qty]) => (
        sum + (qty < lowQtyThreshold ? 0 : Number(qty || 0))
      ), 0)
      : myQty
    const baseSalary = dailyRate * attendanceDays + minimumPayTopUp
    const weeklyBonusRate = Number(employee.bonus_mingguan || 0)
    const weeklyBonusDates = weeklyBonusRate > 0
      ? saturdays.filter(saturday => {
        const monday = getPayrollWeekStart(saturday)
        if (isOperatorMesin) {
          if (!periodDays.includes(monday)) return false
          const weeklyQty = Object.entries(dailyQty).reduce((sum, [day, qty]) => (
            day >= monday && day <= saturday ? sum + Number(qty || 0) : sum
          ), 0)
          return weeklyQty >= 5000
        }
        for (let cursor = toDate(monday); dateKey(cursor) <= saturday; cursor = new Date(cursor.getTime() + DAY_MS)) {
          if (!isWeekday(cursor) || attendanceByEmployeeDate.get(`${employee.id}:${dateKey(cursor)}`)?.status !== 'Hadir') return false
        }
        return true
      })
      : []
    const lateDeduction = periodDays.reduce((sum, day) => (
      sum + (isWeekday(toDate(day)) && attendanceByEmployeeDate.get(`${employee.id}:${day}`)?.status === 'Hadir'
        ? Number(attendanceByEmployeeDate.get(`${employee.id}:${day}`)?.late_deduction || 0)
        : 0)
    ), 0)

    const subordinates = (employees || []).filter(candidate => {
      const candidateRole = roleOf(candidate).roleName.toLowerCase()
      return candidate.supervisor_id === employee.id && candidateRole === 'operator'
    })
    const bawahanQtyTotal = isOperatorMesin
      ? subordinates.reduce((sum, subordinate) => sum + (logsByEmployee.get(subordinate.id) || [])
        .reduce((qty, log) => qty + Number(log.qty_processed || 0), 0), 0)
      : 0
    const bawahanRate = isOperatorMesin ? Number(schema.rate_produksi_bawahan || 0) : 0

    const item = {
      employee_id: employee.id,
      employee_name: employee.full_name,
      role_name: roleName || '-',
      attendance_days: attendanceDays,
      work_dates: workDates,
      myQty,
      twoColorQty,
      dailyQty,
      dailyTwoColorQty,
      bawahanQtyTotal,
      daily_rate: dailyRate,
      meal_rate: mealRate,
      piecework_rate: pieceworkRate,
      two_color_rate: twoColorRate,
      weekly_bonus_rate: weeklyBonusRate,
      bawahan_rate: bawahanRate,
      base_salary: baseSalary,
      meal_allowance: mealRate * attendanceDays,
      borongan_amount: pieceworkQty * pieceworkRate,
      two_color_amount: twoColorQty * twoColorRate,
      weekly_bonus_weeks: weeklyBonusDates.length,
      weekly_bonus_dates: weeklyBonusDates,
      weekly_bonus: weeklyBonusDates.length * weeklyBonusRate,
      bawahan_bonus: bawahanQtyTotal * bawahanRate,
      other_bonuses: dailyBonus,
      overtime_amount: 0,
      kasbon_amount: kasbonAmount,
      kasbon_limit: kasbonLimit,
      pinjaman_amount: pinjamanAmount,
      pinjaman_limit: pinjamanLimit,
      late_deduction: lateDeduction,
      loan_snapshot: loanSnapshot
    }
    Object.assign(item, calculatePayrollTotals(item))
    item.calculation_snapshot = {
      attendance: { days: attendanceDays, work_dates: workDates },
      production: {
        qty: myQty,
        piecework_qty: pieceworkQty,
        daily_qty: dailyQty,
        two_color_qty: twoColorQty,
        daily_two_color_qty: dailyTwoColorQty,
        subordinate_qty: bawahanQtyTotal,
        low_production_pay_dates: lowProductionDates,
        low_production_pay_top_up: minimumPayTopUp
      },
      rates: {
        daily: dailyRate,
        meal: mealRate,
        piecework: pieceworkRate,
        two_color: twoColorRate,
        weekly_bonus: weeklyBonusRate,
        subordinate: bawahanRate,
        daily_bonus_under_threshold: Number(schema.bonus_harian_dibawah_target || 0),
        daily_bonus_target: Number(schema.bonus_target_harian || 0)
      },
      weekly_bonus_dates: weeklyBonusDates,
      weekly_bonus_threshold: isOperatorMesin ? 5000 : null,
      loan_deductions: loanSnapshot,
      components: {}
    }
    return item
  })

  return { items, saturdays }
}
