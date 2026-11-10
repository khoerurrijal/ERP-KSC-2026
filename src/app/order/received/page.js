import Link from 'next/link'
import { Check } from 'lucide-react'

export default async function OrderReceivedPage({ searchParams }) {
  const params = await searchParams
  const requestNumber = params?.request || '-'

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f8f7f4] p-5 text-stone-900">
      <div className="w-full max-w-md rounded-2xl border border-stone-200 bg-white p-6 text-center sm:p-8">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#f5edda] text-[#755615]"><Check className="h-7 w-7" aria-hidden="true" /></div>
        <h1 className="mt-5 text-2xl font-bold">Permintaan diterima</h1>
        <p className="mt-2 text-sm leading-6 text-stone-600">Admin akan memeriksa dan mengonfirmasi detail pesanan kamu.</p>
        <div className="mt-6 rounded-xl bg-[#f8f7f4] p-4"><p className="text-xs text-stone-500">Nomor permintaan</p><p className="mt-1 break-all font-bold text-[#755615]">{requestNumber}</p></div>
        <Link href="/order" className="mt-6 inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-[#755615] px-5 py-3 text-sm font-bold text-white hover:bg-[#60460f] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#755615]">Kembali ke katalog</Link>
      </div>
    </main>
  )
}
