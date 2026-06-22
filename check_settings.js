const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data, error } = await supabase.from('system_settings').select('*');
  const dropdownConfig = data?.find(d => d.key === 'dropdown_config')?.value;
  console.log("customer_type:", dropdownConfig?.customer_type);
}

check();
