require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
async function checkTable() {
  const { data, error } = await supabase.from('sablon_matrix').select('*');
  if (error) {
    console.log("Error or table doesn't exist:", error);
  } else {
    console.log("Data in sablon_matrixs:", JSON.stringify(data, null, 2));
  }
}
checkTable();
