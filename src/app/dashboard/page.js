import { createClient } from '@/utils/supabase/server'
import { Suspense } from 'react'
import { Clock, CheckCircle, AlertTriangle, Activity, ShoppingBag, Package, Wallet, Building2, AlertOctagon, FileText, ShieldCheck } from 'lucide-react'
import Link from 'next/link'
import PriceCalculator from '@/components/PriceCalculator'
import StockSearchWidget from '@/components/StockSearchWidget'
import MonthFilter from '@/components/MonthFilter'
import { redirect } from 'next/navigation'
import { runAuditScan } from '@/app/dashboard/audit/audit'

export const dynamic = 'force-dynamic'

async function DashboardAuditSummary({ auditReportPromise }) {
  const auditReport = await auditReportPromise

  return (
    <div className="glass-card p-4 border border-primary/20 bg-primary/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-primary/15 flex items-center justify-center text-primary">
          <ShieldCheck className="w-5 h-5" />
        </div>
        <div>
          <p className="font-bold text-foreground">AI Audit Center</p>
          <p className="text-xs text-foreground/60 mt-1">{auditReport.summary.total === 0 ? 'Belum ada temuan audit.' : `${auditReport.summary.total} temuan perlu diperiksa (${auditReport.summary.critical} kritis).`}</p>
        </div>
      </div>
      <Link href="/audit" className="btn-primary h-9 px-4 text-sm flex items-center justify-center gap-2 whitespace-nowrap">
        Periksa Sistem
      </Link>
    </div>
  )
}

export default async function DashboardPage({ searchParams }) {
  const resolvedParams = await searchParams
  const selectedMonth = resolvedParams?.month || (() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })()

  const supabase = await createClient()

  // Fetch real user
  const { data: { user: authUser }, error } = await supabase.auth.getUser()
  if (error || !authUser) {
    redirect('/login')
  }

  const { data: settings } = await supabase.from('system_settings').select('*')
  const userRoles = settings?.find(setting => setting.key === 'user_roles')?.value || []
  const userEmail = authUser.email?.toLowerCase() || ''
  
  const matchedUser = userRoles.find(u => {
    const inputEmail = (u.email || '').trim().toLowerCase()
    return inputEmail === userEmail || `${inputEmail}@kingsablon.com` === userEmail
  })
  const userRole = matchedUser ? matchedUser.role : 'Operator'

  // Operator roles go straight to their work queue instead of loading dashboard analytics.
  if (['Operator', 'Operator Mesin'].includes(userRole)) {
    redirect('/production')
  }

  const user = { email: authUser.email, role: userRole }

  // Load independent dashboard data together to avoid serial Supabase round trips.
  const auditReportPromise = runAuditScan(supabase)
  const [
    { data: products },
    { data: salesOrders },
    { data: sablonItems }
  ] = await Promise.all([
    supabase.from('products').select('*, product_units(id, unit_name, multiplier)').eq('is_active', true).limit(100000).order('name'),
    supabase.from('sales_orders').select('id, date, payment_status, marketplace_settlement_status, marketplace_receipt, total_amount, dp_amount, customers(name, type)').limit(100000),
    supabase.from('sales_items').select('status, qty, sales_orders(date, payment_status)').eq('order_type', 'SABLON').limit(100000)
  ])

  const dropdownConfig = settings?.find(s => s.key === 'dropdown_config')?.value || {}
  const pricelistConfig = settings?.find(s => s.key === 'pricelist_config')?.value || {}

  const rawOrders = salesOrders || []
  const getOpenBalance = order => (Number(order.total_amount) || 0) - (Number(order.dp_amount) || 0)
  const isOutstandingOrder = order => {
    const paymentStatus = String(order.payment_status || '').trim().toUpperCase()
    const settlementStatus = String(order.marketplace_settlement_status || 'PENDING').trim().toUpperCase()
    const hasMarketplaceReceipt = Boolean(String(order.marketplace_receipt || '').trim())
    return ['BELUM LUNAS', 'DP'].includes(paymentStatus)
      && !hasMarketplaceReceipt
      && settlementStatus !== 'SETTLED_EXTERNAL'
      && getOpenBalance(order) > 0
  }
  const unpaidOrders = rawOrders.filter(isOutstandingOrder)
  
  // LOGIC FILTER
  // Omset: HANYA transaksi yang terjadi di bulan terpilih.
  const thisMonthOrders = rawOrders.filter(o => o.date && o.date.startsWith(selectedMonth))
  
  // SO Lunas: Selesai bulan ini
  const soLunas = thisMonthOrders.filter(o => o.payment_status === 'LUNAS').length
  
  // Tagihan aktif mencakup DP/tempo, tetapi mengecualikan batal dan settlement di luar ERP.
  const soBelumLunas = unpaidOrders.length

  const mpTempo = rawOrders.filter(order => {
    const customer = Array.isArray(order.customers) ? order.customers[0] : order.customers
    const marketplaceIdentity = `${String(customer?.name || '')} ${String(customer?.type || '')}`.toUpperCase()
    const isMarketplace = marketplaceIdentity.includes('MARKETPLACE')
      || ['SHOPEE', 'TOKOPEDIA', 'TIKTOK'].some(platform => marketplaceIdentity.includes(platform))
    const paymentStatus = String(order.payment_status || '').toUpperCase()
    const settlementStatus = String(order.marketplace_settlement_status || 'PENDING').toUpperCase()

    return isMarketplace
      && paymentStatus !== 'LUNAS'
      && paymentStatus !== 'BATAL'
      && settlementStatus !== 'SETTLED_EXTERNAL'
  }).length
  
  // Calculate Jumlah Produksi Type Sablon (hanya bulan terpilih, ABAIKAN BATAL)
  const totalSablonQty = (sablonItems || []).reduce((total, item) => {
    const order = Array.isArray(item.sales_orders) ? item.sales_orders[0] : item.sales_orders
    return order?.date?.startsWith(selectedMonth)
      && order.payment_status !== 'BATAL'
      && item.status !== 'BATAL'
      ? total + item.qty
      : total
  }, 0)

  // Calculate Antrean Produksi (berdasarkan Item Sablon)
  const items = sablonItems || []
  const getProductionStatus = item => String(item.status || 'BARU MASUK').trim().toUpperCase()
  const antreanMasuk = items.filter(i => !i.status || getProductionStatus(i) === 'BARU MASUK').length
  const antreanSiapProses = items.filter(i => getProductionStatus(i) === 'SIAP PROSES').length
  const antreanProses = items.filter(i => ['PROSES', 'PROSES WARNA 1', 'PROSES WARNA 2'].includes(getProductionStatus(i))).length
  const antreanSiapAmbil = items.filter(i => ['SIAP KIRIM', 'SUDAH JADI'].includes(getProductionStatus(i))).length

  return (
    <div className="space-y-4 animate-in fade-in zoom-in-95 duration-500 pb-12">
      
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg font-bold text-foreground">Statistik Pesanan (Sales Order)</h2>
        <div className="flex items-center justify-end gap-3">
          <MonthFilter />
          <form action="/auth/signout" method="post">
            <button type="submit" className="btn-secondary h-10 px-4 text-sm">Sign Out</button>
          </form>
        </div>
      </div>

      {/* STATISTIK PENJUALAN */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="glass-card p-4 border-l-4 border-green-500">
          <p className="text-xs text-foreground/60 uppercase tracking-wider font-semibold">SO Lunas</p>
          <p className="metric-value mt-2 text-green-400">{soLunas} <span className="text-xs font-normal text-foreground/50">Total</span></p>
        </div>
        <div className="glass-card p-4 border-l-4 border-yellow-500">
          <p className="text-xs text-foreground/60 uppercase tracking-wider font-semibold">SO Belum Lunas (DP)</p>
          <p className="metric-value mt-2 text-yellow-400">{soBelumLunas} <span className="text-xs font-normal text-foreground/50">Tagihan Aktif</span></p>
        </div>
        <div className="glass-card p-4 border-l-4 border-blue-500">
          <p className="text-xs text-foreground/60 uppercase tracking-wider font-semibold">Marketplace (Tempo)</p>
          <p className="metric-value mt-2 text-blue-400">{mpTempo} <span className="text-xs font-normal text-foreground/50">Pencairan</span></p>
        </div>
        <div className="glass-card p-4 border-l-4 border-primary bg-primary/5">
          <p className="text-xs text-primary uppercase tracking-wider font-bold">Total Produksi Sablon</p>
          <p className="metric-value mt-2 text-foreground">{totalSablonQty.toLocaleString('id-ID', { maximumFractionDigits: 0 })} <span className="text-xs font-normal text-foreground/50">Pcs</span></p>
        </div>
      </div>

      <Suspense fallback={<div className="glass-card p-4 border border-primary/20 bg-primary/5 text-sm text-foreground/60" role="status">Memuat ringkasan audit...</div>}>
        <DashboardAuditSummary auditReportPromise={auditReportPromise} />
      </Suspense>

      <div className="grid grid-cols-1 lg:grid-cols-3 items-start gap-4 mt-4">
        
        {/* KALKULATOR HARGA */}
        <div className="lg:col-span-1">
          <PriceCalculator products={products || []} dropdownConfig={dropdownConfig} pricelistConfig={pricelistConfig} />
        </div>

        {/* TENGAH: Antrean & Stok */}
        <div className="flex flex-col gap-4 lg:col-span-1">
          {/* TRACKING PRODUKSI */}
          <div className="glass-card flex flex-col h-fit">
            <div className="p-4 border-b border-white/10 bg-white/5 flex justify-between items-center">
              <h2 className="font-bold text-foreground flex items-center gap-2">
                <Package className="w-5 h-5 text-purple-400" /> Antrean Produksi
              </h2>
              <Link href="/production" className="text-xs text-primary hover:underline">Lihat Semua</Link>
            </div>
            <div className="p-4 flex-1 flex flex-col justify-center gap-3">
              <div className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/10">
                <div className="flex items-center gap-3">
                  <Clock className="w-5 h-5 text-blue-400" />
                  <span className="font-medium text-foreground/80 text-sm">Baru Masuk</span>
                </div>
                <span className="text-lg font-bold text-blue-400">{antreanMasuk}</span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/10">
                <div className="flex items-center gap-3">
                  <Clock className="w-5 h-5 text-indigo-400" />
                  <span className="font-medium text-foreground/80 text-sm">Siap Proses</span>
                </div>
                <span className="text-lg font-bold text-indigo-400">{antreanSiapProses}</span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/10">
                <div className="flex items-center gap-3">
                  <Activity className="w-5 h-5 text-yellow-400" />
                  <span className="font-medium text-foreground/80 text-sm">Sedang Proses</span>
                </div>
                <span className="text-lg font-bold text-yellow-400">{antreanProses}</span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/10">
                <div className="flex items-center gap-3">
                  <CheckCircle className="w-5 h-5 text-green-400" />
                  <span className="font-medium text-foreground/80 text-sm">Siap Kirim / Ambil</span>
                </div>
                <span className="text-lg font-bold text-green-400">{antreanSiapAmbil}</span>
              </div>
            </div>
          </div>

          <StockSearchWidget products={products || []} />
        </div>

        {/* PIUTANG SO (Belum Lunas) */}
        <div className="glass-card flex min-h-0 flex-col lg:col-span-1 border-t-4 border-yellow-500 h-fit">
          <div className="p-4 border-b border-white/10 bg-white/5 flex justify-between items-center">
            <h2 className="font-bold text-foreground flex items-center gap-2">
              <FileText className="w-5 h-5 text-yellow-400" /> Pesanan Belum Lunas
            </h2>
            <Link href="/sales" className="text-xs text-primary hover:underline">Lihat SO</Link>
          </div>
             <div className="p-4 min-h-0 flex-1 overflow-y-auto max-h-[450px] space-y-3">
             {(() => {
               if (unpaidOrders.length === 0) {
                 return <div className="text-center text-foreground/40 py-8">Belum ada piutang/pesanan aktif.</div>
               }

               const groupedUnpaid = unpaidOrders.reduce((acc, so) => {
                 const month = so.date ? so.date.substring(0, 7) : 'Unknown'
                 if (!acc[month]) acc[month] = { totalRp: 0, orders: [] }
                 
                 const sisa = getOpenBalance(so)
                 
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
                        <div className="font-bold text-yellow-400">Rp {groupedUnpaid[month].totalRp.toLocaleString('id-ID', { maximumFractionDigits: 0 })}</div>
                     </summary>
                     <div className="p-3 border-t border-white/10 bg-black/20 space-y-2">
                        {groupedUnpaid[month].orders.map(so => (
                          <div key={so.id} className="flex justify-between items-center text-sm border-b border-white/5 pb-2 last:border-0 last:pb-0 hover:bg-white/5 p-1 rounded transition-colors">
                             <div>
                               <p className="font-bold text-foreground/90">{so.customers?.name || 'Unknown'}</p>
                               <p className="mt-0.5 text-xs text-foreground/50">
                                 SO {so.date ? new Date(`${so.date}T12:00:00`).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : 'tanpa tanggal'} · {String(so.payment_status || 'BELUM LUNAS').trim().toUpperCase()}
                               </p>
                             </div>
                             <p className="font-semibold text-yellow-400">Rp {so.sisaTagihan.toLocaleString('id-ID', { maximumFractionDigits: 0 })}</p>
                          </div>
                        ))}
                     </div>
                  </details>
               ))
             })()}
          </div>
          <div className="p-4 border-t border-white/10 bg-yellow-500/10 flex shrink-0 justify-between items-center">
            <span className="text-sm font-medium text-yellow-400">Total Keseluruhan:</span>
            <span className="text-lg font-bold text-yellow-500">
              Rp {unpaidOrders.reduce((acc, so) => acc + getOpenBalance(so), 0).toLocaleString('id-ID', { maximumFractionDigits: 0 })}
            </span>
          </div>
        </div>

      </div>

    </div>
  )
}
