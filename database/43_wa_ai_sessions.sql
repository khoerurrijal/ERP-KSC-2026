-- Tabel untuk menyimpan sesi pengaturan AI per nomor WA
CREATE TABLE IF NOT EXISTS public.wa_sessions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    phone_number TEXT UNIQUE NOT NULL,
    is_bot_active BOOLEAN DEFAULT true,
    last_interaction TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabel untuk menyimpan riwayat chat agar AI punya ingatan
CREATE TABLE IF NOT EXISTS public.wa_chat_history (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    phone_number TEXT NOT NULL,
    role TEXT NOT NULL, -- 'user' atau 'model'
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexing untuk mempercepat pencarian riwayat chat
CREATE INDEX IF NOT EXISTS idx_wa_chat_history_phone ON public.wa_chat_history(phone_number);
CREATE INDEX IF NOT EXISTS idx_wa_chat_history_created_at ON public.wa_chat_history(created_at);

-- Set RLS policies
ALTER TABLE public.wa_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wa_chat_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable all for public on wa_sessions" 
ON public.wa_sessions FOR ALL USING (true);

CREATE POLICY "Enable all for public on wa_chat_history" 
ON public.wa_chat_history FOR ALL USING (true);
