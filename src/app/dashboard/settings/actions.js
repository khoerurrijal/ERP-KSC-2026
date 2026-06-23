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
  const pricelist_config = data.find(d => d.key === 'pricelist_config')?.value || {
    profit_gudang_nominal: 50,
    profit_global_percent: 10,
    margin_jual_polos_percent: 15,
    save_profit_percent: 30,
    sablon_matrix: {
      "BOTOL": { "1": 0, "10": 0, "100": 1200, "500": 850, "1000": 500, "5000": 500, "10000": 500 },
      "BOX DUS": { "1": 0, "10": 0, "100": 1500, "500": 300, "1000": 200, "5000": 200, "10000": 200 },
      "CUP GOCUP": { "1": 0, "10": 0, "100": 0, "500": 260, "1000": 200, "5000": 170, "10000": 150 },
      "CUP INJECT": { "1": 0, "10": 0, "100": 0, "500": 400, "1000": 250, "5000": 220, "10000": 200 },
      "CUP PET": { "1": 0, "10": 0, "100": 0, "500": 400, "1000": 250, "5000": 220, "10000": 200 }
    }
  }
  const role_permissions = data.find(d => d.key === 'role_permissions')?.value || {
    "Owner": ["dashboard", "penjualan", "marketplace", "produksi", "gudang", "keuangan", "master_data", "laporan", "pengaturan", "user_management"],
    "Admin": ["dashboard", "penjualan", "marketplace", "produksi", "gudang", "master_data"],
    "Operator": ["dashboard", "produksi"]
  }
  const user_roles = data.find(d => d.key === 'user_roles')?.value || []
  
  // Inject sablon_matrix from the dedicated table
  const { data: matrixData } = await supabase.from('sablon_matrix').select('*')
  const sablon_matrix = {}
  if (matrixData) {
    matrixData.forEach(row => {
      if (!row.category) return
      sablon_matrix[row.category] = {
        "1": Number(row.min_1 || 0),
        "10": Number(row.min_10 || 0),
        "100": Number(row.min_100 || 0),
        "500": Number(row.min_500 || 0),
        "1000": Number(row.min_1000 || 0),
        "5000": Number(row.min_5000 || 0),
        "10000": Number(row.min_10000 || 0)
      }
    })
  }
  pricelist_config.sablon_matrix = sablon_matrix

  return { dropdown_config, cashflow_config, store_config, pricelist_config, role_permissions, user_roles }
}

export async function updateDropdownConfig(newConfig) {
  const supabase = await createClient()
  const { error } = await supabase.from('system_settings').upsert({
    key: 'dropdown_config',
    value: newConfig,
    updated_at: new Date().toISOString()
  })
  
  if (error) return { success: false, error: error.message }
  revalidatePath('/', 'layout')
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
  revalidatePath('/', 'layout')
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
  revalidatePath('/', 'layout')
  return { success: true }
}

export async function updateRolePermissions(newPermissions) {
  const supabase = await createClient()
  const { error } = await supabase.from('system_settings').upsert({
    key: 'role_permissions',
    value: newPermissions,
    updated_at: new Date().toISOString()
  })
  
  if (error) return { success: false, error: error.message }
  revalidatePath('/', 'layout')
  return { success: true }
}

export async function updateUserRoles(newRoles) {
  const supabase = await createClient()
  const { error } = await supabase.from('system_settings').upsert({
    key: 'user_roles',
    value: newRoles,
    updated_at: new Date().toISOString()
  })
  
  if (error) return { success: false, error: error.message }
  revalidatePath('/', 'layout')
  return { success: true }
}

export async function updatePricelistConfig(newConfig) {
  const supabase = await createClient()
  
  // Extract matrix and remove from JSON to avoid duplication
  const matrixObj = newConfig.sablon_matrix
  const configToSave = { ...newConfig }
  delete configToSave.sablon_matrix

  const { error } = await supabase.from('system_settings').upsert({
    key: 'pricelist_config',
    value: configToSave,
    updated_at: new Date().toISOString()
  })
  if (error) return { success: false, error: error.message }

  // Update sablon_matrix table
  if (matrixObj) {
    for (const [category, tiers] of Object.entries(matrixObj)) {
      const payload = {
        category,
        min_1: Number(tiers["1"] || 0),
        min_10: Number(tiers["10"] || 0),
        min_100: Number(tiers["100"] || 0),
        min_500: Number(tiers["500"] || 0),
        min_1000: Number(tiers["1000"] || 0),
        min_5000: Number(tiers["5000"] || 0),
        min_10000: Number(tiers["10000"] || 0),
        updated_at: new Date().toISOString()
      }
      
      const { data: existing } = await supabase.from('sablon_matrix').select('id').eq('category', category).single()
      if (existing) {
        await supabase.from('sablon_matrix').update(payload).eq('id', existing.id)
      } else {
        await supabase.from('sablon_matrix').insert(payload)
      }
    }
  }

  revalidatePath('/', 'layout')
  revalidatePath('/pricelist')
  revalidatePath('/order')
  return { success: true }
}
