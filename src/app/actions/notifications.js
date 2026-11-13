'use server'

import { createAuthorizedAdminClient } from '@/lib/adminAuth'
import { revalidatePath } from 'next/cache'

function relationRecord(value) {
  return Array.isArray(value) ? value[0] : value
}

function customerNameFromOrder(order) {
  const customer = relationRecord(order?.customers)
  return customer?.name || null
}

function formatSalesOrderNotification(notification, customerName) {
  const fallbackName = customerName || 'Customer tidak diketahui'
  const message = String(notification.message || '')
  const withoutInvoice = message.replace(/INV-[A-Z0-9-]+/gi, fallbackName)

  if (notification.notification_type === 'ORDER_APPROVED') {
    return `${fallbackName} — Sales Order disetujui.`
  }

  if (notification.notification_type === 'PAYMENT_STATUS') {
    const details = withoutInvoice.replace(/^\s*[^:]+:\s*/, '')
    return `${fallbackName}: ${details}`
  }

  if (notification.notification_type === 'PRODUCTION_STATUS') {
    const details = withoutInvoice.replace(/^\s*[^:]+:\s*/, '')
    return `${fallbackName}: ${details}`
  }

  return withoutInvoice
}

export async function getAdminNotifications() {
  try {
    const { supabase } = await createAuthorizedAdminClient(['ADMIN', 'OWNER'])
    const { data, error } = await supabase
      .from('admin_notifications')
      .select('id, notification_type, title, message, href, entity_id, read_at, created_at')
      .order('created_at', { ascending: false })
      .limit(30)

    if (error) throw error
    const notifications = data || []
    const orderNotificationTypes = new Set(['PAYMENT_STATUS', 'DELIVERY_STATUS', 'ORDER_APPROVED'])
    const orderIds = [...new Set(notifications
      .filter(item => orderNotificationTypes.has(item.notification_type) && item.entity_id)
      .map(item => item.entity_id))]
    const productionItemIds = [...new Set(notifications
      .filter(item => item.notification_type === 'PRODUCTION_STATUS' && item.entity_id)
      .map(item => item.entity_id))]

    const [ordersResult, itemsResult] = await Promise.all([
      orderIds.length
        ? supabase.from('sales_orders').select('id, customers(name)').in('id', orderIds)
        : Promise.resolve({ data: [] }),
      productionItemIds.length
        ? supabase.from('sales_items').select('id, sales_orders(customers(name))').in('id', productionItemIds)
        : Promise.resolve({ data: [] })
    ])

    const customerByOrderId = new Map((ordersResult.data || []).map(order => [
      order.id,
      customerNameFromOrder(order)
    ]))
    const customerByItemId = new Map((itemsResult.data || []).map(item => {
      const order = relationRecord(item.sales_orders)
      return [item.id, customerNameFromOrder(order)]
    }))

    const formattedNotifications = notifications.map(item => {
      if (!['PAYMENT_STATUS', 'DELIVERY_STATUS', 'ORDER_APPROVED', 'PRODUCTION_STATUS'].includes(item.notification_type)) {
        return item
      }

      const customerName = item.notification_type === 'PRODUCTION_STATUS'
        ? customerByItemId.get(item.entity_id)
        : customerByOrderId.get(item.entity_id)

      return {
        ...item,
        message: formatSalesOrderNotification(item, customerName)
      }
    })

    return {
      success: true,
      notifications: formattedNotifications,
      unreadCount: notifications.filter(item => !item.read_at).length
    }
  } catch (error) {
    return { success: false, error: error.message, notifications: [], unreadCount: 0 }
  }
}

export async function markAdminNotificationRead(notificationId) {
  try {
    const { supabase } = await createAuthorizedAdminClient(['ADMIN', 'OWNER'])
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

export async function markAllAdminNotificationsRead() {
  try {
    const { supabase } = await createAuthorizedAdminClient(['ADMIN', 'OWNER'])
    const { error } = await supabase
      .from('admin_notifications')
      .update({ read_at: new Date().toISOString() })
      .is('read_at', null)

    if (error) throw error
    revalidatePath('/dashboard')
    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
}
