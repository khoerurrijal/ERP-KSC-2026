BEGIN;

ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS bonus_mingguan NUMERIC;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'salary_schemas'
      AND column_name IN ('gaji_harian', 'uang_makan')
    GROUP BY table_name
    HAVING COUNT(DISTINCT column_name) = 2
  ) THEN
    UPDATE public.employees AS employee
    SET
      gaji_harian = CASE
        WHEN COALESCE(employee.gaji_harian, 0) = 0 THEN COALESCE(salary_schema.gaji_harian, 0)
        ELSE employee.gaji_harian
      END,
      uang_makan = CASE
        WHEN COALESCE(employee.uang_makan, 0) = 0 THEN COALESCE(salary_schema.uang_makan, 0)
        ELSE employee.uang_makan
      END
    FROM public.salary_schemas AS salary_schema
    WHERE employee.salary_schema_id = salary_schema.id;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'salary_schemas'
      AND column_name = 'bonus_mingguan'
  ) THEN
    UPDATE public.employees AS employee
    SET bonus_mingguan = COALESCE(salary_schema.bonus_mingguan, 0)
    FROM public.salary_schemas AS salary_schema
    WHERE employee.salary_schema_id = salary_schema.id
      AND employee.bonus_mingguan IS NULL;
  END IF;
END
$$;

UPDATE public.employees
SET bonus_mingguan = 0
WHERE bonus_mingguan IS NULL;

ALTER TABLE public.employees
  ALTER COLUMN bonus_mingguan SET DEFAULT 0,
  ALTER COLUMN bonus_mingguan SET NOT NULL;

ALTER TABLE public.salary_schemas
  DROP COLUMN IF EXISTS gaji_harian,
  DROP COLUMN IF EXISTS uang_makan,
  DROP COLUMN IF EXISTS bonus_mingguan;

COMMIT;
