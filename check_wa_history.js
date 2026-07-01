const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function run() {
  console.log("Fetching last 50 entries in wa_chat_history...");
  const { data, error } = await supabase
    .from('wa_chat_history')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    console.error("Error:", error);
    return;
  }

  console.log(`Found ${data.length} entries:`);
  data.forEach(row => {
    console.log(`[${row.created_at}] Phone: ${row.phone_number} | Role: ${row.role} | Content: "${row.content.substring(0, 100).replace(/\n/g, ' ')}"`);
  });
}

run();
