'use server'

import { randomUUID } from 'crypto'
import { createAuthorizedAdminClient } from '@/lib/adminAuth'
import { revalidatePath } from 'next/cache'

const BUSINESS_TIME_ZONE = 'Asia/Jakarta'

function normalizeLoanPayload(payload) {
  const { employee_id, type, amount, tenor_weeks, payment_method, notes, date } = payload
  const normalizedAmount = Number(amount)
  const normalizedTenor = Number(tenor_weeks)
  const dateMatch = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/.exec(date || '')
  const dateParts = dateMatch?.slice(1).map(Number)
  const calendarDate = dateParts ? new Date(Date.UTC(dateParts[0], dateParts[1] - 1, dateParts[2])) : null
  const validCalendarDate = calendarDate
    && calendarDate.getUTCFullYear() === dateParts[0]
    && calendarDate.getUTCMonth() === dateParts[1] - 1
    && calendarDate.getUTCDate() === dateParts[2]
  const normalizedDate = validCalendarDate ? new Date(`${date}T00:00:00+07:00`) : null

  if (!employee_id || !['KASBON', 'PINJAMAN'].includes(type) || !Number.isFinite(normalizedAmount) || normalizedAmount <= 0) {
    throw new Error('Data pinjaman/kasbon tidak valid.')
  }
  if (type === 'PINJAMAN' && (!Number.isInteger(normalizedTenor) || normalizedTenor <= 0)) {
    throw new Error('Tenor pinjaman tidak valid.')
  }
  if (!normalizedDate || Number.isNaN(normalizedDate.getTime())) {
    throw new Error('Tanggal pengajuan tidak valid.')
  }

  return {
    employee_id,
    type,
    amount: normalizedAmount,
    tenor_weeks: type === 'PINJAMAN' ? normalizedTenor : 1,
    payment_method: payment_method || 'Cash',
    notes: notes?.trim() || '',
    date,
    disbursed_date: normalizedDate.toISOString(),
    installment_amount: type === 'PINJAMAN' ? Math.ceil(normalizedAmount / normalizedTenor) : normalizedAmount,
  }
}

function legacyTransactionDetails(loan) {
  const isCashbon = loan.type === 'KASBON'
  return {
    reference: loan.type,
    description: `${isCashbon ? 'Pencairan Kasbon Karyawan' : 'Pencairan Pinjaman Karyawan'} - ${loan.notes || ''}`,
    workshop_code: isCashbon ? 'KING' : 'TABUNGAN',
  }
}

function transactionDetails(loan, employeeName) {
  const loanLabel = loan.type === 'KASBON' ? 'Kasbon' : 'Pinjaman'
  const notes = loan.notes?.trim()
  return {
    reference: loan.type,
    description: loan.type === 'KASBON'
      ? `${loanLabel} ${employeeName}`
      : `${loanLabel} ${employeeName}${notes ? ` - ${notes}` : ''}`,
    workshop_code: loan.type === 'KASBON' ? 'KING' : 'TABUNGAN',
  }
}

async function getEmployeeNames(supabase, employeeIds) {
  const uniqueEmployeeIds = [...new Set(employeeIds.filter(Boolean))]
  const { data: employees, error } = await supabase
    .from('employees')
    .select('id, full_name')
    .in('id', uniqueEmployeeIds)

  if (error) throw error

  const employeeNames = new Map((employees || []).map(employee => [employee.id, employee.full_name]))
  if (uniqueEmployeeIds.some(employeeId => !employeeNames.get(employeeId))) {
    throw new Error('Nama karyawan tidak ditemukan untuk pengajuan ini.')
  }
  return employeeNames
}

function dateInJakarta(value) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: BUSINESS_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(value))
  const part = type => parts.find(item => item.type === type)?.value
  return `${part('year')}-${part('month')}-${part('day')}`
}

async function createLoansWithClient(supabase, payloads) {
  if (!Array.isArray(payloads) || payloads.length === 0) {
    throw new Error('Tambahkan minimal satu pengajuan.')
  }

  const normalizedLoans = payloads.map(payload => ({
    id: randomUUID(),
    ...normalizeLoanPayload(payload),
  }))
  const employeeNames = await getEmployeeNames(supabase, normalizedLoans.map(loan => loan.employee_id))

  const { error: loanError } = await supabase
    .from('employee_loans')
    .insert(normalizedLoans.map(loan => ({
      id: loan.id,
      employee_id: loan.employee_id,
      type: loan.type,
      amount: loan.amount,
      tenor_weeks: loan.tenor_weeks,
      installment_amount: loan.installment_amount,
      remaining_amount: loan.amount,
      disbursed_date: loan.disbursed_date,
      notes: loan.notes,
    })))

  if (loanError) throw loanError

  const transactions = normalizedLoans.map(loan => ({
    employee_loan_id: loan.id,
    date: loan.date,
    ...transactionDetails(loan, employeeNames.get(loan.employee_id)),
    payment_method: loan.payment_method,
    amount_out: loan.amount,
    amount_in: 0,
  }))
  const { error: transactionError } = await supabase.from('transactions').insert(transactions)

  if (transactionError) {
    const { error: rollbackError } = await supabase.from('employee_loans').delete().in('id', normalizedLoans.map(loan => loan.id))
    if (rollbackError) {
      throw new Error(`Transaksi gagal disimpan dan pengajuan kasbon tidak berhasil dibersihkan: ${rollbackError.message}`)
    }
    throw transactionError
  }

  return normalizedLoans.length
}

export async function createLoan(payload) {
  const { supabase } = await createAuthorizedAdminClient(['ADMIN', 'OWNER'])

  try {
    await createLoansWithClient(supabase, [payload])
    revalidatePath('/dashboard/finance/loans')
    return { success: true }
  } catch (err) {
    console.error('Error creating loan:', err)
    return { success: false, error: err.message }
  }
}

export async function createLoans(payloads) {
  const { supabase } = await createAuthorizedAdminClient(['ADMIN', 'OWNER'])

  try {
    const createdCount = await createLoansWithClient(supabase, payloads)
    revalidatePath('/dashboard/finance/loans')
    return { success: true, createdCount }
  } catch (err) {
    console.error('Error creating loans:', err)
    return { success: false, error: err.message }
  }
}

async function findLoanTransaction(supabase, loan) {
  const { data: linkedTransactions, error: linkedError } = await supabase
    .from('transactions')
    .select('id, employee_loan_id, date, reference, description, payment_method, amount_out, amount_in, workshop_code')
    .eq('employee_loan_id', loan.id)

  if (linkedError) throw linkedError
  if (linkedTransactions.length > 1) throw new Error('Tautan transaksi Buku Besar untuk pinjaman ini tidak unik. Data tidak diubah.')
  if (linkedTransactions.length === 1) return linkedTransactions[0]

  // Older loans predate the transaction link. Match every identifying ledger field
  // and proceed only when exactly one unlinked transaction fits.
  const details = legacyTransactionDetails(loan)
  const { data: candidates, error: candidateError } = await supabase
    .from('transactions')
    .select('id, employee_loan_id, date, reference, description, payment_method, amount_out, amount_in, workshop_code')
    .eq('reference', details.reference)
    .eq('description', details.description)
    .eq('amount_out', loan.amount)
    .eq('amount_in', 0)
    .eq('workshop_code', details.workshop_code)
    .is('employee_loan_id', null)

  if (candidateError) throw candidateError

  const loanDate = new Date(`${dateInJakarta(loan.disbursed_date || loan.created_at)}T00:00:00Z`).getTime()
  const matchingCandidates = (candidates || []).filter(transaction => {
    const transactionDate = new Date(`${transaction.date}T00:00:00Z`).getTime()
    return Math.abs(transactionDate - loanDate) <= 24 * 60 * 60 * 1000
  })

  if (matchingCandidates.length !== 1) {
    throw new Error('Transaksi Buku Besar terkait tidak ditemukan atau tidak unik. Data pinjaman tidak diubah.')
  }
  return matchingCandidates[0]
}

export async function updateLoan(id, payload) {
  const { supabase } = await createAuthorizedAdminClient(['ADMIN', 'OWNER'])

  try {
    const { data: currentLoan, error: loanReadError } = await supabase
      .from('employee_loans')
      .select('id, employee_id, type, amount, tenor_weeks, installment_amount, remaining_amount, status, disbursed_date, created_at, notes')
      .eq('id', id)
      .single()

    if (loanReadError) throw loanReadError

    const normalized = normalizeLoanPayload(payload)
    const paidAmount = Number(currentLoan.amount) - Number(currentLoan.remaining_amount)
    if (normalized.amount < paidAmount) {
      throw new Error(`Nominal tidak boleh lebih kecil dari jumlah yang sudah dibayar (Rp ${paidAmount.toLocaleString('id-ID')}).`)
    }

    const transaction = await findLoanTransaction(supabase, currentLoan)
    const employeeNames = await getEmployeeNames(supabase, [normalized.employee_id])
    const nextRemainingAmount = normalized.amount - paidAmount
    const nextLoan = {
      employee_id: normalized.employee_id,
      type: normalized.type,
      amount: normalized.amount,
      tenor_weeks: normalized.tenor_weeks,
      installment_amount: normalized.installment_amount,
      remaining_amount: nextRemainingAmount,
      status: nextRemainingAmount <= 0 ? 'LUNAS' : 'BELUM LUNAS',
      disbursed_date: normalized.disbursed_date,
      notes: normalized.notes,
    }
    const nextTransaction = {
      employee_loan_id: id,
      date: normalized.date,
      ...transactionDetails(normalized, employeeNames.get(normalized.employee_id)),
      amount_out: normalized.amount,
      amount_in: 0,
    }

    const { error: transactionUpdateError } = await supabase
      .from('transactions')
      .update(nextTransaction)
      .eq('id', transaction.id)
    if (transactionUpdateError) throw transactionUpdateError

    const { error: loanUpdateError } = await supabase
      .from('employee_loans')
      .update(nextLoan)
      .eq('id', id)
    if (loanUpdateError) {
      const { error: rollbackError } = await supabase
        .from('transactions')
        .update({
          date: transaction.date,
          employee_loan_id: transaction.employee_loan_id,
          reference: transaction.reference,
          description: transaction.description,
          amount_out: transaction.amount_out,
          amount_in: transaction.amount_in,
          workshop_code: transaction.workshop_code,
        })
        .eq('id', transaction.id)
      if (rollbackError) {
        throw new Error(`Data pinjaman gagal diperbarui dan rollback Buku Besar juga gagal: ${rollbackError.message}`)
      }
      throw loanUpdateError
    }

    revalidatePath('/dashboard/finance/loans')
    return { success: true }
  } catch (err) {
    console.error('Error updating loan:', err)
    return { success: false, error: err.message }
  }
}

export async function deleteLoan(id) {
  const { supabase } = await createAuthorizedAdminClient(['ADMIN', 'OWNER'])

  try {
    const { error } = await supabase.from('employee_loans').delete().eq('id', id)
    if (error) throw error

    revalidatePath('/dashboard/finance/loans')
    return { success: true }
  } catch (err) {
    return { success: false, error: err.message }
  }
}
