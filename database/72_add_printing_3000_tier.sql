BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'printing_matrix'
      AND column_name = '3000'
  ) THEN
    ALTER TABLE public.printing_matrix
      ADD COLUMN "3000" integer NOT NULL DEFAULT 0;

    UPDATE public.printing_matrix
    SET "3000" = COALESCE("5000", 0);
  END IF;
END;
$$;

UPDATE public.system_settings AS settings
SET value = jsonb_set(
  COALESCE(settings.value, '{}'::jsonb),
  '{printing_matrix}',
  COALESCE((
    SELECT jsonb_object_agg(
      matrix.category,
      jsonb_build_object(
        '3000', COALESCE(matrix."3000", 0),
        '5000', COALESCE(matrix."5000", 0),
        '10000', COALESCE(matrix."10000", 0),
        '30000', COALESCE(matrix."30000", 0)
      )
    )
    FROM public.printing_matrix AS matrix
    WHERE matrix.category IS NOT NULL
  ), '{}'::jsonb),
  true
), updated_at = NOW()
WHERE settings.key = 'pricelist_config';

COMMIT;
