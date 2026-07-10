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

    // 0. Duplicate period guard
    const { data: existingPayroll } = await supabase
      .from('payrolls')
      .select('id')
      .eq('start_date', payload.startDate)
      .eq('end_date', payload.endDate)
      .limit(1)
      .maybeSingle()

    if (existingPayroll) {
      throw new Error(`Rekap gaji untuk periode ${payload.startDate} s/d ${payload.endDate} sudah pernah disimpan.`)
    }

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

    // 2. Hitung Potongan Pinjaman/Kasbon & Update Loans Secara Dinamis
    let recalculatedGrandTotal = 0
    const finalItemsToInsert = []

    for (const item of payload.items) {
      // Get all active loans/kasbon for this employee
      const { data: activeLoans } = await supabase
        .from('employee_loans')
        .select('id, remaining_amount, installment_amount, type, notes')
        .eq('employee_id', item.employee_id)
        .eq('status', 'BELUM LUNAS')
        .order('created_at', { ascending: true })

      let totalPinjamanWajib = 0
      let maxKasbonAvailable = 0
      
      const pinjamanLoans = []
      const kasbonLoans = []

      activeLoans?.forEach(loan => {
        if (loan.type === 'PINJAMAN') {
          const installment = Math.min(Number(loan.installment_amount || 0), Number(loan.remaining_amount || 0))
          totalPinjamanWajib += installment
          pinjamanLoans.push({ ...loan, currentInstallment: installment })
        } else if (loan.type === 'KASBON') {
          maxKasbonAvailable += Number(loan.remaining_amount || 0)
          kasbonLoans.push(loan)
        }
      })

      // Porsi KASBON murni = kasbon_amount dari UI (KASBON-only)
      const uiKasbonAmount = Number(item.kasbon_amount || 0)
      let porsiKasbonMurni = Math.min(uiKasbonAmount, maxKasbonAvailable)

      const totalPotonganAktual = totalPinjamanWajib + porsiKasbonMurni


      // Update remaining amounts & statuses in DB
      // 2a. Potong PINJAMAN secara independen (wajib)
      for (const loan of pinjamanLoans) {
        const deductAmount = loan.currentInstallment
        if (deductAmount > 0) {
          const newRemaining = Number(loan.remaining_amount || 0) - deductAmount
          const newStatus = newRemaining === 0 ? 'LUNAS' : 'BELUM LUNAS'

          await supabase.from('employee_loans')
            .update({ remaining_amount: newRemaining, status: newStatus })
            .eq('id', loan.id)

          // Cicilan PINJAMAN masuk ke TABUNGAN
          const { data: empData } = await supabase.from('employees').select('full_name').eq('id', item.employee_id).single()
          await supabase.from('transactions').insert([{
            date: new Date().toISOString().split('T')[0],
            reference: 'PINJAMAN',
            description: `Potongan cicilan pinjaman - ${empData?.full_name || 'Karyawan'}`,
            payment_method: 'CASH',
            amount_out: 0,
            amount_in: deductAmount,
            workshop_code: 'TABUNGAN'
          }])
        }
      }

      // 2b. Potong KASBON (FIFO) dari porsi KASBON murni
      let remainingKasbonToDeduct = porsiKasbonMurni
      for (const loan of kasbonLoans) {
        if (remainingKasbonToDeduct <= 0) break

        const deductAmount = Math.min(Number(loan.remaining_amount || 0), remainingKasbonToDeduct)
        if (deductAmount > 0) {
          remainingKasbonToDeduct -= deductAmount
          const newRemaining = Number(loan.remaining_amount || 0) - deductAmount
          const newStatus = newRemaining === 0 ? 'LUNAS' : 'BELUM LUNAS'

          await supabase.from('employee_loans')
            .update({ remaining_amount: newRemaining, status: newStatus })
            .eq('id', loan.id)
          // KASBON tidak membuat transactions/cash IN ke TABUNGAN (hanya netting gaji)
        }
      }

      // Hitung ulang Net Salary (total) final untuk payroll_items agar sinkron dengan database
      const totalSebelumDeduction = Number(item.base_salary || 0) + Number(item.meal_allowance || 0) + Number(item.weekly_bonus || 0) + Number(item.borongan_amount || 0) + Number(item.bawahan_bonus || 0) + Number(item.other_bonuses || 0)
      const finalNetTotal = totalSebelumDeduction - totalPotonganAktual - Number(item.late_deduction || 0)

      recalculatedGrandTotal += finalNetTotal

      finalItemsToInsert.push({
        payroll_id: payrollRow.id,
        employee_id: item.employee_id,
        base_salary: item.base_salary,
        meal_allowance: item.meal_allowance,
        weekly_bonus: item.weekly_bonus,
        borongan_amount: item.borongan_amount,
        bawahan_bonus: item.bawahan_bonus,
        other_bonuses: item.other_bonuses,
        total: finalNetTotal
      })
    }

    // Insert ke tabel payroll_items
    if (finalItemsToInsert.length > 0) {
      const { error: piErr } = await supabase.from('payroll_items').insert(finalItemsToInsert)
      if (piErr) throw piErr
    }

    // Update total_amount di rekap payrolls utama
    await supabase.from('payrolls').update({ total_amount: recalculatedGrandTotal }).eq('id', payrollRow.id)

    // 4. Insert Transaction for the total payroll (cash OUT dari KING sebesar net salary)
    const { error: tErr } = await supabase.from('transactions').insert([{
      date: new Date().toISOString().split('T')[0],
      reference: 'GAJI KARYAWAN',
      description: payload.description || 'Gaji Karyawan',
      payment_method: payload.payment_method || 'Cash',
      amount_out: recalculatedGrandTotal,
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
