export async function createAdminNotification(supabase, payload) {
  try {
    const { error } = await supabase.from('admin_notifications').insert({
      notification_type: payload.notificationType,
      title: payload.title,
      message: payload.message,
      href: payload.href || null,
      entity_id: payload.entityId || null
    })

    if (error) throw error
    return { success: true }
  } catch (error) {
    // Notifikasi tidak boleh menghentikan transaksi operasional utama.
    console.error('Admin notification error:', error)
    return { success: false, error: error.message }
  }
}
