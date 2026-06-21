require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function checkConfig() {
  const { data, error } = await supabase.from('system_settings').select('*').eq('key', 'dropdown_config').single();
  if (error) console.error(error);
  else console.log(JSON.stringify(data.value, null, 2));
}

checkConfig();
