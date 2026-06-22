const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data, error } = await supabase.from('wa_chat_history').select('*').order('created_at', { ascending: false }).limit(20);
  console.log("Data:");
  data.forEach(d => {
    console.log(`[${d.role}] to/from ${d.phone_number}: ${d.content.substring(0, 50)}`);
  });
}

check();
