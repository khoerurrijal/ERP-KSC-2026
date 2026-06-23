const fs = require('fs');

async function run() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const sql = fs.readFileSync('database/46_fast_track_and_jasa.sql', 'utf8');

  // Supabase REST API doesn't allow executing arbitrary raw SQL easily from anon key unless rpc 'exec_sql' exists
  // I will just use the REST API to run exec_sql
  const res = await fetch(`${url}/rest/v1/rpc/exec_sql`, {
    method: 'POST',
    headers: {
      'apikey': key,
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ sql_string: sql })
  });

  const responseText = await res.text();
  console.log(res.status, responseText);
}
run();
