import { createClient } from '@/utils/supabase/server'
import ReportClient from './ReportClient'

export const dynamic = 'force-dynamic'

export default async function ReportPage({ searchParams }) {
  const supabase = await createClient()

  const resolvedParams = await searchParams
  const selectedMonth = resolvedParams?.month || (() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })()



  // Fetch all transactions with a high limit to bypass the 1000 default
  const { data: transactions } = await supabase
    .from('transactions')
    .select('*')
    .limit(100000)
    .order('date', { ascending: false })

  const [year, month] = selectedMonth.split('-')
  const endOfMonth = new Date(year, month, 0).getDate() // Last day of that month
  const maxDate = `${selectedMonth}-${String(endOfMonth).padStart(2, '0')}`

  // Fetch sales items to compute Pemakaian Gudang & Global dynamically
  const { data: salesItems } = await supabase
    .from('sales_items')
    .select('order_type, hpp_price, total_price, qty, unit_multiplier, beli_gudang, beli_global, royalty_fee, products(category), sales_orders!inner(date, payment_status, status)')
    .gte('sales_orders.date', `${selectedMonth}-01`)
    .lte('sales_orders.date', maxDate)
    .neq('sales_orders.status', 'BATAL')

  const allTransactions = transactions || []
  const validTransactions = allTransactions.filter(t => t.date && t.date.startsWith(selectedMonth))

  // Determine the cutoff date to calculate history (up to the end of selected month)
  // Just compare dates lexicographically since they are YYYY-MM-DD
  const historyTransactions = allTransactions.filter(t => t.date && t.date <= maxDate)

  // Compute summary dynamically from ALL HISTORY up to selected month
  const summary = {
    king: {
      pendapatan: 0,
      pengeluaran_harian: 0,
      pengeluaran_tetap: 0,
      pemakaian_gudang: 0,
      pemakaian_global: 0,
      saldo_bersih: 0
    },
    gudang: { masuk: 0, keluar: 0, akhir: 0 },
    global: { masuk: 0, keluar: 0, akhir: 0 },
    tabungan: { masuk: 0, keluar: 0, akhir: 0 },
    total_buku_besar: 0
  }

  // Calculate accumulated balance from history for Gudang, Global, Tabungan
  historyTransactions.forEach(t => {
    const amountIn = Number(t.amount_in || 0)
    const amountOut = Number(t.amount_out || 0)
    
    if (t.workshop_code === 'GUDANG') {
      summary.gudang.akhir += (amountIn - amountOut)
    } else if (t.workshop_code === 'GLOBAL') {
      summary.global.akhir += (amountIn - amountOut)
    } else if (t.workshop_code === 'TABUNGAN' || ((t.description || '').toLowerCase().includes('tabungan'))) {
      summary.tabungan.akhir += (amountIn - amountOut)
    }
  })

  // King balance resets every month, so we ONLY calculate for the selected month
  validTransactions.forEach(t => {
    if (t.workshop_code === 'KING') {
      const amountIn = Number(t.amount_in || 0)
      const amountOut = Number(t.amount_out || 0)
      summary.king.saldo_bersih += (amountIn - amountOut)
    }
  })

  // Apply Automatic Settlement Logic (PRD 5.7)
  const monthsInHistory = new Set(historyTransactions.map(t => t.date?.substring(0, 7)).filter(Boolean))
  const numberOfMonthsPassed = monthsInHistory.size
  const SETTLEMENT_KING_OUT = 4100000
  const SETTLEMENT_TABUNGAN_IN = 2000000

  // For King, since it resets monthly, we ONLY subtract the 4.1M for the current month!
  summary.king.saldo_bersih -= SETTLEMENT_KING_OUT
  
  // For Tabungan, since it's cumulative, we add 2M per month of history
  summary.tabungan.akhir += (SETTLEMENT_TABUNGAN_IN * numberOfMonthsPassed)

  // Calculate physical method balances from ALL HISTORY
  const physicalBalances = { BCA: 0, Mandiri: 0, Cash: 0, Virtual: 0 }
  allTransactions.forEach(t => {
    const amountIn = Number(t.amount_in || 0)
    const amountOut = Number(t.amount_out || 0)
    const method = (t.payment_method || '').toUpperCase()
    
    if (method.includes('BCA')) physicalBalances.BCA += (amountIn - amountOut)
    else if (method.includes('MANDIRI')) physicalBalances.Mandiri += (amountIn - amountOut)
    else if (method.includes('CASH')) physicalBalances.Cash += (amountIn - amountOut)
    else physicalBalances.Virtual += (amountIn - amountOut)
  })

  // Initialize automatic settlement for the current month
  summary.king.pengeluaran_tetap = SETTLEMENT_KING_OUT
  summary.tabungan.masuk += SETTLEMENT_TABUNGAN_IN

  // Calculate analytics
  const analytics = {
    omset_polos: 0,
    omset_sablon: 0,
    omset_plastik: 0,
    omset_sealer: 0,
    omset_lainnya: 0,
    
    hpp_gudang: 0,
    hpp_global: 0,
    margin_gudang: 0,
    margin_global: 0,
    royalty_mesin: 0,
    
    total_omset: 0,
    piutang_omset: 0
  };

  if (salesItems) {
    salesItems.forEach(item => {
      // Hanya menghitung HPP ke saldo buku jika Lunas
      if (item.sales_orders.payment_status === 'LUNAS') {
        summary.king.pemakaian_gudang += Number(item.beli_gudang || 0)
        summary.king.pemakaian_global += Number(item.beli_global || 0)
      }

      // Hitung analitik omset tanpa memandang lunas/belum lunas, asalkan tidak batal
      const cat = (item.products?.category || '').toLowerCase()
      const isPlastik = cat.includes('plastik')
      const isSealer = cat.includes('sealer')
      const type = (item.order_type || '').toLowerCase()

      const totalHarga = Number(item.total_price || 0)
      
      if (isPlastik && type === 'sablon') analytics.omset_plastik += totalHarga
      else if (isSealer) analytics.omset_sealer += totalHarga
      else if (type === 'sablon' || type === 'printing') analytics.omset_sablon += totalHarga
      else if (type === 'polos' || !type) analytics.omset_polos += totalHarga
      else analytics.omset_lainnya += totalHarga

      analytics.total_omset += totalHarga
      if (item.sales_orders.payment_status !== 'LUNAS') {
        analytics.piutang_omset += totalHarga
      }

      const totalHppAsli = Number(item.hpp_price || 0) * Number(item.qty || 0) * Number(item.unit_multiplier || 1)
      const beliGudang = Number(item.beli_gudang || 0)
      const beliGlobal = Number(item.beli_global || 0)

      if (beliGudang > 0) {
        analytics.hpp_gudang += totalHppAsli
        analytics.margin_gudang += (beliGudang - totalHppAsli)
      } else if (beliGlobal > 0) {
        analytics.hpp_global += totalHppAsli
        analytics.margin_global += (beliGlobal - totalHppAsli)
      }
      
      analytics.royalty_mesin += Number(item.royalty_fee || 0)
    })
  }

  // Calculate current month's purely masuk/keluar for table display context
  validTransactions.forEach(t => {
    const amountIn = Number(t.amount_in || 0)
    const amountOut = Number(t.amount_out || 0)
    
    if (t.workshop_code === 'GUDANG') {
      summary.gudang.masuk += amountIn
      summary.gudang.keluar += amountOut
    } else if (t.workshop_code === 'GLOBAL') {
      summary.global.masuk += amountIn
      summary.global.keluar += amountOut
    } else if (t.workshop_code === 'TABUNGAN' || ((t.description || '').toLowerCase().includes('tabungan'))) {
      summary.tabungan.masuk += amountIn
      summary.tabungan.keluar += amountOut
    } else if (t.workshop_code === 'KING') {
      summary.king.pendapatan += amountIn
      summary.king.pengeluaran_harian += amountOut
    }
  })

  // Pengeluaran Harian di Excel dihitung dari Total Pengeluaran Harian - Balancing Transaksi Lainnya
  // Agar pas dengan transaksi murni yang real, kita tetap pakai sum mutasi keluar.
  // Tapi untuk konsistensi, HPP Gudang dan Global BUKAN bagian dari Pengeluaran Harian.

  summary.total_buku_besar = summary.gudang.akhir + summary.global.akhir + summary.tabungan.akhir + summary.king.saldo_bersih
  summary.physicalBalances = physicalBalances

  const { data: dropdownSettings } = await supabase.from('system_settings').select('*').eq('key', 'dropdown_config').single()
  const dropdownConfig = dropdownSettings?.value || {}

  return <ReportClient transactions={validTransactions} summary={summary} analytics={analytics} dropdownConfig={dropdownConfig} />
}
