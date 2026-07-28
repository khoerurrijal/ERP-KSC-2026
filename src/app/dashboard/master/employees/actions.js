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

    // Sync to user_roles in system_settings
    if (payload.salary_schema_id && payload.username) {
      const { data: schema } = await supabase.from('salary_schemas').select('role_name').eq('id', payload.salary_schema_id).single()
      if (schema) {
        let mappedRole = 'Operator'
        const roleName = schema.role_name.toLowerCase()
        if (roleName.includes('admin')) mappedRole = 'Admin'
        else if (roleName.includes('owner')) mappedRole = 'Owner'

        const emailToSync = `${payload.username}@kingsablon.com`.toLowerCase()

        const { data: settings } = await supabase.from('system_settings').select('value').eq('key', 'user_roles').single()
        if (settings) {
          let userRoles = settings.value || []
          const existingIdx = userRoles.findIndex(u => (u.email || '').toLowerCase() === emailToSync || (u.email || '').toLowerCase() === payload.username.toLowerCase())
          if (existingIdx >= 0) {
            userRoles[existingIdx].role = mappedRole
          } else {
            userRoles.push({ email: emailToSync, role: mappedRole })
          }
          await supabase.from('system_settings').update({ value: userRoles }).eq('key', 'user_roles')
        }
      }
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
    // Fetch username first before deleting
    const { data: emp } = await supabase.from('employees').select('username').eq('id', id).single()

    // Note: We only delete the employee record here, 
    // to delete the Auth User requires Service Role Key.
    // Since we added an is_active check in login action, deleted employees won't be able to login
    // because they won't exist in the employees table, OR we can also remove them from user_roles.
    // Actually, wait, if they are deleted from employees, our login logic will NOT find them in employees table, 
    // so they will bypass the is_active check. 
    // Let's change the login logic to block users if they are not in employees, unless they are Owner.
    // For now, at least remove them from user_roles.
    const { error } = await supabase.from('employees').delete().eq('id', id)
    if (error) throw error
    
    // Remove from user_roles
    if (emp && emp.username) {
      const emailToRemove = `${emp.username}@kingsablon.com`.toLowerCase()
      const { data: settings } = await supabase.from('system_settings').select('value').eq('key', 'user_roles').single()
      if (settings && settings.value) {
        const newUserRoles = settings.value.filter(u => (u.email || '').toLowerCase() !== emailToRemove && (u.email || '').toLowerCase() !== emp.username.toLowerCase())
        await supabase.from('system_settings').update({ value: newUserRoles }).eq('key', 'user_roles')
      }
    }

    revalidatePath('/dashboard/master/employees')
    return { success: true }
  } catch (err) {
    return { success: false, error: err.message }
  }
}
