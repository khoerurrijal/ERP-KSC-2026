'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'

export async function login(previousState, formData) {
  const usernameValue = formData.get('username')
  const username = typeof usernameValue === 'string' ? usernameValue.trim() : ''
  const password = formData.get('password')

  if (!username || typeof password !== 'string' || !password) {
    return { error: 'Username dan password wajib diisi.' }
  }

  try {
    const supabase = await createClient()
    const email = (username.includes('@') ? username : `${username}@kingsablon.com`).toLowerCase()

    const { error, data: authData } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      return { error: error.message }
    }
    if (!authData?.user) {
      return { error: 'Login gagal. Periksa username dan password lalu coba lagi.' }
    }

    // Check if user is in employees table
    const { data: empData, error: empError } = await supabase.from('employees').select('is_active').eq('user_id', authData.user.id).single()
    
    if (empData) {
      // User is an employee, check if active
      if (empData.is_active === false) {
        await supabase.auth.signOut()
        return { error: 'Akun Anda dinonaktifkan. Hubungi Admin.' }
      }
    } else {
      // User is NOT in employees table (maybe they were deleted, or maybe they are a manually added Owner)
      // Check if they exist in system_settings user_roles
      const { data: settings } = await supabase.from('system_settings').select('value').eq('key', 'user_roles').single()
      const userRoles = Array.isArray(settings?.value) ? settings.value : []
      const userEmail = authData.user.email?.toLowerCase() || ''
      const matchedUser = userRoles.find(u => {
        const inputEmail = (u.email || '').trim().toLowerCase()
        return inputEmail === userEmail || `${inputEmail}@kingsablon.com` === userEmail
      })

      if (!matchedUser) {
        // Not an employee, and not in user_roles. Block them.
        await supabase.auth.signOut()
        return { error: 'Akun Anda tidak ditemukan atau sudah dihapus.' }
      }
    }

  } catch {
    return { error: 'Login gagal karena gangguan sistem. Coba lagi.' }
  }

  redirect('/dashboard')
}
