'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { createSalesOrder } from '@/app/actions/sales'
import { requireAdminOrOwner } from '@/lib/adminAuth'
import { createAdminNotification } from '@/lib/adminNotifications'

export async function approveCustomerOrderRequest(requestId, payload) {
  const supabase = await createClient()

  try {
    const { user } = await requireAdminOrOwner(supabase)
    const { data: request, error: requestError } = await supabase
      .from('customer_order_requests')
      .select('id, request_number, customer_code, sales_order_id')
      .eq('id', requestId)
      .single()

    if (requestError) throw requestError
    if (request.sales_order_id) {
      return { success: true, alreadyApproved: true, salesOrderId: request.sales_order_id }
    }

    if (!payload?.customerId || !Array.isArray(payload.items) || payload.items.length === 0) {
      throw new Error('Customer dan minimal satu item wajib diisi.')
    }

    // Idempotency guard: aman walaupun tombol konfirmasi terpencet dua kali.
    const { data: existingOrder, error: existingOrderError } = await supabase
      .from('sales_orders')
      .select('id')
      .eq('source_request_id', requestId)
      .maybeSingle()

    if (!existingOrderError && existingOrder?.id) {
      await supabase.from('customer_order_requests').update({
        sales_order_id: existingOrder.id,
        approved_at: new Date().toISOString(),
        approved_by: user.email
      }).eq('id', requestId).is('sales_order_id', null)
      return { success: true, alreadyApproved: true, salesOrderId: existingOrder.id }
    }

    const result = await createSalesOrder({ ...payload, sourceRequestId: requestId })
    if (!result.success) throw new Error(result.error)

    const { data: linkedOrder, error: linkError } = await supabase
      .from('sales_orders')
      .select('id')
      .eq('invoice_number', result.invoice_number)
      .single()
    if (linkError) throw linkError

    const { error: updateError } = await supabase
      .from('customer_order_requests')
      .update({
        sales_order_id: linkedOrder.id,
        approved_at: new Date().toISOString(),
        approved_by: user.email
      })
      .eq('id', requestId)
      .is('sales_order_id', null)

    if (updateError) throw updateError

    await createAdminNotification(supabase, {
      notificationType: 'ORDER_APPROVED',
      title: 'Pesanan customer disetujui',
      message: `${request.request_number} sudah masuk ke Sales Order ${result.invoice_number}.`,
      href: `/sales?search=${encodeURIComponent(result.invoice_number)}`,
      entityId: linkedOrder.id
    })

    revalidatePath('/dashboard/order-requests')
    revalidatePath('/dashboard/sales')
    revalidatePath('/dashboard')
    return { success: true, invoiceNumber: result.invoice_number, salesOrderId: linkedOrder.id }
  } catch (error) {
    console.error('Approve customer order request error:', error)
    return { success: false, error: error.message }
  }
}
