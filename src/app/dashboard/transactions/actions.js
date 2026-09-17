'use server'

import { createAuthorizedAdminClient } from '@/lib/adminAuth'
import { revalidatePath } from 'next/cache'

export async function createManualTransaction(payload) {
  const { supabase } = await createAuthorizedAdminClient(['ADMIN', 'OWNER'])

  try {
    const { type, reference, workshop_code, payment_method, amount, description } = payload
    
    // Validasi
    if (!Number.isFinite(Number(amount)) || Number(amount) <= 0) {
      throw new Error("Nominal transaksi harus lebih dari 0")
    }
    const normalizedAmount = Number(amount)

    const isMasuk = type === 'MASUK'

    const { error } = await supabase.from('transactions').insert([{
      date: new Date().toISOString().split('T')[0],
      reference: workshop_code === 'KING' ? reference : 'LAIN-LAIN',
      description,
      payment_method,
      workshop_code,
      amount_in: isMasuk ? normalizedAmount : 0,
      amount_out: isMasuk ? 0 : normalizedAmount
    }])

    if (error) throw error

    revalidatePath('/dashboard/transactions')
    revalidatePath('/dashboard/report')
    return { success: true }
  } catch (err) {
    console.error('Error creating transaction:', err)
    return { success: false, error: err.message }
  }
}

export async function updateTransaction(id, payload) {
  const { supabase } = await createAuthorizedAdminClient(['ADMIN', 'OWNER'])

  try {
    const { date, type, reference, workshop_code, payment_method, amount, description } = payload
    
    if (!Number.isFinite(Number(amount)) || Number(amount) <= 0) {
      throw new Error("Nominal transaksi harus lebih dari 0")
    }
    const normalizedAmount = Number(amount)

    const isMasuk = type === 'MASUK'

    const { error } = await supabase.from('transactions')
      .update({
        date,
        reference: workshop_code === 'KING' ? reference : 'LAIN-LAIN',
        description,
        payment_method,
        workshop_code,
        amount_in: isMasuk ? normalizedAmount : 0,
        amount_out: isMasuk ? 0 : normalizedAmount
      })
      .eq('id', id)

    if (error) throw error

    revalidatePath('/dashboard/transactions')
    revalidatePath('/dashboard/report')
    return { success: true }
  } catch (err) {
    console.error('Error updating transaction:', err)
    return { success: false, error: err.message }
  }
}

export async function deleteTransaction(id) {
  const { supabase } = await createAuthorizedAdminClient(['ADMIN', 'OWNER'])
  try {
    const { error } = await supabase.from('transactions').delete().eq('id', id)
    if (error) throw error
    revalidatePath('/dashboard/transactions')
    revalidatePath('/dashboard/report')
    return { success: true }
  } catch (err) {
    console.error('Error deleting transaction:', err)
    return { success: false, error: err.message }
  }
}
