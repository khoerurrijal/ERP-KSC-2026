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

async function check() {
  const { data: so, error: soErr } = await supabase.from('sales_orders').select('*').eq('invoice_number', 'INV-8474').single()
  if (soErr) console.log(soErr)
  
  const { data: items, error: itemsErr } = await supabase.from('sales_items').select('*').eq('so_id', so.id)
  if (itemsErr) console.log(itemsErr)
  console.log("ITEMS:", items)
}

check()
