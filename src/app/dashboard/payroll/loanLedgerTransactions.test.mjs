import test from 'node:test'
import assert from 'node:assert/strict'
import { buildLoanRepaymentTransactions } from './loanLedgerTransactions.mjs'

test('loan repayment records matching KING outflow and TABUNGAN inflow', () => {
  const entries = buildLoanRepaymentTransactions({
    amount: 500000,
    employeeName: 'Aji',
    date: '2026-11-14'
  })

  assert.equal(entries.length, 2)
  assert.deepEqual(entries.map(entry => [entry.workshop_code, entry.amount_out, entry.amount_in]), [
    ['KING', 500000, 0],
    ['TABUNGAN', 0, 500000]
  ])
  assert.equal(entries[0].description, 'Potongan pinjaman (karyawan) - Aji')
  assert.equal(entries[1].description, 'Penerimaan cicilan pinjaman - Aji')
})

test('loan repayment rejects a non-positive or invalid amount', () => {
  assert.throws(() => buildLoanRepaymentTransactions({ amount: 0, date: '2026-11-14' }))
  assert.throws(() => buildLoanRepaymentTransactions({ amount: Number.NaN, date: '2026-11-14' }))
})
