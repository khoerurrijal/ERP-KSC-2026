async function run() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const res = await fetch(url+'/rest/v1/products?limit=1', {headers: {'apikey':key, 'Authorization':'Bearer '+key}});
  console.log(await res.text());
}
run();
