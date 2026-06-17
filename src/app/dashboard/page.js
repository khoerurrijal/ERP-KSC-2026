import { createClient } from '@/utils/supabase/server'
import { Clock, CheckCircle, AlertTriangle, Activity, ShoppingBag, Package, Wallet, Building2, AlertOctagon, FileText } from 'lucide-react'
import Link from 'next/link'
import PriceCalculator from '@/components/PriceCalculator'
import StockSearchWidget from '@/components/StockSearchWidget'
import MonthFilter from '@/components/MonthFilter'

export const dynamic = 'force-dynamic'

export default async function DashboardPage({ searchParams }) {
  const resolvedParams = await searchParams
  const selectedMonth = resolvedParams?.month || (() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })()

  const supabase = await createClient()

  // For testing dummy UI, we bypass the redirect if error, just mock a user
  const user = { email: 'admin@kingsablon.com', role: 'Owner' }

  // Fetch products for Kalkulator
  const { data: products } = await supabase.from('products').select('*').limit(100000).order('name')
  const { data: settings } = await supabase.from('system_settings').select('*')
  const dropdownConfig = settings?.find(s => s.key === 'dropdown_config')?.value || {}
  const jasaSablonStr = settings?.find(s => s.key === 'jasa_sablon_price')?.value || "250"
  const jasaSablon = parseFloat(jasaSablonStr)

  const { data: matrixData } = await supabase.from('sablon_matrix').select('*')
  const matrix = {}
  if (matrixData) {
    matrixData.forEach(row => {
      matrix[row.category] = row
    })
  }

  // Fetch orders for metrics
  const { data: salesOrders } = await supabase.from('sales_orders').select('*, customers(name), sales_items(qty, unit_price, order_type)').limit(100000)
  const { data: marketplaceOrders } = await supabase.from('sales_orders').select('*, customers!inner(type)').limit(100000).in('customers.type', ['Marketplace', 'Shopee', 'Tokopedia', 'TikTok'])

  const rawOrders = salesOrders || []
  
  // LOGIC FILTER
  // Omset: HANYA transaksi yang terjadi di bulan terpilih.
  const thisMonthOrders = rawOrders.filter(o => o.date && o.date.startsWith(selectedMonth))
  
  // SO Lunas: Selesai bulan ini
  const soLunas = thisMonthOrders.filter(o => o.payment_status === 'LUNAS').length
  
  // SO Belum Lunas & Marketplace Tempo: Hutang berjalan (TIDAK DIFILTER BULAN)
  const soBelumLunas = rawOrders.filter(o => o.payment_status !== 'LUNAS').length

  const mpTempo = (marketplaceOrders || []).filter(o => o.payment_status !== 'LUNAS').length
  
  // Calculate Jumlah Produksi Type Sablon (hanya bulan terpilih)
  const totalSablonQty = thisMonthOrders.reduce((acc, order) => {
    const sablonQty = order.sales_items?.filter(item => item.order_type === 'SABLON').reduce((sum, item) => sum + item.qty, 0) || 0
    return acc + sablonQty
  }, 0)

  // Calculate Antrean Produksi (berdasarkan Item Sablon)
  const { data: sablonItems } = await supabase.from('sales_items').select('status').eq('order_type', 'SABLON').limit(100000)
  const items = sablonItems || []
  const antreanMasuk = items.filter(i => !i.status || i.status === 'BARU MASUK').length
  const antreanProses = items.filter(i => i.status === 'PROSES').length
  const antreanSiapAmbil = items.filter(i => ['SUDAH JADI', 'DIKIRIM', 'SUDAH DIAMBIL'].includes(i.status)).length

  return (
    <div className="space-y-6 animate-in fade-in zoom-in-95 duration-500 pb-20">
      
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Activity className="w-6 h-6 text-primary" />
            Dashboard Utama
          </h1>
          <p className="text-sm text-foreground/60 mt-1">Selamat datang kembali, {user.email}</p>
        </div>
        <div className="flex items-center gap-4">
          <MonthFilter />
          <form action="/auth/signout" method="post">
            <button type="submit" className="btn-secondary h-10 px-4 text-sm">Sign Out</button>
          </form>
        </div>
      </header>

      {/* STATISTIK PENJUALAN */}
      <h2 className="text-lg font-bold text-foreground mt-8">Statistik Pesanan (Sales Order)</h2>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="glass-card p-4 border-l-4 border-green-500">
          <p className="text-xs text-foreground/60 uppercase tracking-wider font-semibold">SO Lunas</p>
          <p className="text-2xl font-bold text-green-400 mt-2">{soLunas} <span className="text-xs font-normal text-foreground/50">Total</span></p>
        </div>
        <div className="glass-card p-4 border-l-4 border-yellow-500">
          <p className="text-xs text-foreground/60 uppercase tracking-wider font-semibold">SO Belum Lunas (DP)</p>
          <p className="text-2xl font-bold text-yellow-400 mt-2">{soBelumLunas} <span className="text-xs font-normal text-foreground/50">Tagihan Aktif</span></p>
        </div>
        <div className="glass-card p-4 border-l-4 border-blue-500">
          <p className="text-xs text-foreground/60 uppercase tracking-wider font-semibold">Marketplace (Tempo)</p>
          <p className="text-2xl font-bold text-blue-400 mt-2">{mpTempo} <span className="text-xs font-normal text-foreground/50">Pencairan</span></p>
        </div>
        <div className="glass-card p-4 border-l-4 border-primary bg-primary/5">
          <p className="text-xs text-primary uppercase tracking-wider font-bold">Total Produksi Sablon</p>
          <p className="text-2xl font-bold text-foreground mt-2">{totalSablonQty.toLocaleString('id-ID')} <span className="text-xs font-normal text-foreground/50">Pcs</span></p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
        
        {/* KALKULATOR HARGA */}
        <div className="lg:col-span-1">
          <PriceCalculator products={products || []} dropdownConfig={dropdownConfig} jasaSablon={jasaSablon} matrix={matrix} />
        </div>

        {/* TENGAH: Antrean & Stok */}
        <div className="flex flex-col gap-6 lg:col-span-1">
          {/* TRACKING PRODUKSI */}
          <div className="glass-card flex flex-col h-fit">
            <div className="p-4 border-b border-white/10 bg-white/5 flex justify-between items-center">
              <h2 className="font-bold text-foreground flex items-center gap-2">
                <Package className="w-5 h-5 text-purple-400" /> Antrean Produksi
              </h2>
              <Link href="/dashboard/production" className="text-xs text-primary hover:underline">Lihat Semua</Link>
            </div>
            <div className="p-4 flex-1 flex flex-col justify-center gap-3">
              <div className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/10">
                <div className="flex items-center gap-3">
                  <Clock className="w-5 h-5 text-blue-400" />
                  <span className="font-medium text-foreground/80 text-sm">Baru Masuk (DRAFT)</span>
                </div>
                <span className="text-lg font-bold text-blue-400">{antreanMasuk}</span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/10">
                <div className="flex items-center gap-3">
                  <Activity className="w-5 h-5 text-yellow-400" />
                  <span className="font-medium text-foreground/80 text-sm">Sedang Proses (BERJALAN)</span>
                </div>
                <span className="text-lg font-bold text-yellow-400">{antreanProses}</span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/10">
                <div className="flex items-center gap-3">
                  <CheckCircle className="w-5 h-5 text-green-400" />
                  <span className="font-medium text-foreground/80 text-sm">Siap Ambil (SELESAI)</span>
                </div>
                <span className="text-lg font-bold text-green-400">{antreanSiapAmbil}</span>
              </div>
            </div>
          </div>

          <StockSearchWidget products={products || []} />
        </div>

        {/* PIUTANG SO (Belum Lunas) */}
        <div className="glass-card flex flex-col lg:col-span-1 border-t-4 border-yellow-500 h-fit">
          <div className="p-4 border-b border-white/10 bg-white/5 flex justify-between items-center">
            <h2 className="font-bold text-foreground flex items-center gap-2">
              <FileText className="w-5 h-5 text-yellow-400" /> Pesanan Belum Lunas
            </h2>
            <Link href="/dashboard/sales" className="text-xs text-primary hover:underline">Lihat SO</Link>
          </div>
          <div className="p-4 flex-1 overflow-y-auto max-h-[450px] space-y-3">
             {(() => {
               const unpaidOrders = rawOrders.filter(o => o.payment_status !== 'LUNAS')
               if (unpaidOrders.length === 0) {
                 return <div className="text-center text-foreground/40 py-8">Belum ada piutang/pesanan aktif.</div>
               }

               const groupedUnpaid = unpaidOrders.reduce((acc, so) => {
                 const month = so.date ? so.date.substring(0, 7) : 'Unknown'
                 if (!acc[month]) acc[month] = { totalRp: 0, orders: [] }
                 
                 const total = Number(so.total_amount) || 0
                 const sisa = total - (Number(so.dp_amount) || 0)
                 
                 acc[month].totalRp += sisa
                 acc[month].orders.push({ ...so, sisaTagihan: sisa })
                 return acc
               }, {})

               const sortedMonths = Object.keys(groupedUnpaid).sort().reverse()
               
               const formatMonth = (yyyyMM) => {
                 if (yyyyMM === 'Unknown') return 'Bulan Tidak Diketahui'
                 const d = new Date(yyyyMM + '-01')
                 return d.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })
               }

               return sortedMonths.map(month => (
                  <details key={month} className="group bg-white/5 border border-white/10 rounded-lg overflow-hidden" open>
                     <summary className="p-3 cursor-pointer flex justify-between items-center hover:bg-white/5 transition-colors">
                        <div className="font-bold text-foreground uppercase text-xs tracking-wider">{formatMonth(month)}</div>
                        <div className="font-bold text-yellow-400">Rp {groupedUnpaid[month].totalRp.toLocaleString('id-ID')}</div>
                     </summary>
                     <div className="p-3 border-t border-white/10 bg-black/20 space-y-2">
                        {groupedUnpaid[month].orders.map(so => (
                          <div key={so.id} className="flex justify-between items-center text-sm border-b border-white/5 pb-2 last:border-0 last:pb-0 hover:bg-white/5 p-1 rounded transition-colors">
                             <div>
                               <p className="font-bold text-foreground/90">{so.customers?.name || 'Unknown'}</p>
                               <p className="text-[10px] text-foreground/50">{so.invoice_number}</p>
                             </div>
                             <p className="font-semibold text-yellow-400">Rp {so.sisaTagihan.toLocaleString('id-ID')}</p>
                          </div>
                        ))}
                     </div>
                  </details>
               ))
             })()}
          </div>
          <div className="p-4 border-t border-white/10 bg-yellow-500/10 flex justify-between items-center sticky bottom-0">
            <span className="text-sm font-medium text-yellow-400">Total Keseluruhan:</span>
            <span className="text-lg font-bold text-yellow-500">
              Rp {rawOrders.filter(o => o.payment_status !== 'LUNAS').reduce((acc, so) => {
                const total = Number(so.total_amount) || 0
                return acc + (total - (Number(so.dp_amount) || 0))
              }, 0).toLocaleString('id-ID')}
            </span>
          </div>
        </div>

      </div>

    </div>
  )
}
