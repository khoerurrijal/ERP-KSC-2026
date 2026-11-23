BEGIN;

UPDATE public.system_settings AS settings
SET value = jsonb_set(
  COALESCE(settings.value, '{}'::jsonb),
  '{printing_matrix}',
  COALESCE((
    SELECT jsonb_object_agg(color, tiers - '3000')
    FROM jsonb_each(COALESCE(settings.value->'printing_matrix', '{}'::jsonb)) AS matrix(color, tiers)
  ), '{}'::jsonb),
  true
), updated_at = NOW()
WHERE settings.key = 'pricelist_config';

ALTER TABLE public.printing_matrix
  DROP COLUMN IF EXISTS "3000";

COMMIT;
