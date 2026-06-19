import { createClient } from '@/utils/supabase/server'
import TransactionsClient from './TransactionsClient'

export default async function TransactionsPage() {
  const supabase = await createClient()
  const { data: transactions, error } = await supabase
    .from('transactions')
    .select('*, sales_orders(invoice_number, customers(name))')
    .order('date', { ascending: false })

  const { data: settings } = await supabase.from('system_settings').select('*').eq('key', 'dropdown_config').single()
  const dropdownConfig = settings?.value || {}

  return <TransactionsClient transactions={transactions || []} dropdownConfig={dropdownConfig} />
}
