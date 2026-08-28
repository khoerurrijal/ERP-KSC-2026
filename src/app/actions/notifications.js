'use server'

import { createClient } from '@/utils/supabase/server'
import { requireAdminOrOwner } from '@/lib/adminAuth'
import { revalidatePath } from 'next/cache'

export async function getAdminNotifications() {
  const supabase = await createClient()

  try {
    await requireAdminOrOwner(supabase)
    const { data, error } = await supabase
      .from('admin_notifications')
      .select('id, notification_type, title, message, href, entity_id, read_at, created_at')
      .order('created_at', { ascending: false })
      .limit(30)

    if (error) throw error
    return {
      success: true,
      notifications: data || [],
      unreadCount: (data || []).filter(item => !item.read_at).length
    }
  } catch (error) {
    return { success: false, error: error.message, notifications: [], unreadCount: 0 }
  }
}

export async function markAdminNotificationRead(notificationId) {
  const supabase = await createClient()

  try {
    await requireAdminOrOwner(supabase)
    const { error } = await supabase
      .from('admin_notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', notificationId)

    if (error) throw error
    revalidatePath('/dashboard')
    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
}
