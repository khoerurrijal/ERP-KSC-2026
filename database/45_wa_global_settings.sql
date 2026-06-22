-- Tabel untuk pengaturan global WhatsApp Bot
CREATE TABLE IF NOT EXISTS public.wa_global_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Insert default setting (BOT ON by default)
INSERT INTO public.wa_global_settings (key, value)
VALUES ('GLOBAL_BOT_ACTIVE', 'true')
ON CONFLICT (key) DO NOTHING;

-- RLS
ALTER TABLE public.wa_global_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable all for public on wa_global_settings" 
ON public.wa_global_settings FOR ALL USING (true);
