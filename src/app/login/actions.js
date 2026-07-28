'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'

export async function login(formData) {
  const supabase = await createClient()

  const username = formData.get('username')
  const email = username.includes('@') ? username : `${username}@kingsablon.com`

  const data = {
    email: email,
    password: formData.get('password'),
  }

  const { error, data: authData } = await supabase.auth.signInWithPassword(data)

  if (error) {
    return { error: error.message }
  }

  if (authData?.user) {
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
      const userRoles = settings?.value || []
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
  }

  return { success: true }
}
