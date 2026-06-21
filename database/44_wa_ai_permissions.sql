-- Berikan hak akses kepada anon dan authenticated
GRANT ALL ON TABLE public.wa_sessions TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.wa_chat_history TO anon, authenticated, service_role;

-- Karena kita pakai UUID yang generate-nya butuh waktu, pastikan role ini bisa akses juga
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

-- Cek apakah RLS public sudah tertanam benar
DROP POLICY IF EXISTS "Enable all for public on wa_sessions" ON public.wa_sessions;
DROP POLICY IF EXISTS "Enable all for public on wa_chat_history" ON public.wa_chat_history;

CREATE POLICY "Enable all for public on wa_sessions" 
ON public.wa_sessions FOR ALL USING (true);

CREATE POLICY "Enable all for public on wa_chat_history" 
ON public.wa_chat_history FOR ALL USING (true);
