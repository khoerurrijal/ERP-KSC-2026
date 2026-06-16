'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

export async function createManualTransaction(payload) {
  const supabase = await createClient()

  try {
    const { type, reference, workshop_code, payment_method, amount, description } = payload
    
    // Validasi
    if (!amount || amount <= 0) {
      throw new Error("Nominal transaksi harus lebih dari 0")
    }

    const isMasuk = type === 'MASUK'

    const { error } = await supabase.from('transactions').insert([{
      date: new Date().toISOString().split('T')[0],
      reference: workshop_code === 'KING' ? reference : 'LAIN-LAIN',
      description,
      payment_method,
      workshop_code,
      amount_in: isMasuk ? amount : 0,
      amount_out: isMasuk ? 0 : amount
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
  const supabase = await createClient()

  try {
    const { date, type, reference, workshop_code, payment_method, amount, description } = payload
    
    if (!amount || amount <= 0) {
      throw new Error("Nominal transaksi harus lebih dari 0")
    }

    const isMasuk = type === 'MASUK'

    const { error } = await supabase.from('transactions')
      .update({
        date,
        reference: workshop_code === 'KING' ? reference : 'LAIN-LAIN',
        description,
        payment_method,
        workshop_code,
        amount_in: isMasuk ? amount : 0,
        amount_out: isMasuk ? 0 : amount
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
  const supabase = await createClient()
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
