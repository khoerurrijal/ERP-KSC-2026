import { createClient } from '@/utils/supabase/server'
import PricelistClient from './PricelistClient'

export const metadata = {
  title: 'Pengaturan Pricelist | King Sablon',
}

export default async function PricelistSettingsPage() {
  const supabase = await createClient()

  // Ambil pengaturan profit margin
  const { data: configRow } = await supabase
    .from('system_settings')
    .select('value')
    .eq('key', 'pricelist_config')
    .single()

  // Ambil sablon matrix
  const { data: matrixData } = await supabase
    .from('sablon_matrix')
    .select('*')
    .order('category', { ascending: true })

  // Ambil kategori unik dari products
  const { data: products } = await supabase.from('products').select('category')
  const uniqueCategories = [...new Set((products || []).map(p => p.category).filter(Boolean))]

  const defaultRow = { min_1: 0, min_10: 0, min_100: 0, min_500: 0, min_1000: 0, min_5000: 0, min_10000: 0, status: 'AKTIF' }
  const matrix = {}
  
  // Populate dari database
  if (matrixData) {
    matrixData.forEach(row => {
      matrix[row.category] = row
    })
  }

  // Tambahkan kategori yang belum ada
  uniqueCategories.forEach(cat => {
    if (!matrix[cat]) {
      matrix[cat] = { category: cat, ...defaultRow }
    }
  })

  // Hapus kategori yang sudah tidak ada di products
  Object.keys(matrix).forEach(cat => {
    if (!uniqueCategories.includes(cat)) {
      delete matrix[cat]
    }
  })

  const initialConfig = {
    profitMargin: configRow?.value?.profitMargin || 15,
    matrix: matrix
  }

  return <PricelistClient initialConfig={initialConfig} categories={uniqueCategories} />
}
