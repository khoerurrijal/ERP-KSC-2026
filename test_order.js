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
  const { data, error } = await supabase
    .from('sales_items')
    .select(`
      id,
      sales_orders!inner(date)
    `)
    .order('date', { foreignTable: 'sales_orders', ascending: false })
    .limit(5)

  if (error) console.error("Error:", error)
  console.log("Data:", data)
}

check()
