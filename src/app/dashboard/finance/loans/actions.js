'use server'

import { createAuthorizedAdminClient } from '@/lib/adminAuth'
import { revalidatePath } from 'next/cache'

export async function createLoan(payload) {
  const { supabase } = await createAuthorizedAdminClient(['ADMIN', 'OWNER'])

  try {
    const { employee_id, type, amount, tenor_weeks, payment_method, notes } = payload
    const normalizedAmount = Number(amount)
    const normalizedTenor = Number(tenor_weeks)
    if (!employee_id || !['KASBON', 'PINJAMAN'].includes(type) || !Number.isFinite(normalizedAmount) || normalizedAmount <= 0) {
      throw new Error('Data pinjaman/kasbon tidak valid.')
    }
    if (type === 'PINJAMAN' && (!Number.isInteger(normalizedTenor) || normalizedTenor <= 0)) {
      throw new Error('Tenor pinjaman tidak valid.')
    }
    
    // 1. Insert to employee_loans
    const installment_amount = type === 'PINJAMAN' ? Math.ceil(normalizedAmount / normalizedTenor) : normalizedAmount;
    const { data: loan, error: loanErr } = await supabase
      .from('employee_loans')
      .insert([{
        employee_id,
        type,
        amount: normalizedAmount,
        tenor_weeks: type === 'PINJAMAN' ? normalizedTenor : 1,
        installment_amount,
        remaining_amount: normalizedAmount,
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
        amount_out: normalizedAmount,
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
