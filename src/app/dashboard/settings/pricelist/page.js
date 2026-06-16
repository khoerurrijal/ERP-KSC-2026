import { createClient } from '@/utils/supabase/server'
import PricelistClient from './PricelistClient'

export const metadata = {
  title: 'Pengaturan Pricelist | King Sablon',
}

export default async function PricelistSettingsPage() {
  const supabase = await createClient()

  // Ambil pengaturan
  const { data: configRow } = await supabase
    .from('system_settings')
    .select('value')
    .eq('key', 'pricelist_config')
    .single()

  // Ambil kategori unik dari products
  const { data: products } = await supabase.from('products').select('category')
  const uniqueCategories = [...new Set((products || []).map(p => p.category).filter(Boolean))]

  const defaultSablonFee = {}
  uniqueCategories.forEach(cat => {
    defaultSablonFee[cat] = { '500': 450, '1000': 350, '5000': 300, '10000': 250 }
  })

  const defaultConfig = {
    profitMargin: 15,
    sablonFee: defaultSablonFee
  }

  const initialConfig = configRow?.value || defaultConfig

  // Memastikan kategori baru di products juga muncul di sablonFee
  const mergedSablonFee = { ...initialConfig.sablonFee }
  uniqueCategories.forEach(cat => {
    if (!mergedSablonFee[cat]) {
      mergedSablonFee[cat] = { '500': 450, '1000': 350, '5000': 300, '10000': 250 }
    }
  })
  
  // Hapus kategori yang sudah tidak ada di products
  Object.keys(mergedSablonFee).forEach(cat => {
    if (!uniqueCategories.includes(cat)) {
      delete mergedSablonFee[cat]
    }
  })
  
  initialConfig.sablonFee = mergedSablonFee

  return <PricelistClient initialConfig={initialConfig} categories={uniqueCategories} />
}
