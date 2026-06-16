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
    
    const { data: jobInfo } = await supabase.from('sales_items').select('qty').eq('id', payload.job_id).single()
    
    let isFinished = false
    if (jobInfo && totalProcessed >= jobInfo.qty) {
      await supabase.from('sales_items').update({ status: 'SUDAH JADI' }).eq('id', payload.job_id)
      isFinished = true
    }

    revalidatePath('/dashboard/production')
    return { success: true, isFinished }
} catch (err) {
    console.error('Error saving production log:', err)
    return { success: false, error: err.message }
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

    revalidatePath('/dashboard/production')
    return { success: true }
  } catch (err) {
    console.error('Error updating status:', err)
    return { success: false, error: err.message }
  }
}
