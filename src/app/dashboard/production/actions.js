'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

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
  const { data: item } = await supabase.from('sales_items').select('*, sales_orders(payment_status, status)').eq('id', itemId).single()
  if (!item) return;

  const so = item.sales_orders;
  if (!so) return;

  const isLunas = so.payment_status === 'LUNAS';
  const isPaid = so.payment_status === 'LUNAS' || so.payment_status === 'DP';

  // Hitung qty processed
  const { data: logs } = await supabase.from('production_logs').select('qty_processed').eq('job_id', itemId)
  const qtyProcessed = (logs || []).reduce((sum, log) => sum + (log.qty_processed || 0), 0)
  
  // Fetch dynamic statuses from config
  const { data: settingsData } = await supabase.from('system_settings').select('value').eq('key', 'dropdown_config').single()
  const dropdownConfig = settingsData?.value || {}
  const statuses = dropdownConfig.production_status || ['DRAFT', 'BARU MASUK', 'SIAP PROSES', 'PROSES', 'SUDAH JADI', 'SIAP KIRIM', 'DIKIRIM', 'SUDAH DIAMBIL', 'SELESAI']
  
  const ST_BARU_MASUK = statuses[1] || 'BARU MASUK'
  const ST_SIAP_PROSES = statuses[2] || 'SIAP PROSES'
  const ST_PROSES = statuses[3] || 'PROSES'
  const ST_SUDAH_JADI = statuses[4] || 'SUDAH JADI'
  const ST_SIAP_KIRIM = statuses[5] || 'SIAP KIRIM'
  const ST_DIKIRIM = statuses[6] || 'DIKIRIM'
  const ST_SUDAH_DIAMBIL = statuses[7] || 'SUDAH DIAMBIL'
  const ST_SELESAI = statuses[8] || 'SELESAI'

  let newStatus = item.status || ST_BARU_MASUK;
  const oldStatus = newStatus;

  // Hitung target sebenarnya (memperhitungkan unit_multiplier misal jika beli per dus)
  const targetQty = item.qty * (item.unit_multiplier || 1);

  if (item.order_type?.toUpperCase() === 'POLOS') {
    // RULE UNTUK POLOS: Langsung siap kirim jika sudah DP/Lunas
    if (!isPaid) {
      newStatus = ST_BARU_MASUK;
    } else {
      if (newStatus !== ST_DIKIRIM && newStatus !== ST_SUDAH_DIAMBIL && newStatus !== ST_SELESAI) {
        newStatus = ST_SIAP_KIRIM;
      }
    }
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
        if (!isPaid) {
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
  }
}

export async function updateSalesOrderStatus(itemId, status) {
  const supabase = await createClient()

  try {
    const { error } = await supabase
      .from('sales_items')
      .update({ status: status })
      .eq('id', itemId)
    
    if (error) throw error

    // Re-evaluasi menggunakan auto status handler agar jika diubah ke Dikirim + Lunas otomatis Selesai
    await handleAutoStatusUpdate(itemId);

    revalidatePath('/dashboard/production')
    return { success: true }
  } catch (err) {
    console.error('Error updating status:', err)
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
