-- Prevent the same WhatsApp webhook from being processed more than once.
ALTER TABLE public.wa_chat_history
    ADD COLUMN IF NOT EXISTS dedupe_key TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS wa_chat_history_dedupe_key_uidx
    ON public.wa_chat_history (dedupe_key)
    WHERE dedupe_key IS NOT NULL;
