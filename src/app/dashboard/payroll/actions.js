'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

export async function calculatePayroll(startDate, endDate) {
  const supabase = await createClient()

  try {
    // Ambil log produksi di rentang tanggal (inklusif)
    const { data: logs, error: logsErr } = await supabase
      .from('production_logs')
      .select('employee_id, qty_processed, processed_date')
      .gte('processed_date', startDate)
      .lte('processed_date', endDate)

    if (logsErr) throw logsErr

    // Agregasi qty per karyawan
    const qtyPerEmployee = {}
    // qtyPerEmployeeDate untuk ngecek bonus harian
    const qtyPerEmployeeDate = {}

    logs?.forEach(log => {
      const eid = log.employee_id
      if (!eid) return
      
      qtyPerEmployee[eid] = (qtyPerEmployee[eid] || 0) + log.qty_processed
      
      if (!qtyPerEmployeeDate[eid]) qtyPerEmployeeDate[eid] = {}
      qtyPerEmployeeDate[eid][log.processed_date] = (qtyPerEmployeeDate[eid][log.processed_date] || 0) + log.qty_processed
    })

    // Ambil data Pinjaman/Kasbon yang belum lunas
    const { data: activeLoans, error: loansErr } = await supabase
      .from('employee_loans')
      .select('*')
      .eq('status', 'BELUM LUNAS')
    
    if (loansErr) throw loansErr

    // Agregasi potongan pinjaman per karyawan
    const deductionsPerEmployee = {}
    activeLoans?.forEach(loan => {
      const eid = loan.employee_id
      if (!deductionsPerEmployee[eid]) deductionsPerEmployee[eid] = { totalDeduction: 0, loanIds: [] }
      
      let deduction = 0
      if (loan.type === 'KASBON') {
        deduction = loan.remaining_amount
      } else if (loan.type === 'PINJAMAN') {
        deduction = Math.min(loan.installment_amount, loan.remaining_amount)
      }

      if (deduction > 0) {
        deductionsPerEmployee[eid].totalDeduction += deduction
        deductionsPerEmployee[eid].loanIds.push({ id: loan.id, deduction, type: loan.type })
      }
    })

    return { success: true, qtyPerEmployee, qtyPerEmployeeDate, deductionsPerEmployee }
  } catch (err) {
    console.error('Error calculating payroll:', err)
    return { success: false, error: err.message }
  }
}

export async function savePayroll(payload) {
  const supabase = await createClient()

  try {
    const { data: userData } = await supabase.auth.getUser()
    const userId = userData?.user?.id

    // 1. Insert ke tabel payrolls
    const { data: payrollRow, error: pErr } = await supabase
      .from('payrolls')
      .insert([{
        start_date: payload.startDate,
        end_date: payload.endDate,
        generated_by: userId,
        total_amount: payload.grandTotal
      }])
      .select('id')
      .single()

    if (pErr) throw pErr

    // 2. Insert ke tabel payroll_items
    const itemsToInsert = payload.items.map(item => ({
      payroll_id: payrollRow.id,
      employee_id: item.employee_id,
      base_salary: item.base_salary,
      meal_allowance: item.meal_allowance,
      weekly_bonus: item.weekly_bonus,
      borongan_amount: item.borongan_amount,
      bawahan_bonus: item.bawahan_bonus,
      other_bonuses: item.other_bonuses,
      total: item.total
    }))

    if (itemsToInsert.length > 0) {
      const { error: piErr } = await supabase.from('payroll_items').insert(itemsToInsert)
      if (piErr) throw piErr
    }

    // 3. Update Loans & Insert Transactions for PINJAMAN
    if (payload.loanDeductions && payload.loanDeductions.length > 0) {
      for (const deduction of payload.loanDeductions) {
        // Fetch current loan to check remaining
        const { data: currentLoan } = await supabase.from('employee_loans').select('remaining_amount, type, employee_id, employees(full_name)').eq('id', deduction.id).single()
        if (currentLoan) {
          const newRemaining = Math.max(0, currentLoan.remaining_amount - deduction.deduction)
          const newStatus = newRemaining === 0 ? 'LUNAS' : 'BELUM LUNAS'
          
          await supabase.from('employee_loans')
            .update({ remaining_amount: newRemaining, status: newStatus })
            .eq('id', deduction.id)
          
          if (currentLoan.type === 'PINJAMAN' && deduction.deduction > 0) {
            await supabase.from('transactions').insert([{
              date: new Date().toISOString().split('T')[0],
              reference: 'PINJAMAN',
              description: `Potongan cicilan pinjaman - ${currentLoan.employees?.full_name}`,
              payment_method: 'CASH',
              amount_out: 0,
              amount_in: deduction.deduction,
              workshop_code: 'TABUNGAN'
            }])
          }
        }
      }
    }

    // 4. Insert Transaction for the total payroll
    const { error: tErr } = await supabase.from('transactions').insert([{
      date: new Date().toISOString().split('T')[0],
      reference: 'GAJI KARYAWAN',
      description: payload.description || 'Gaji Karyawan',
      payment_method: payload.payment_method || 'Cash',
      amount_out: payload.grandTotal,
      amount_in: 0,
      workshop_code: payload.workshop_code || 'KING'
    }])

    if (tErr) throw tErr

    revalidatePath('/dashboard/payroll')
    return { success: true }
  } catch (err) {
    console.error('Error saving payroll:', err)
    return { success: false, error: err.message }
  }
}
