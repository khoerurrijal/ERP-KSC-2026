import { createClient } from '@/utils/supabase/server'
import PayrollClient from './PayrollClient'

export const metadata = {
  title: 'Rekap Gaji | King Sablon',
}

export default async function PayrollPage() {
  const supabase = await createClient()

  // Ambil data karyawan aktif beserta skema dan atasannya
  const { data: employees, error } = await supabase
    .from('employees')
    .select(`
      id, 
      full_name, 
      gaji_harian, 
      uang_makan, 
      supervisor_id,
      salary_schemas (
        role_name, 
        bonus_mingguan, 
        rate_borongan_sendiri, 
        rate_produksi_bawahan, 
        batas_qty_bonus_harian, 
        bonus_harian_dibawah_target, 
        batas_qty_target_harian, 
        bonus_target_harian, 
        fee_2_warna
      )
    `)
    .eq('is_active', true)

  const { data: settings } = await supabase.from('system_settings').select('*').eq('key', 'dropdown_config').single()
  const dropdownConfig = settings?.value || {}

  return <PayrollClient employees={employees || []} dropdownConfig={dropdownConfig} />
}
