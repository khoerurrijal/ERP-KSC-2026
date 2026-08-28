-- Gate pesanan customer sebelum masuk Sales Order.
-- Jalankan setelah schema aplikasi yang sudah ada.

ALTER TABLE public.sales_orders
  ADD COLUMN IF NOT EXISTS source_request_id UUID,
  ADD COLUMN IF NOT EXISTS is_legacy_import BOOLEAN NOT NULL DEFAULT FALSE;

-- Tandai hanya data hasil migrasi lama. Data tidak dihapus dan tetap dapat
-- dicairkan melalui Rekonsiliasi Cepat; daftar Marketplace aktif tidak akan
-- mencampurnya dengan pesanan operasional baru.
UPDATE public.sales_orders
SET is_legacy_import = TRUE
WHERE is_legacy_import = FALSE
  AND created_at < TIMESTAMPTZ '2026-06-17 00:00:00+00';

CREATE INDEX IF NOT EXISTS sales_orders_marketplace_active_idx
  ON public.sales_orders (date DESC, created_at DESC)
  WHERE is_legacy_import = FALSE;

CREATE UNIQUE INDEX IF NOT EXISTS sales_orders_source_request_id_uq
  ON public.sales_orders (source_request_id)
  WHERE source_request_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.customer_order_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_number VARCHAR(100) UNIQUE NOT NULL,
  customer_code VARCHAR(50) REFERENCES public.customers(customer_code) ON DELETE SET NULL,
  brand_name VARCHAR(255) NOT NULL,
  whatsapp_number VARCHAR(50) NOT NULL,
  request_fingerprint VARCHAR(128),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  sales_order_id UUID REFERENCES public.sales_orders(id) ON DELETE SET NULL,
  approved_at TIMESTAMP WITH TIME ZONE,
  approved_by VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.customer_order_requests
  ADD COLUMN IF NOT EXISTS request_fingerprint VARCHAR(128);

CREATE UNIQUE INDEX IF NOT EXISTS customer_order_requests_sales_order_id_uq
  ON public.customer_order_requests (sales_order_id)
  WHERE sales_order_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS customer_order_requests_pending_idx
  ON public.customer_order_requests (created_at DESC)
  WHERE sales_order_id IS NULL;

CREATE INDEX IF NOT EXISTS customer_order_requests_fingerprint_idx
  ON public.customer_order_requests (request_fingerprint, created_at DESC)
  WHERE sales_order_id IS NULL;

CREATE TABLE IF NOT EXISTS public.admin_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_type VARCHAR(80) NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  href TEXT,
  entity_id UUID,
  read_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS admin_notifications_unread_idx
  ON public.admin_notifications (created_at DESC)
  WHERE read_at IS NULL;

ALTER TABLE public.customer_order_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS customer_order_requests_public_insert ON public.customer_order_requests;
CREATE POLICY customer_order_requests_public_insert
  ON public.customer_order_requests FOR INSERT
  TO anon, authenticated
  WITH CHECK (sales_order_id IS NULL AND approved_at IS NULL AND approved_by IS NULL);

DROP POLICY IF EXISTS customer_order_requests_authenticated_access ON public.customer_order_requests;
CREATE POLICY customer_order_requests_authenticated_access
  ON public.customer_order_requests FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS admin_notifications_authenticated_access ON public.admin_notifications;
CREATE POLICY admin_notifications_authenticated_access
  ON public.admin_notifications FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE ON public.customer_order_requests TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.admin_notifications TO authenticated;

CREATE OR REPLACE FUNCTION public.notify_new_customer_order_request()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.admin_notifications (notification_type, title, message, href, entity_id)
  VALUES (
    'NEW_ORDER_REQUEST',
    'Pesanan customer baru',
    NEW.brand_name || ' mengirim ' || NEW.request_number || ' dan menunggu pemeriksaan Admin.',
    '/dashboard/order-requests',
    NEW.id
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS customer_order_request_notification_trigger ON public.customer_order_requests;
CREATE TRIGGER customer_order_request_notification_trigger
AFTER INSERT ON public.customer_order_requests
FOR EACH ROW
EXECUTE FUNCTION public.notify_new_customer_order_request();
