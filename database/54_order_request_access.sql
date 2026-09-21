-- Focused access policy for the guest-order review queue.
-- Public intake uses the server admin client; anon must not access this table.
-- This migration intentionally does not change RLS for unrelated tables.

CREATE OR REPLACE FUNCTION public.app_is_admin()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT UPPER(COALESCE(role_entry->>'role', 'OPERATOR')) IN ('ADMIN', 'OWNER')
      FROM public.system_settings settings,
           jsonb_array_elements(
             CASE WHEN jsonb_typeof(settings.value) = 'array' THEN settings.value ELSE '[]'::jsonb END
           ) AS role_entry
      WHERE settings.key = 'user_roles'
        AND (
          LOWER(role_entry->>'email') = LOWER(auth.jwt()->>'email')
          OR LOWER(role_entry->>'email') || '@kingsablon.com' = LOWER(auth.jwt()->>'email')
        )
      LIMIT 1
    ),
    FALSE
  ) AND auth.uid() IS NOT NULL;
$$;

REVOKE ALL ON FUNCTION public.app_is_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.app_is_admin() TO authenticated;

ALTER TABLE public.customer_order_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS customer_order_requests_public_insert ON public.customer_order_requests;
DROP POLICY IF EXISTS customer_order_requests_authenticated_access ON public.customer_order_requests;
DROP POLICY IF EXISTS customer_order_requests_admin_access ON public.customer_order_requests;
DROP POLICY IF EXISTS app_authenticated_read ON public.customer_order_requests;
DROP POLICY IF EXISTS admin_notifications_authenticated_access ON public.admin_notifications;
DROP POLICY IF EXISTS admin_notifications_admin_access ON public.admin_notifications;
DROP POLICY IF EXISTS app_authenticated_read ON public.admin_notifications;

REVOKE ALL ON TABLE public.customer_order_requests FROM anon, authenticated;
REVOKE ALL ON TABLE public.admin_notifications FROM anon, authenticated;
GRANT SELECT, UPDATE ON TABLE public.customer_order_requests TO authenticated;
GRANT SELECT ON TABLE public.admin_notifications TO authenticated;

CREATE POLICY customer_order_requests_admin_access
  ON public.customer_order_requests
  FOR ALL
  TO authenticated
  USING (public.app_is_admin())
  WITH CHECK (public.app_is_admin());

CREATE POLICY admin_notifications_admin_access
  ON public.admin_notifications
  FOR SELECT
  TO authenticated
  USING (public.app_is_admin());
