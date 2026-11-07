import { redirect } from 'next/navigation'

export default async function PengaturanPage({ searchParams }) {
  const params = await Promise.resolve(searchParams || {})
  const tab = params.tab === 'salary' ? 'salary' : 'access'
  redirect(`/settings?tab=${tab}`)
}
