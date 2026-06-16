'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

export async function saveEmployee(payload) {
  const supabase = await createClient()

  try {
    if (payload.id) {
      // Update employee
      const { error } = await supabase
        .from('employees')
        .update({
          full_name: payload.full_name,
          salary_schema_id: payload.salary_schema_id || null,
          supervisor_id: payload.supervisor_id || null,
          gaji_harian: payload.gaji_harian || 0,
          uang_makan: payload.uang_makan || 0,
          is_active: payload.is_active
        })
        .eq('id', payload.id)
      
      if (error) throw error
    } else {
      // 1. Create Auth User without signing out the current admin
      const email = `${payload.username}@kingsablon.com`
      
      const authRes = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/signup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
        },
        body: JSON.stringify({
          email: email,
          password: payload.password,
          data: { full_name: payload.full_name }
        })
      });

      const authData = await authRes.json()

      if (!authRes.ok) {
        throw new Error(authData.error_description || authData.msg || 'Gagal membuat user login.')
      }

      const userId = authData.user?.id || authData.id

      if (!userId) {
        throw new Error('Gagal mendapatkan ID user dari sistem auth.')
      }

      // 2. Insert into employees
      const { error: empError } = await supabase
        .from('employees')
        .insert([{
          user_id: userId,
          username: payload.username,
          full_name: payload.full_name,
          salary_schema_id: payload.salary_schema_id || null,
          supervisor_id: payload.supervisor_id || null,
          gaji_harian: payload.gaji_harian || 0,
          uang_makan: payload.uang_makan || 0,
          is_active: payload.is_active
        }])

      if (empError) throw empError
    }

    revalidatePath('/dashboard/master/employees')
    return { success: true }
  } catch (err) {
    console.error('Error saving employee:', err)
    return { success: false, error: err.message }
  }
}

export async function deleteEmployee(id) {
  const supabase = await createClient()

  try {
    // Note: We only delete the employee record here, 
    // to delete the Auth User requires Service Role Key.
    // For now deleting employee is enough, user can't login if we block them via middleware/is_active
    const { error } = await supabase.from('employees').delete().eq('id', id)
    if (error) throw error
    
    revalidatePath('/dashboard/master/employees')
    return { success: true }
  } catch (err) {
    return { success: false, error: err.message }
  }
}
