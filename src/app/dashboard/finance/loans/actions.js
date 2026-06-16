'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

export async function createLoan(payload) {
  const supabase = await createClient()

  try {
    const { employee_id, type, amount, tenor_weeks, payment_method, notes } = payload
    
    // 1. Insert to employee_loans
    const installment_amount = type === 'PINJAMAN' ? Math.ceil(amount / tenor_weeks) : amount;
    const { data: loan, error: loanErr } = await supabase
      .from('employee_loans')
      .insert([{
        employee_id,
        type,
        amount,
        tenor_weeks: type === 'PINJAMAN' ? tenor_weeks : 1,
        installment_amount,
        remaining_amount: amount,
        notes
      }])
      .select('id')
      .single()
    
    if (loanErr) throw loanErr

    // 2. Insert to transactions (Buku Besar)
    // Jika Kasbon -> Ambil dari KING. Jika Pinjaman -> Ambil dari TABUNGAN
    const workshop_code = type === 'KASBON' ? 'KING' : 'TABUNGAN'
    const desc = type === 'KASBON' ? 'Pencairan Kasbon Karyawan' : 'Pencairan Pinjaman Karyawan'

    const { error: trxErr } = await supabase
      .from('transactions')
      .insert([{
        date: new Date().toISOString().split('T')[0],
        reference: type,
        description: `${desc} - ${notes || ''}`,
        payment_method: payment_method || 'Cash',
        amount_out: amount,
        amount_in: 0,
        workshop_code
      }])

    if (trxErr) throw trxErr

    revalidatePath('/dashboard/finance/loans')
    return { success: true }
  } catch (err) {
    console.error('Error creating loan:', err)
    return { success: false, error: err.message }
  }
}

export async function deleteLoan(id) {
  const supabase = await createClient()

  try {
    const { error } = await supabase.from('employee_loans').delete().eq('id', id)
    if (error) throw error
    
    revalidatePath('/dashboard/finance/loans')
    return { success: true }
  } catch (err) {
    return { success: false, error: err.message }
  }
}
