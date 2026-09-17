'use server'

import { createAuthorizedAdminClient } from '@/lib/adminAuth'
import { revalidatePath } from 'next/cache'

export async function saveSupplier(payload) {
  const { supabase } = await createAuthorizedAdminClient(['ADMIN', 'OWNER'])

  try {
    if (payload.id) {
      const { error } = await supabase
        .from('suppliers')
        .update({
          supplier_name: payload.supplier_name,
          phone: payload.phone,
          address: payload.address
        })
        .eq('id', payload.id)
      
      if (error) throw error
    } else {
      const { error } = await supabase
        .from('suppliers')
        .insert([{
          supplier_name: payload.supplier_name,
          phone: payload.phone,
          address: payload.address
        }])
      
      if (error) throw error
    }

    revalidatePath('/dashboard/master/suppliers')
    return { success: true }
  } catch (err) {
    console.error('Error saving supplier:', err)
    return { success: false, error: err.message }
  }
}

export async function deleteSupplier(id) {
  const { supabase } = await createAuthorizedAdminClient(['ADMIN', 'OWNER'])

  try {
    const { error } = await supabase.from('suppliers').delete().eq('id', id)
    if (error) throw error
    
    revalidatePath('/dashboard/master/suppliers')
    return { success: true }
  } catch (err) {
    return { success: false, error: err.message }
  }
}
