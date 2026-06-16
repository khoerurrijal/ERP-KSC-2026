'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

export async function saveSalarySchema(payload) {
  const supabase = await createClient()

  try {
    if (payload.id) {
      const { error } = await supabase
        .from('salary_schemas')
        .update({
          role_name: payload.role_name,
          bonus_mingguan: payload.bonus_mingguan || 0,
          rate_borongan_sendiri: payload.rate_borongan_sendiri || 0,
          rate_produksi_bawahan: payload.rate_produksi_bawahan || 0,
          batas_qty_bonus_harian: payload.batas_qty_bonus_harian || 0,
          bonus_harian_dibawah_target: payload.bonus_harian_dibawah_target || 0,
          batas_qty_target_harian: payload.batas_qty_target_harian || 0,
          bonus_target_harian: payload.bonus_target_harian || 0,
          fee_2_warna: payload.fee_2_warna || 0
        })
        .eq('id', payload.id)
      
      if (error) throw error
    } else {
      const { error } = await supabase
        .from('salary_schemas')
        .insert([{
          role_name: payload.role_name,
          bonus_mingguan: payload.bonus_mingguan || 0,
          rate_borongan_sendiri: payload.rate_borongan_sendiri || 0,
          rate_produksi_bawahan: payload.rate_produksi_bawahan || 0,
          batas_qty_bonus_harian: payload.batas_qty_bonus_harian || 0,
          bonus_harian_dibawah_target: payload.bonus_harian_dibawah_target || 0,
          batas_qty_target_harian: payload.batas_qty_target_harian || 0,
          bonus_target_harian: payload.bonus_target_harian || 0,
          fee_2_warna: payload.fee_2_warna || 0
        }])
      
      if (error) throw error
    }

    revalidatePath('/dashboard/system/salary-schemas')
    return { success: true }
  } catch (err) {
    console.error('Error saving salary schema:', err)
    return { success: false, error: err.message }
  }
}

export async function deleteSalarySchema(id) {
  const supabase = await createClient()

  try {
    const { error } = await supabase.from('salary_schemas').delete().eq('id', id)
    if (error) throw error
    
    revalidatePath('/dashboard/system/salary-schemas')
    return { success: true }
  } catch (err) {
    return { success: false, error: err.message }
  }
}
