import { createClient } from '@/utils/supabase/server'
import PurchasesClient from './PurchasesClient'

export default async function PurchasesPage({ searchParams }) {
  const supabase = await createClient()
  const resolvedParams = await searchParams
  
  const selectedMonth = resolvedParams?.month || (() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })()

  // Ambil semua PO (Max Rows harus diubah di Supabase jika > 1000)
  const { data: purchaseOrders } = await supabase
    .from('purchase_orders')
    .select(`
      *,
      purchase_items(total_price)
    `)
    .limit(100000)
    .order('date', { ascending: false })

  const allPOs = purchaseOrders || []

  // Hitung Laporan Ringkasan
  const summary = {
    beliGudang: 0,
    beliGlobal: 0,
    lunas: 0,
    tempo: 0
  }

  // Tempo (Seluruh Waktu)
  summary.tempo = allPOs
    .filter(o => o.status !== 'LUNAS' && o.payment_status !== 'LUNAS')
    .reduce((sum, o) => sum + Number(o.total_amount || 0), 0)

  // Filter khusus bulan ini untuk Lunas & Pembelian
  const thisMonthPOs = allPOs.filter(o => o.date && o.date.startsWith(selectedMonth))
  
  thisMonthPOs.forEach(o => {
    const amount = Number(o.total_amount || 0)
    
    // Total Pembelian Bulan Ini berdasarkan Workshop
    if (o.workshop_code === 'GUDANG') {
      summary.beliGudang += amount
    } else if (o.workshop_code === 'GLOBAL' || !o.workshop_code) { // Default global jika kosong
      summary.beliGlobal += amount
    }

    // Lunas Bulan Ini
    if (o.status === 'LUNAS' || o.payment_status === 'LUNAS') {
      summary.lunas += amount
    }
  })

  return <PurchasesClient purchaseOrders={allPOs} summary={summary} selectedMonth={selectedMonth} />
}
