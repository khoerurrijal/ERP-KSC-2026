export function buildLoanRepaymentTransactions({ amount, employeeName, date }) {
  const repaymentAmount = Number(amount)
  if (!Number.isFinite(repaymentAmount) || repaymentAmount <= 0) {
    throw new Error('Nominal cicilan pinjaman tidak valid.')
  }

  const employee = employeeName || 'Karyawan'
  const common = { date, reference: 'PINJAMAN', payment_method: 'CASH' }

  return [
    {
      ...common,
      description: `Potongan pinjaman (karyawan) - ${employee}`,
      amount_out: repaymentAmount,
      amount_in: 0,
      workshop_code: 'KING'
    },
    {
      ...common,
      description: `Penerimaan cicilan pinjaman - ${employee}`,
      amount_out: 0,
      amount_in: repaymentAmount,
      workshop_code: 'TABUNGAN'
    }
  ]
}
