'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

export async function addCustomer(data) {
  const supabase = await createClient()
  
  // Petakan city ke address untuk kecocokan skema tabel database
  const dbData = {
    customer_code: data.customer_code,
    name: data.name,
    type: data.type,
    phone: data.phone,
    address: data.city || data.address || ''
  }
  
  const { data: customer, error } = await supabase
    .from('customers')
    .insert([dbData])
    .select()
    .single()

  if (error) return { error: error.message }
  
  // Kembalikan address sebagai city untuk kompatibilitas UI
  if (customer) {
    customer.city = customer.address
  }
  
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
  
  // Petakan city ke address untuk kecocokan skema tabel database
  const dbData = {
    name: data.name,
    type: data.type,
    phone: data.phone,
    address: data.city !== undefined ? data.city : data.address
  }
  
  // Hapus properti undefined
  Object.keys(dbData).forEach(key => dbData[key] === undefined && delete dbData[key])
  
  const { data: customer, error } = await supabase
    .from('customers')
    .update(dbData)
    .eq('id', id)
    .select()
    .single()

  if (error) return { error: error.message }
  
  // Kembalikan address sebagai city untuk kompatibilitas UI
  if (customer) {
    customer.city = customer.address
  }
  
  revalidatePath('/dashboard/master/customers')
  return { success: true, customer }
}
