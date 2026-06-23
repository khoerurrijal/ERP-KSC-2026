
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

async function run() {
  const mutRes = await fetch(`${url}/rest/v1/stock_mutations?limit=5`, {
    headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
  });
  console.log(await mutRes.json());
}
run();
