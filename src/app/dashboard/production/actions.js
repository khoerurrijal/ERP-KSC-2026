'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { createAdminNotification } from '@/lib/adminNotifications'

export async function saveProductionProgress(payload) {
  const supabase = await createClient()

  try {
    const { error } = await supabase
      .from('production_logs')
      .insert([{
        job_id: payload.job_id,
        employee_id: payload.employee_id,
        qty_processed: payload.qty_processed,
        qty_defect: payload.qty_defect || 0,
        notes: payload.notes || '',
        processed_date: new Date().toISOString()
      }])
    
    if (error) throw error

    // Cek total produksi untuk auto-status "SUDAH JADI"
    const { data: logs } = await supabase.from('production_logs').select('qty_processed').eq('job_id', payload.job_id)
    const totalProcessed = (logs || []).reduce((sum, item) => sum + item.qty_processed, 0)
    
    // We update the item status via the new centralized auto-status handler
    await handleAutoStatusUpdate(payload.job_id);

    revalidatePath('/dashboard/production')
    return { success: true }
} catch (err) {
    console.error('Error saving production log:', err)
    return { success: false, error: err.message }
  }
}

export async function handleAutoStatusUpdate(itemId) {
  const supabase = await createClient()

  // Ambil data item dan invoice
  const { data: item } = await supabase.from('sales_items').select('*, sales_orders(invoice_number, payment_status, marketplace_receipt, customers(name))').eq('id', itemId).single()
  if (!item) return;

  const so = item.sales_orders;
  if (!so) return;

  const isLunas = so.payment_status === 'LUNAS';
  const isPaid = so.payment_status === 'LUNAS' || so.payment_status === 'DP';
  
  const customerName = so.customers?.name?.toLowerCase() || '';
  const isMarketplace = (so.marketplace_receipt && so.marketplace_receipt.trim() !== '') || 
                        customerName.includes('shopee') || 
                        customerName.includes('tokopedia') || 
                        customerName.includes('tiktok') || 
                        customerName.includes('lazada');
                        
  const canProceed = isPaid || isMarketplace;

  // Hitung qty processed
  const { data: logs } = await supabase.from('production_logs').select('qty_processed').eq('job_id', itemId)
  const qtyProcessed = (logs || []).reduce((sum, log) => sum + (log.qty_processed || 0), 0)
  
  const ST_BARU_MASUK = 'BARU MASUK'
  const ST_SIAP_PROSES = 'SIAP PROSES'
  const ST_PROSES = 'PROSES'
  const ST_SUDAH_JADI = 'SUDAH JADI'
  const ST_SIAP_KIRIM = 'SIAP KIRIM'
  const ST_DIKIRIM = 'DIKIRIM'
  const ST_SUDAH_DIAMBIL = 'SUDAH DIAMBIL'
  const ST_SELESAI = 'SELESAI'

  let newStatus = item.status || ST_BARU_MASUK;
  const oldStatus = newStatus;

  // Hitung target sebenarnya (memperhitungkan unit_multiplier misal jika beli per dus)
  const targetQty = item.qty * (item.unit_multiplier || 1) * (/2\s*warna|warna\s*ke-?2/i.test(item.notes || '') ? 2 : 1);

  if (item.order_type?.toUpperCase() === 'PRINTING') {
    // RULE UNTUK PRINTING: Bypass otomatisasi, admin yang atur di menu Sales Item Status.
    // Tidak masuk antrean produksi dan tidak lompat otomatis.
    newStatus = oldStatus;
  } else if (item.order_type?.toUpperCase() === 'POLOS') {
    // RULE UNTUK POLOS: Langsung siap kirim jika sudah DP/Lunas atau dari Marketplace
    if (!canProceed) {
      newStatus = ST_BARU_MASUK;
    } else {
      if (newStatus !== ST_DIKIRIM && newStatus !== ST_SUDAH_DIAMBIL && newStatus !== ST_SELESAI) {
        newStatus = ST_SIAP_KIRIM;
      }
    }
  } else if (item.order_type?.toUpperCase() === 'LAINNYA' || item.order_type?.toUpperCase() === 'JASA') {
    // Layanan non-produksi seperti desain/ongkir tidak mengikuti alur produksi.
    newStatus = oldStatus;
  } else {
    // RULE UNTUK SABLON
    // RULE 1: Jika Qty Dikerjakan > 0 tapi < Target
    if (qtyProcessed > 0 && qtyProcessed < targetQty) {
      newStatus = ST_PROSES;
    }

    // RULE 2: Jika Qty Dikerjakan == Target
    if (qtyProcessed >= targetQty) {
      if (newStatus !== ST_DIKIRIM && newStatus !== ST_SUDAH_DIAMBIL && newStatus !== ST_SELESAI) {
        newStatus = ST_SIAP_KIRIM; // Otomatis lompat ke Siap Kirim (indikator Menunggu Lunas akan nyala di frontend kalau belum lunas)
      }
    } else if (qtyProcessed === 0) {
      // Jika qty = 0 (bisa jadi direset oleh admin)
      // Cek apakah ini data lama yang tidak punya log sama sekali tapi statusnya sudah selesai/dikirim
      const hasNoLogs = !logs || logs.length === 0;
      const isOldDataFinished = hasNoLogs && [ST_SUDAH_JADI, ST_SIAP_KIRIM, ST_DIKIRIM, ST_SUDAH_DIAMBIL, ST_SELESAI].includes(oldStatus);
      
      if (!isOldDataFinished) {
        if (!canProceed) {
          newStatus = ST_BARU_MASUK;
        } else {
          newStatus = ST_SIAP_PROSES;
        }
      }
    }
  }

  // RULE 3: Finalisasi Fisik (Dikirim -> Selesai)
  if ((newStatus === ST_DIKIRIM || newStatus === ST_SUDAH_DIAMBIL) && isLunas) {
    newStatus = ST_SELESAI;
  }

  if (newStatus !== oldStatus) {
    await supabase.from('sales_items').update({ status: newStatus }).eq('id', itemId);
    if (oldStatus !== 'BARU MASUK' || newStatus !== 'SIAP PROSES') {
      await createAdminNotification(supabase, {
        notificationType: 'PRODUCTION_STATUS',
        title: 'Status produksi berubah',
        message: `${so.invoice_number || 'Pesanan'}: ${oldStatus} → ${newStatus}.`,
        href: '/dashboard/production',
        entityId: itemId
      })
    }
  }
}

export async function updateSalesOrderStatus(itemId, status) {
  const supabase = await createClient()

  try {
    const { data: item } = await supabase.from('sales_items').select('*, sales_orders(invoice_number, payment_status)').eq('id', itemId).single()
    const oldStatus = String(item?.status || 'BARU MASUK').toUpperCase()
    let finalStatus = status;
    const isLunas = item?.sales_orders?.payment_status === 'LUNAS';

    const { data: settingsData } = await supabase.from('system_settings').select('value').eq('key', 'dropdown_config').single()
    const dropdownConfig = settingsData?.value || {}
    const statuses = dropdownConfig.production_status || ['DRAFT', 'BARU MASUK', 'SIAP PROSES', 'PROSES', 'SUDAH JADI', 'SIAP KIRIM', 'DIKIRIM', 'SUDAH DIAMBIL', 'SELESAI']
    
    const ST_DIKIRIM = statuses[6] || 'DIKIRIM'
    const ST_SUDAH_DIAMBIL = statuses[7] || 'SUDAH DIAMBIL'
    const ST_SELESAI = statuses[8] || 'SELESAI'

    // Finalisasi Fisik (Dikirim -> Selesai)
    if ((finalStatus === ST_DIKIRIM || finalStatus === ST_SUDAH_DIAMBIL) && isLunas) {
      finalStatus = ST_SELESAI;
    }

    const { error } = await supabase
      .from('sales_items')
      .update({ status: finalStatus })
      .eq('id', itemId)
    
    if (error) throw error

    if (oldStatus !== String(finalStatus).toUpperCase()) {
      await createAdminNotification(supabase, {
        notificationType: 'PRODUCTION_STATUS',
        title: 'Status produksi berubah',
        message: `${item?.sales_orders?.invoice_number || 'Pesanan'}: ${oldStatus} → ${String(finalStatus).toUpperCase()}.`,
        href: '/dashboard/production',
        entityId: itemId
      })
    }

    revalidatePath('/dashboard/production')
    revalidatePath('/dashboard/sales')
    revalidatePath('/track')
    return { success: true }
  } catch (err) {
    console.error('Error updating status:', err)
    return { success: false, error: err.message }
  }
}

const DELIVERY_ORDER_TYPES = new Set(['SABLON', 'POLOS', 'PRINTING'])
const DELIVERY_READY_STATUSES = new Set(['SIAP KIRIM', 'SUDAH JADI', 'DIKIRIM', 'SUDAH DIAMBIL', 'SELESAI'])
const LEGACY_SERVICE_CODES = new Set(['SRV-FAST-TRACK', 'FAST-TRACK', 'SRV-2-WARNA', 'BIAYA-WARNA'])

const normalizeRelation = (value) => Array.isArray(value) ? value[0] : value

export async function confirmInvoiceDelivery(soId, deliveryStatus) {
  const supabase = await createClient()

  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Sesi login tidak ditemukan.')

    const { data: rolesData, error: rolesError } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', 'user_roles')
      .single()

    if (rolesError) throw rolesError

    const userEmail = user.email?.toLowerCase() || ''
    const matchedUser = (rolesData?.value || []).find(role => {
      const inputEmail = (role.email || '').trim().toLowerCase()
      return inputEmail === userEmail || `${inputEmail}@kingsablon.com` === userEmail
    })
    const userRole = matchedUser?.role || 'Operator'

    if (!['ADMIN', 'OWNER'].includes(String(userRole).toUpperCase())) {
      throw new Error('Hanya Admin/Owner yang dapat mengonfirmasi pengiriman.')
    }

    if (!soId || !['DIKIRIM', 'SUDAH DIAMBIL'].includes(String(deliveryStatus).toUpperCase())) {
      throw new Error('Invoice atau jenis serah-terima tidak valid.')
    }

    const requestedStatus = String(deliveryStatus).toUpperCase()
    const { data: items, error: itemsError } = await supabase
      .from('sales_items')
      .select('id, status, order_type, product_code, sales_orders(invoice_number, payment_status), products(category)')
      .eq('so_id', soId)

    if (itemsError) throw itemsError

    const deliveryItems = (items || []).filter(item => {
      const code = String(item.product_code || '').toUpperCase()
      return !LEGACY_SERVICE_CODES.has(code) && DELIVERY_ORDER_TYPES.has(String(item.order_type || '').toUpperCase()) && String(item.status || '').toUpperCase() !== 'BATAL'
    })

    if (deliveryItems.length === 0) {
      throw new Error('Invoice ini tidak memiliki item yang perlu diserah-terimakan.')
    }

    const notReady = deliveryItems.filter(item => !DELIVERY_READY_STATUSES.has(String(item.status || '').toUpperCase()))
    if (notReady.length > 0) {
      throw new Error('Belum semua item dalam invoice siap dikirim.')
    }

    const order = normalizeRelation(deliveryItems[0].sales_orders)
    const isLunas = order?.payment_status === 'LUNAS'
    const nextStatus = isLunas ? 'SELESAI' : requestedStatus
    const pendingIds = deliveryItems
      .filter(item => {
        const status = String(item.status || '').toUpperCase()
        return isLunas ? status !== 'SELESAI' : ['SIAP KIRIM', 'SUDAH JADI'].includes(status)
      })
      .map(item => item.id)

    if (pendingIds.length > 0) {
      const { error: updateError } = await supabase
        .from('sales_items')
        .update({ status: nextStatus })
        .in('id', pendingIds)

      if (updateError) throw updateError

      await createAdminNotification(supabase, {
        notificationType: 'DELIVERY_STATUS',
        title: 'Pesanan diserahterimakan',
        message: `${order?.invoice_number || 'Pesanan'} berubah menjadi ${nextStatus}.`,
        href: '/dashboard/production/shipping',
        entityId: soId
      })
    }

    revalidatePath('/dashboard/production')
    revalidatePath('/dashboard/production/shipping')
    revalidatePath('/dashboard/sales')
    revalidatePath('/track')
    return { success: true, updatedCount: pendingIds.length, finalStatus: nextStatus }
  } catch (err) {
    console.error('Error confirming invoice delivery:', err)
    return { success: false, error: err.message }
  }
}

export async function correctProductionProgress(jobId, newTotalQty, employeeId) {
  const supabase = await createClient()

  try {
    const { data: logs } = await supabase.from('production_logs').select('qty_processed').eq('job_id', jobId)
    const currentTotal = (logs || []).reduce((sum, item) => sum + item.qty_processed, 0)
    
    const adjustment = Number(newTotalQty) - currentTotal;
    
    if (adjustment !== 0) {
      const { error } = await supabase
        .from('production_logs')
        .insert([{
          job_id: jobId,
          employee_id: employeeId,
          qty_processed: adjustment,
          qty_defect: 0,
          notes: 'Koreksi Qty oleh Admin',
          processed_date: new Date().toISOString()
        }])
      
      if (error) throw error;
      
      await handleAutoStatusUpdate(jobId);
    }
    
    revalidatePath('/dashboard/production')
    return { success: true }
  } catch (err) {
    console.error('Error correcting progress:', err)
    return { success: false, error: err.message }
  }
}
