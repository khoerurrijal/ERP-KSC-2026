import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321'
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'test'

import fs from 'fs'
import path from 'path'
import dotenv from 'dotenv'

dotenv.config({ path: path.resolve('c:/Users/asus/Documents/KING SABLON CUP MASTER ERP/.env.local') })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

async function testJoin() {
  const { data: rawItems, error } = await supabase
    .from('sales_items')
    .select(`
      id, so_id,
      sales_orders!inner(id, invoice_number, date, payment_status, customers(name)),
      products(name)
    `)
    .eq('sales_orders.invoice_number', 'INV-8474')
    
  if (error) console.error(error)
  console.log("Joined Items:", rawItems)
}

testJoin()
