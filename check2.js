const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
async function run() {
  const { data, error } = await supabase.from('wa_global_settings').select('*');
  console.log('wa_global_settings:', data, error);
  const { data: sysData, error: sysErr } = await supabase.from('system_settings').select('*');
  console.log('system_settings:', sysData?.find(s => s.key === 'GLOBAL_BOT_ACTIVE'), sysErr);
}
run();
