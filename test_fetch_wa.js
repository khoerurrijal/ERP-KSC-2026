require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function run() {
  const { data: logs, error } = await supabase.from('wa_chat_history').select('*').order('created_at', { ascending: false }).limit(5);
  console.log('Chat History:', logs);
  if (error) console.error('Error:', error);
}
run();
