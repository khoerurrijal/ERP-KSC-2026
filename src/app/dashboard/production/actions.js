'use server'

import { createAuthorizedAdminClient } from '@/lib/adminAuth'
import { revalidatePath } from 'next/cache'
import { createAdminNotification } from '@/lib/adminNotifications'
import {
  getNextProductionColorPass,
  reconcileProductionColorPasses
} from '@/utils/productionColorPasses.mjs'

function getJakartaDateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(date)
  const year = parts.find(part => part.type === 'year')?.value
  const month = parts.find(part => part.type === 'month')?.value
  const day = parts.find(part => part.type === 'day')?.value
  return year && month && day ? `${year}-${month}-${day}` : ''
}

function getProductionProgressError(error) {
  const message = String(error?.message || error || 'Gagal menyimpan progress produksi.')
  if (message.includes('PRODUCTION_PROGRESS_CHANGED')) {
    return 'Progress pekerjaan ini baru saja diubah operator lain. Muat ulang daftar, cek sisa Qty, lalu input lagi. Qty dari form ini tidak disimpan.'
  }
  if (message.includes('PRODUCTION_JOB_NOT_FOUND')) {
    return 'Pekerjaan sudah tidak tersedia. Muat ulang daftar produksi.'
  }
  if (message.includes('PGRST202')) {
    return 'Pengaman simpan belum tersedia di database. Hubungi Admin sebelum mencatat progress.'
  }
  return message
}

function withProductionColorPass(notes, colorPass) {
  const cleanNotes = String(notes || '').replace(/\[\[WARNA_PASS:[12]\]\]/ig, '').trim()
  return [colorPass ? `[[WARNA_PASS:${colorPass}]]` : '', cleanNotes].filter(Boolean).join(' ')
}

export async function saveProductionProgress(payload) {
  const { supabase } = await createAuthorizedAdminClient(['ADMIN', 'OWNER', 'OPERATOR', 'OPERATOR MESIN'], 'Akun Anda tidak memiliki akses produksi.')

  try {
    const { data: job, error: jobError } = await supabase
      .from('sales_items')
      .select('id, notes, qty, unit_multiplier, production_logs(id, qty_processed, notes, processed_date, created_at)')
      .eq('id', payload.job_id)
      .maybeSingle()
    if (jobError) throw jobError
    if (!job) throw new Error('Pekerjaan sudah tidak tersedia. Muat ulang daftar produksi.')

    const isTwoColor = /2\s*warna|warna\s*ke-?2/i.test(job.notes || '')
    const processedQty = Number(payload.qty_processed)
    if (!Number.isSafeInteger(processedQty) || processedQty <= 0) {
      throw new Error('Qty produksi harus berupa bilangan bulat lebih dari 0.')
    }
    let automaticColorPass = ''
    const allTimeTotalQty = (job.production_logs || []).reduce((total, log) => (
      total + Number(log.qty_processed || 0)
    ), 0)
    if (isTwoColor) {
      const passTarget = Number(job.qty || 0) * Number(job.unit_multiplier || 1)
      if (!Number.isFinite(passTarget) || passTarget <= 0) throw new Error('Target Qty produk 2 warna tidak valid.')
      const reconciliation = reconcileProductionColorPasses([job], job.production_logs || [])
      const passTotals = reconciliation.colorPassTotalsByJobId.get(String(job.id)) || { 1: 0, 2: 0 }
      const nextPass = getNextProductionColorPass(passTotals[1], passTotals[2], passTarget)
      if (!nextPass) throw new Error('Kedua tahap warna sudah mencapai Qty pesanan.')

      automaticColorPass = String(nextPass)
      const remainingQty = Math.max(0, passTarget - Number(passTotals[nextPass] || 0))
      if (processedQty > remainingQty) {
        throw new Error(`Qty melebihi sisa otomatis Warna ke-${automaticColorPass} (${remainingQty} pcs). Tahap berikutnya terbuka setelah target ini selesai.`)
      }
    }

    const { error } = await supabase.rpc('record_production_progress_guarded', {
      p_job_id: payload.job_id,
      p_employee_id: payload.employee_id,
      p_qty_processed: payload.qty_processed,
      p_qty_defect: payload.qty_defect || 0,
      p_notes: withProductionColorPass(payload.notes, automaticColorPass),
      p_processed_date: getJakartaDateKey(),
      p_expected_total_qty: allTimeTotalQty,
      p_correction_total: null
    })

    if (error) throw error
    
    // We update the item status via the new centralized auto-status handler
    await handleAutoStatusUpdate(payload.job_id);

    revalidatePath('/dashboard/production')
    return { success: true }
} catch (err) {
    console.error('Error saving production log:', err)
    return { success: false, error: getProductionProgressError(err) }
  }
}

export async function handleAutoStatusUpdate(itemId) {
  const { supabase } = await createAuthorizedAdminClient(['ADMIN', 'OWNER', 'OPERATOR', 'OPERATOR MESIN'], 'Akun Anda tidak memiliki akses produksi.')

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
  } else if (['DLL', 'LAINNYA', 'JASA'].includes(item.order_type?.toUpperCase())) {
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
  const { supabase } = await createAuthorizedAdminClient(['ADMIN', 'OWNER', 'OPERATOR'], 'Akun Anda tidak memiliki akses produksi.')

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
  const { supabase } = await createAuthorizedAdminClient(['ADMIN', 'OWNER'], 'Hanya Admin/Owner yang dapat mengonfirmasi pengiriman.')

  try {
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

export async function correctProductionProgress(jobId, newTotalQty, employeeId, expectedTotalQty) {
  const { supabase } = await createAuthorizedAdminClient(['ADMIN', 'OWNER'])

  try {
    const correctedTotal = Number(newTotalQty)
    let expectedTotal = Number(expectedTotalQty)
    if (!Number.isFinite(expectedTotal)) {
      const { data: logs, error: logsError } = await supabase.from('production_logs').select('qty_processed').eq('job_id', jobId)
      if (logsError) throw logsError
      expectedTotal = (logs || []).reduce((sum, item) => sum + Number(item.qty_processed || 0), 0)
    }
    const { error } = await supabase.rpc('record_production_progress_guarded', {
      p_job_id: jobId,
      p_employee_id: employeeId,
      p_qty_processed: 0,
      p_qty_defect: 0,
      p_notes: 'Koreksi Qty oleh Admin',
      p_processed_date: getJakartaDateKey(),
      p_expected_total_qty: expectedTotal,
      p_correction_total: correctedTotal
    })

    if (error) throw error

    if (correctedTotal !== expectedTotal) {
      await handleAutoStatusUpdate(jobId);
    }
    
    revalidatePath('/dashboard/production')
    return { success: true }
  } catch (err) {
    console.error('Error correcting progress:', err)
    return { success: false, error: getProductionProgressError(err) }
  }
}

export async function updateProductionLogQty(logId, newQty, processedDate, expectedQty, expectedProcessedDate, newEmployeeId, expectedEmployeeId) {
  const { supabase } = await createAuthorizedAdminClient(['ADMIN', 'OWNER'], 'Hanya Admin/Owner yang dapat mengedit catatan produksi.')

  try {
    const nextQty = Number(newQty)
    const expected = Number(expectedQty)
    const nextDate = String(processedDate || '')
    const dateValue = new Date(`${nextDate}T00:00:00.000Z`)
    const isValidDate = /^\d{4}-\d{2}-\d{2}$/.test(nextDate) && Number.isFinite(dateValue.getTime()) && dateValue.toISOString().slice(0, 10) === nextDate
    const expectedDate = expectedProcessedDate || null
    const expectedEmployee = String(expectedEmployeeId || '')
    const nextEmployee = String(newEmployeeId || '')
    if (!logId || !Number.isSafeInteger(nextQty) || !Number.isSafeInteger(expected) || !isValidDate) {
      throw new Error('Tanggal atau Qty catatan produksi tidak valid.')
    }

    const { data: currentLog, error: readError } = await supabase
      .from('production_logs')
      .select('job_id, qty_processed, processed_date, employee_id')
      .eq('id', logId)
      .maybeSingle()

    if (readError) throw readError
    if (!currentLog) throw new Error('Catatan produksi sudah tidak tersedia. Muat ulang daftar.')
    if (Number(currentLog.qty_processed || 0) !== expected) {
      throw new Error('Catatan ini sudah berubah. Muat ulang daftar sebelum mengedit lagi.')
    }
    if ((currentLog.processed_date || null) !== expectedDate) {
      throw new Error('Tanggal catatan ini sudah berubah. Muat ulang daftar sebelum mengedit lagi.')
    }
    if (String(currentLog.employee_id || '') !== expectedEmployee) {
      throw new Error('Operator catatan ini sudah berubah. Muat ulang daftar sebelum mengedit lagi.')
    }

    const updateValues = { qty_processed: nextQty, processed_date: nextDate }
    if (nextEmployee !== expectedEmployee) {
      if (nextEmployee) {
        const { data: selectedEmployee, error: employeeError } = await supabase
          .from('employees')
          .select('id, is_active, salary_schemas(role_name)')
          .eq('id', nextEmployee)
          .maybeSingle()

        if (employeeError) throw employeeError
        const roleName = Array.isArray(selectedEmployee?.salary_schemas)
          ? selectedEmployee.salary_schemas[0]?.role_name
          : selectedEmployee?.salary_schemas?.role_name
        if (!selectedEmployee?.is_active || !String(roleName || '').toLowerCase().includes('operator')) {
          throw new Error('Pilih operator aktif yang valid.')
        }
      }
      updateValues.employee_id = nextEmployee || null
    }

    let updateQuery = supabase
      .from('production_logs')
      .update(updateValues)
      .eq('id', logId)
      .eq('qty_processed', expected)
    updateQuery = expectedDate
      ? updateQuery.eq('processed_date', expectedDate)
      : updateQuery.is('processed_date', null)
    updateQuery = expectedEmployee
      ? updateQuery.eq('employee_id', expectedEmployee)
      : updateQuery.is('employee_id', null)

    const { data: updatedLog, error: updateError } = await updateQuery.select('job_id').maybeSingle()

    if (updateError) throw updateError
    if (!updatedLog) throw new Error('Catatan ini baru saja berubah. Muat ulang daftar sebelum mengedit lagi.')

    await handleAutoStatusUpdate(updatedLog.job_id)
    revalidatePath('/dashboard/production')
    return { success: true }
  } catch (err) {
    console.error('Error updating production log:', err)
    return { success: false, error: err.message || 'Gagal menyimpan perubahan catatan produksi.' }
  }
}

export async function deleteProductionLog(logId, expectedLog) {
  const { supabase } = await createAuthorizedAdminClient(['ADMIN', 'OWNER'], 'Hanya Admin/Owner yang dapat menghapus catatan produksi.')

  try {
    const expectedQty = Number(expectedLog?.qty_processed)
    const expectedDefectRaw = expectedLog?.qty_defect ?? null
    const expectedDefect = Number(expectedDefectRaw || 0)
    const expectedDate = expectedLog?.processed_date || null
    const expectedEmployee = String(expectedLog?.employee_id || '')
    const expectedNotes = expectedLog?.notes ?? null
    const expectedJobId = String(expectedLog?.job_id || '')

    if (!logId || !expectedJobId || !Number.isSafeInteger(expectedQty) || !Number.isSafeInteger(expectedDefect)) {
      throw new Error('Data catatan tidak lengkap. Muat ulang daftar produksi.')
    }

    const { data: currentLog, error: readError } = await supabase
      .from('production_logs')
      .select('id, job_id, qty_processed, qty_defect, processed_date, employee_id, notes')
      .eq('id', logId)
      .maybeSingle()

    if (readError) throw readError
    if (!currentLog) throw new Error('Catatan produksi sudah tidak tersedia. Muat ulang daftar.')
    if (
      String(currentLog.job_id) !== expectedJobId ||
      Number(currentLog.qty_processed || 0) !== expectedQty ||
      Number(currentLog.qty_defect || 0) !== expectedDefect ||
      (currentLog.processed_date || null) !== expectedDate ||
      String(currentLog.employee_id || '') !== expectedEmployee ||
      (currentLog.notes ?? null) !== expectedNotes
    ) {
      throw new Error('Catatan ini sudah berubah. Muat ulang daftar sebelum menghapusnya.')
    }

    const { data: relatedItem, error: itemError } = await supabase
      .from('sales_items')
      .select('id')
      .eq('id', expectedJobId)
      .maybeSingle()
    if (itemError) throw itemError
    if (!relatedItem) throw new Error('Item pesanan terkait sudah tidak tersedia. Catatan tidak dihapus.')

    let deleteQuery = supabase
      .from('production_logs')
      .delete()
      .eq('id', logId)
      .eq('job_id', expectedJobId)
      .eq('qty_processed', expectedQty)
    deleteQuery = expectedDefectRaw === null
      ? deleteQuery.is('qty_defect', null)
      : deleteQuery.eq('qty_defect', expectedDefect)
    deleteQuery = expectedDate
      ? deleteQuery.eq('processed_date', expectedDate)
      : deleteQuery.is('processed_date', null)
    deleteQuery = expectedEmployee
      ? deleteQuery.eq('employee_id', expectedEmployee)
      : deleteQuery.is('employee_id', null)
    deleteQuery = expectedNotes === null
      ? deleteQuery.is('notes', null)
      : deleteQuery.eq('notes', expectedNotes)

    const { data: deletedLog, error: deleteError } = await deleteQuery.select('id, job_id').maybeSingle()
    if (deleteError) throw deleteError
    if (!deletedLog) throw new Error('Catatan ini baru saja berubah. Muat ulang daftar sebelum menghapusnya.')

    await handleAutoStatusUpdate(deletedLog.job_id)
    revalidatePath('/dashboard/production')
    return { success: true }
  } catch (err) {
    console.error('Error deleting production log:', err)
    return { success: false, error: err.message || 'Gagal menghapus catatan produksi.' }
  }
}
