import Link from 'next/link'
import { createClient } from '@/utils/supabase/server'
import { requireAdminOrOwner } from '@/lib/adminAuth'
import { ArrowRight, Inbox } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function CustomerOrderRequestsPage() {
  const supabase = await createClient()
  await requireAdminOrOwner(supabase)

  const { data: requests, error } = await supabase
    .from('customer_order_requests')
    .select('id, request_number, brand_name, whatsapp_number, payload, created_at, customers(name)')
    .is('sales_order_id', null)
    .order('created_at', { ascending: false })

  if (error) {
    return <div className="glass-card p-6 text-red-400">Gagal membaca pesanan masuk: {error.message}</div>
  }

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2"><Inbox className="w-6 h-6 text-primary" /> Pesanan Masuk</h1>
          <p className="text-sm text-foreground/60 mt-1">Pesanan customer yang belum dikonfirmasi Admin.</p>
        </div>
        <span className="text-sm font-bold text-primary">{requests?.length || 0} menunggu</span>
      </div>

      <div className="glass-card overflow-hidden">
        {(requests || []).length === 0 ? (
          <div className="p-10 text-center text-foreground/50">Tidak ada pesanan baru yang menunggu konfirmasi.</div>
        ) : (
          <div className="divide-y divide-white/10">
            {requests.map(request => {
              const payload = request.payload || {}
              const itemCount = Array.isArray(payload.items) ? payload.items.length : 0
              return (
                <Link key={request.id} href={`/dashboard/order-requests/${request.id}`} className="flex items-center justify-between gap-4 p-4 hover:bg-white/5 transition-colors">
                  <div className="min-w-0">
                    <p className="font-bold text-foreground truncate">{request.brand_name}</p>
                    <p className="text-xs text-foreground/50 mt-1">{request.request_number} · {itemCount} jenis item · {request.whatsapp_number}</p>
                    <p className="text-xs text-foreground/40 mt-1">{new Date(request.created_at).toLocaleString('id-ID')}</p>
                  </div>
                  <span className="shrink-0 text-sm font-bold text-primary flex items-center gap-2">Buka Form <ArrowRight className="w-4 h-4" /></span>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
