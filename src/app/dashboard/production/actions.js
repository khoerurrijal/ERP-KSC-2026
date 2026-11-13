'use server'

import { createAuthorizedAdminClient } from '@/lib/adminAuth'
import { revalidatePath } from 'next/cache'
import { createAdminNotification } from '@/lib/adminNotifications'
import {
  getProductionItemProgress,
  getRecalculatedProductionStatus,
  isProductionPassQtyWithinTarget,
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
  if (message.includes('PRODUCTION_LOG_NOT_FOUND')) {
    return 'Catatan produksi sudah berubah atau dihapus. Muat ulang daftar produksi.'
  }
  if (message.includes('PRODUCTION_STATUS_INVALID')) {
    return 'Status hasil kalkulasi produksi tidak valid. Muat ulang daftar produksi.'
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

function getProductionLogSnapshot(logs = []) {
  return [...logs]
    .sort((a, b) => String(a.id) < String(b.id) ? -1 : String(a.id) > String(b.id) ? 1 : 0)
    .map(log => ({
      id: String(log.id),
      qty_processed: Number(log.qty_processed || 0),
      qty_defect: log.qty_defect == null ? null : Number(log.qty_defect),
      notes: log.notes ?? null,
      processed_date: log.processed_date || null,
      employee_id: log.employee_id ? String(log.employee_id) : null
    }))
}

function getOrderCanProceed(item) {
  const so = item?.sales_orders || {}
  const isPaid = so.payment_status === 'LUNAS' || so.payment_status === 'DP'
  const customerName = so.customers?.name?.toLowerCase() || ''
  const isMarketplace = Boolean(so.marketplace_receipt?.trim()) ||
    ['shopee', 'tokopedia', 'tiktok', 'lazada'].some(name => customerName.includes(name))
  return isPaid || isMarketplace
}

function getNextItemProductionStatus(item, logs, { forceRecalculate = false } = {}) {
  const so = item?.sales_orders || {}
  const canProceed = getOrderCanProceed(item)
  const orderType = String(item?.order_type || '').toUpperCase()
  const storedStatus = item?.status || 'BARU MASUK'
  const oldStatus = String(storedStatus).toUpperCase()
  const deliveredStatuses = ['DIKIRIM', 'SUDAH DIAMBIL', 'SELESAI']
  let nextStatus = oldStatus

  if (orderType === 'PRINTING' || ['DLL', 'LAINNYA', 'JASA'].includes(orderType)) {
    return storedStatus
  }

  if (orderType === 'POLOS') {
    if (!canProceed) nextStatus = 'BARU MASUK'
    else if (!deliveredStatuses.includes(oldStatus)) nextStatus = 'SIAP KIRIM'
  } else {
    nextStatus = getRecalculatedProductionStatus(item, logs, {
      canProceed,
      currentStatus: oldStatus,
      forceRecalculate
    })
  }

  if ((nextStatus === 'DIKIRIM' || nextStatus === 'SUDAH DIAMBIL') && so.payment_status === 'LUNAS') {
    nextStatus = 'SELESAI'
  }
  return String(nextStatus).toUpperCase() === oldStatus ? storedStatus : nextStatus
}

async function mutateProductionLogAtomically(supabase, {
  jobId,
  logId = null,
  operation,
  logs,
  qtyProcessed = null,
  qtyDefect = null,
  notes = null,
  processedDate = null,
  employeeId = null,
  nextStatus,
  correctionTotal = null
}) {
  const { data, error } = await supabase.rpc('mutate_production_log_and_status', {
    p_job_id: jobId,
    p_log_id: logId,
    p_operation: operation,
    p_expected_logs: getProductionLogSnapshot(logs),
    p_qty_processed: qtyProcessed,
    p_qty_defect: qtyDefect,
    p_notes: notes,
    p_processed_date: processedDate,
    p_employee_id: employeeId,
    p_next_status: nextStatus,
    p_correction_total: correctionTotal
  })
  if (error) throw error
  return data
}

async function notifyProductionStatusChange(supabase, itemId, invoiceNumber, oldStatus, newStatus) {
  if (!newStatus || oldStatus === newStatus || (oldStatus === 'BARU MASUK' && newStatus === 'SIAP PROSES')) return
  try {
    await createAdminNotification(supabase, {
      notificationType: 'PRODUCTION_STATUS',
      title: 'Status produksi berubah',
      message: `${invoiceNumber || 'Pesanan'}: ${oldStatus} → ${newStatus}.`,
      href: '/dashboard/production',
      entityId: itemId
    })
  } catch (error) {
    console.error('Production status notification failed:', error)
  }
}

export async function saveProductionProgress(payload) {
  const { supabase } = await createAuthorizedAdminClient(['ADMIN', 'OWNER', 'OPERATOR', 'OPERATOR MESIN'], 'Akun Anda tidak memiliki akses produksi.')

  try {
    const { data: job, error: jobError } = await supabase
      .from('sales_items')
      .select('id, notes, qty, unit_multiplier, order_type, status, sales_orders(invoice_number, payment_status, marketplace_receipt, customers(name)), production_logs(id, qty_processed, qty_defect, employee_id, notes, processed_date, created_at)')
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
    const logs = job.production_logs || []
    if (isTwoColor) {
      const progress = getProductionItemProgress(job, logs)
      const passTarget = progress.targetPerColor
      if (!Number.isFinite(passTarget) || passTarget <= 0) throw new Error('Target Qty produk 2 warna tidak valid.')
      const nextPass = progress.nextColorPass
      if (!nextPass) throw new Error('Kedua tahap warna sudah mencapai Qty pesanan.')

      automaticColorPass = String(nextPass)
      const completedQty = nextPass === 1 ? progress.qtyColorOne : progress.qtyColorTwo
      const remainingQty = Math.max(0, passTarget - completedQty)
      if (!isProductionPassQtyWithinTarget(processedQty, completedQty, passTarget)) {
        throw new Error(`Qty melebihi sisa otomatis Warna ke-${automaticColorPass} (${remainingQty} pcs). Tahap berikutnya terbuka setelah target ini selesai.`)
      }
    }

    const processedDate = getJakartaDateKey()
    const logNotes = withProductionColorPass(payload.notes, automaticColorPass)
    const projectedLogs = [
      ...logs,
      {
        id: '__pending_production_log__',
        job_id: job.id,
        employee_id: payload.employee_id || null,
        qty_processed: processedQty,
        qty_defect: Number(payload.qty_defect || 0),
        notes: logNotes,
        processed_date: processedDate,
        created_at: new Date().toISOString()
      }
    ]
    const nextStatus = getNextItemProductionStatus(job, projectedLogs, { forceRecalculate: true })
    const result = await mutateProductionLogAtomically(supabase, {
      jobId: job.id,
      operation: 'INSERT',
      logs,
      qtyProcessed: processedQty,
      qtyDefect: Number(payload.qty_defect || 0),
      notes: logNotes,
      processedDate,
      employeeId: payload.employee_id || null,
      nextStatus
    })
    await notifyProductionStatusChange(supabase, job.id, job.sales_orders?.invoice_number, result?.old_status, result?.new_status)

    revalidatePath('/dashboard/production')
    revalidatePath('/dashboard/production/shipping')
    revalidatePath('/track')
    return { success: true }
} catch (err) {
    console.error('Error saving production log:', err)
    return { success: false, error: getProductionProgressError(err) }
  }
}

export async function handleAutoStatusUpdate(itemId, { forceRecalculate = false } = {}) {
  const { supabase } = await createAuthorizedAdminClient(['ADMIN', 'OWNER', 'OPERATOR', 'OPERATOR MESIN'], 'Akun Anda tidak memiliki akses produksi.')

  // Ambil data item dan invoice
  const { data: item, error: itemError } = await supabase.from('sales_items').select('*, sales_orders(invoice_number, payment_status, marketplace_receipt, customers(name))').eq('id', itemId).single()
  if (itemError) throw itemError
  if (!item) return;

  const so = item.sales_orders;
  if (!so) return;
  const oldStatus = String(item.status || 'BARU MASUK').toUpperCase()
  const { data: logs, error: logsError } = await supabase
    .from('production_logs')
    .select('id, job_id, employee_id, qty_processed, qty_defect, notes, processed_date, created_at')
    .eq('job_id', itemId)
  if (logsError) throw logsError

  const newStatus = getNextItemProductionStatus(item, logs || [], { forceRecalculate })

  if (String(newStatus).toUpperCase() !== oldStatus) {
    const { error: statusError } = await supabase.from('sales_items').update({ status: newStatus }).eq('id', itemId)
    if (statusError) throw statusError
    await notifyProductionStatusChange(supabase, itemId, so.invoice_number, oldStatus, newStatus)
  }
  return { success: true, status: newStatus }
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
    if (!Number.isSafeInteger(correctedTotal) || correctedTotal < 0) {
      throw new Error('Qty koreksi harus berupa bilangan bulat nol atau lebih.')
    }
    const { data: job, error: jobError } = await supabase
      .from('sales_items')
      .select('id, qty, unit_multiplier, notes, order_type, status, sales_orders(invoice_number, payment_status, marketplace_receipt, customers(name)), production_logs(id, qty_processed, qty_defect, employee_id, notes, processed_date, created_at)')
      .eq('id', jobId)
      .maybeSingle()
    if (jobError) throw jobError
    if (!job) throw new Error('Pekerjaan sudah tidak tersedia. Muat ulang daftar produksi.')

    const logs = job.production_logs || []
    const currentTotal = logs.reduce((sum, log) => sum + Number(log.qty_processed || 0), 0)
    const expectedTotal = Number(expectedTotalQty)
    const currentProgress = getProductionItemProgress(job, logs).qtyActivity
    if (Number.isSafeInteger(expectedTotal) && currentProgress !== expectedTotal) {
      throw new Error('Progress pekerjaan ini baru saja berubah. Muat ulang daftar sebelum mengoreksi lagi.')
    }
    const processedDate = getJakartaDateKey()
    const correctionQty = correctedTotal - currentTotal
    const projectedLogs = correctionQty === 0 ? logs : [
      ...logs,
      {
        id: '__pending_production_correction__',
        job_id: job.id,
        employee_id: employeeId || null,
        qty_processed: correctionQty,
        qty_defect: 0,
        notes: 'Koreksi Qty oleh Admin',
        processed_date: processedDate,
        created_at: new Date().toISOString()
      }
    ]
    const nextStatus = getNextItemProductionStatus(job, projectedLogs, { forceRecalculate: true })
    const result = await mutateProductionLogAtomically(supabase, {
      jobId: job.id,
      operation: 'CORRECT',
      logs,
      qtyProcessed: 0,
      qtyDefect: 0,
      notes: 'Koreksi Qty oleh Admin',
      processedDate,
      employeeId: employeeId || null,
      nextStatus,
      correctionTotal: correctedTotal
    })
    await notifyProductionStatusChange(supabase, job.id, job.sales_orders?.invoice_number, result?.old_status, result?.new_status)

    revalidatePath('/dashboard/production')
    revalidatePath('/dashboard/production/shipping')
    revalidatePath('/dashboard/sales')
    revalidatePath('/track')
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

    let nextEmployeeId = expectedEmployee || null
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
      nextEmployeeId = nextEmployee || null
    }

    const { data: item, error: itemError } = await supabase
      .from('sales_items')
      .select('id, qty, unit_multiplier, notes, order_type, status, sales_orders(invoice_number, payment_status, marketplace_receipt, customers(name))')
      .eq('id', currentLog.job_id)
      .maybeSingle()
    if (itemError) throw itemError
    if (!item) throw new Error('Item pesanan terkait sudah tidak tersedia. Catatan tidak diedit.')

    const { data: logs, error: logsError } = await supabase
      .from('production_logs')
      .select('id, job_id, employee_id, qty_processed, qty_defect, notes, processed_date, created_at')
      .eq('job_id', currentLog.job_id)
    if (logsError) throw logsError
    const currentLogs = logs || []
    const projectedLogs = currentLogs.map(log => String(log.id) === String(logId)
      ? { ...log, qty_processed: nextQty, processed_date: nextDate, employee_id: nextEmployeeId }
      : log)
    const nextStatus = getNextItemProductionStatus(item, projectedLogs, { forceRecalculate: true })
    const result = await mutateProductionLogAtomically(supabase, {
      jobId: item.id,
      logId,
      operation: 'UPDATE',
      logs: currentLogs,
      qtyProcessed: nextQty,
      processedDate: nextDate,
      employeeId: nextEmployeeId,
      nextStatus
    })
    await notifyProductionStatusChange(supabase, item.id, item.sales_orders?.invoice_number, result?.old_status, result?.new_status)

    revalidatePath('/dashboard/production')
    revalidatePath('/dashboard/production/shipping')
    revalidatePath('/dashboard/sales')
    revalidatePath('/track')
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
      .select('id, qty, unit_multiplier, notes, order_type, status, sales_orders(invoice_number, payment_status, marketplace_receipt, customers(name))')
      .eq('id', expectedJobId)
      .maybeSingle()
    if (itemError) throw itemError
    if (!relatedItem) throw new Error('Item pesanan terkait sudah tidak tersedia. Catatan tidak dihapus.')

    const { data: logs, error: logsError } = await supabase
      .from('production_logs')
      .select('id, job_id, employee_id, qty_processed, qty_defect, notes, processed_date, created_at')
      .eq('job_id', expectedJobId)
    if (logsError) throw logsError
    const currentLogs = logs || []
    const projectedLogs = currentLogs.filter(log => String(log.id) !== String(logId))
    if (projectedLogs.length === currentLogs.length) {
      throw new Error('Catatan ini baru saja berubah. Muat ulang daftar sebelum menghapusnya.')
    }
    const nextStatus = getNextItemProductionStatus(relatedItem, projectedLogs, { forceRecalculate: true })
    const result = await mutateProductionLogAtomically(supabase, {
      jobId: relatedItem.id,
      logId,
      operation: 'DELETE',
      logs: currentLogs,
      nextStatus
    })
    await notifyProductionStatusChange(supabase, relatedItem.id, relatedItem.sales_orders?.invoice_number, result?.old_status, result?.new_status)

    revalidatePath('/dashboard/production')
    revalidatePath('/dashboard/production/shipping')
    revalidatePath('/dashboard/sales')
    revalidatePath('/track')
    return { success: true }
  } catch (err) {
    console.error('Error deleting production log:', err)
    return { success: false, error: err.message || 'Gagal menghapus catatan produksi.' }
  }
}
