'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

export async function addCustomer(data) {
  const supabase = await createClient()
  
  const { data: customer, error } = await supabase
    .from('customers')
    .insert([data])
    .select()
    .single()

  if (error) return { error: error.message }
  
  revalidatePath('/dashboard/master/customers')
  return { success: true, customer }
}

export async function deleteCustomer(id) {
  const supabase = await createClient()
  
  const { error } = await supabase
    .from('customers')
    .delete()
    .eq('id', id)

  if (error) {
    if (error.code === '23503') return { error: 'Gagal dihapus: Pelanggan ini sudah memiliki transaksi.' }
    return { error: error.message }
  }

  revalidatePath('/dashboard/master/customers')
  return { success: true }
}

export async function updateCustomer(id, data) {
  const supabase = await createClient()
  
  const { data: customer, error } = await supabase
    .from('customers')
    .update(data)
    .eq('id', id)
    .select()
    .single()

  if (error) return { error: error.message }
  
  revalidatePath('/dashboard/master/customers')
  return { success: true, customer }
}
