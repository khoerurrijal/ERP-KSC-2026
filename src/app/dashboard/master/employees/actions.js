'use server'

import { createAuthorizedAdminClient } from '@/lib/adminAuth'
import { revalidatePath } from 'next/cache'

async function findAuthUserByEmail(supabase, email) {
  const perPage = 1000
  let page = 1

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage })
    if (error) throw error

    const existingUser = data.users.find(user => user.email?.toLowerCase() === email)
    if (existingUser) return existingUser
    if (data.users.length < perPage) return null

    page += 1
  }
}

export async function saveEmployee(payload) {
  const { supabase } = await createAuthorizedAdminClient(['ADMIN', 'OWNER'])

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
          bonus_mingguan: payload.bonus_mingguan || 0,
          is_active: payload.is_active
        })
        .eq('id', payload.id)
      
      if (error) throw error
    } else {
      const username = String(payload.username || '').trim().toLowerCase()
      const password = String(payload.password || '')
      if (!/^[a-z0-9_]+$/.test(username)) throw new Error('Username tidak valid.')
      if (password.length < 6) throw new Error('Password minimal 6 karakter.')

      const email = `${username}@kingsablon.com`
      const existingAuthUser = await findAuthUserByEmail(supabase, email)
      let userId = existingAuthUser?.id

      if (existingAuthUser) {
        const { data: linkedEmployee, error: linkedEmployeeError } = await supabase
          .from('employees')
          .select('id')
          .eq('user_id', userId)
          .limit(1)
          .maybeSingle()

        if (linkedEmployeeError) throw linkedEmployeeError
        if (linkedEmployee) throw new Error('Akun login ini masih terhubung ke karyawan lain.')
      } else {
        // Create Auth user without signing out the current admin.
        const authRes = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/signup`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
          },
          body: JSON.stringify({
            email,
            password,
            data: { full_name: payload.full_name }
          })
        })

        const authData = await authRes.json()
        if (!authRes.ok) {
          throw new Error(authData.error_description || authData.msg || 'Gagal membuat user login.')
        }

        userId = authData.user?.id || authData.id
        if (!userId) throw new Error('Gagal mendapatkan ID user dari sistem auth.')
      }

      const { data: employee, error: empError } = await supabase
        .from('employees')
        .insert([{
          user_id: userId,
          username,
          full_name: payload.full_name,
          salary_schema_id: payload.salary_schema_id || null,
          supervisor_id: payload.supervisor_id || null,
          gaji_harian: payload.gaji_harian || 0,
          uang_makan: payload.uang_makan || 0,
          bonus_mingguan: payload.bonus_mingguan || 0,
          is_active: payload.is_active
        }])
        .select('id')
        .single()

      if (empError) throw empError

      if (existingAuthUser) {
        const { error: passwordError } = await supabase.auth.admin.updateUserById(userId, {
          password,
          user_metadata: {
            ...(existingAuthUser.user_metadata || {}),
            full_name: payload.full_name
          }
        })

        if (passwordError) {
          const { error: rollbackError } = await supabase.from('employees').delete().eq('id', employee.id)
          if (rollbackError) {
            throw new Error(`Gagal memperbarui password. Profil karyawan juga gagal dibatalkan: ${rollbackError.message}`)
          }
          throw passwordError
        }
      }
    }

    // Sync to user_roles in system_settings
    if (payload.salary_schema_id && payload.username) {
      const { data: schema } = await supabase.from('salary_schemas').select('role_name').eq('id', payload.salary_schema_id).single()
      if (schema) {
        let mappedRole = 'Operator'
        const roleName = schema.role_name.toLowerCase()
        if (roleName.includes('admin')) mappedRole = 'Admin'
        else if (roleName.includes('owner')) mappedRole = 'Owner'
        else if (roleName.includes('operator mesin')) mappedRole = 'Operator Mesin'

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
  const { supabase } = await createAuthorizedAdminClient(['ADMIN', 'OWNER'])

  try {
    // Fetch username first before deleting
    const { data: emp } = await supabase.from('employees').select('username').eq('id', id).single()

    // Keep the Auth identity so existing activity references remain stable.
    // Re-adding this username reconnects the same account and sets a new password.
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
