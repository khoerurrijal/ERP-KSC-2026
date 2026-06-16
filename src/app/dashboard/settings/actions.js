'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

export async function getSettings() {
  const supabase = await createClient()
  const { data, error } = await supabase.from('system_settings').select('*')
  
  if (error) {
    console.error('Error fetching settings:', error)
    return { dropdown_config: {}, cashflow_config: {} }
  }

  const dropdown_config = data.find(d => d.key === 'dropdown_config')?.value || {}
  const cashflow_config = data.find(d => d.key === 'cashflow_config')?.value || {}
  const store_config = data.find(d => d.key === 'store_config')?.value || {}
  
  return { dropdown_config, cashflow_config, store_config }
}

export async function updateDropdownConfig(newConfig) {
  const supabase = await createClient()
  const { error } = await supabase.from('system_settings').upsert({
    key: 'dropdown_config',
    value: newConfig,
    updated_at: new Date().toISOString()
  })
  
  if (error) return { success: false, error: error.message }
  revalidatePath('/dashboard')
  return { success: true }
}

export async function updateCashflowConfig(newConfig) {
  const supabase = await createClient()
  const { error } = await supabase.from('system_settings').upsert({
    key: 'cashflow_config',
    value: newConfig,
    updated_at: new Date().toISOString()
  })
  
  if (error) return { success: false, error: error.message }
  revalidatePath('/dashboard')
  return { success: true }
}

export async function updateStoreConfig(newConfig) {
  const supabase = await createClient()
  const { error } = await supabase.from('system_settings').upsert({
    key: 'store_config',
    value: newConfig,
    updated_at: new Date().toISOString()
  })
  
  if (error) return { success: false, error: error.message }
  revalidatePath('/dashboard')
  return { success: true }
}
