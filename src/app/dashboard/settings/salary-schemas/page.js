import { redirect } from 'next/navigation'

export default async function SalarySchemasPage() {
  redirect('/settings?tab=salary')
}
