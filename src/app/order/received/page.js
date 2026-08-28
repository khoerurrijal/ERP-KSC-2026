import Link from 'next/link'

export default async function OrderReceivedPage({ searchParams }) {
  const params = await searchParams
  const requestNumber = params?.request || '-'

  return (
    <main className="min-h-screen flex items-center justify-center p-6 bg-background text-foreground">
      <div className="max-w-md w-full glass-card p-8 text-center space-y-4">
        <div className="text-5xl">✅</div>
        <h1 className="text-2xl font-black">Pesanan diterima</h1>
        <p className="text-foreground/60">Pesanan kamu sudah masuk ke antrian pemeriksaan Admin. Pesanan belum menjadi Sales Order sampai dikonfirmasi Admin.</p>
        <p className="font-bold text-primary">Nomor request: {requestNumber}</p>
        <Link href="/order" className="inline-flex btn-primary px-5 py-3">Kembali ke Form Pesanan</Link>
      </div>
    </main>
  )
}
