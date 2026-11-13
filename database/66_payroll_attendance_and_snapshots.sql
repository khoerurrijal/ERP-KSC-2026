BEGIN;

-- Role defaults for attendance-based pay. Backfill each role from the median of
-- the employee-specific values currently in use so existing rates remain usable.
ALTER TABLE public.salary_schemas
  ADD COLUMN IF NOT EXISTS gaji_harian NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS uang_makan NUMERIC NOT NULL DEFAULT 0;

WITH role_rates AS (
  SELECT
    salary_schema_id,
    percentile_disc(0.5) WITHIN GROUP (ORDER BY COALESCE(gaji_harian, 0)) AS gaji_harian,
    percentile_disc(0.5) WITHIN GROUP (ORDER BY COALESCE(uang_makan, 0)) AS uang_makan
  FROM public.employees
  WHERE salary_schema_id IS NOT NULL
  GROUP BY salary_schema_id
)
UPDATE public.salary_schemas AS ss
SET
  gaji_harian = CASE WHEN ss.gaji_harian = 0 THEN rates.gaji_harian ELSE ss.gaji_harian END,
  uang_makan = CASE WHEN ss.uang_makan = 0 THEN rates.uang_makan ELSE ss.uang_makan END
FROM role_rates AS rates
WHERE ss.id = rates.salary_schema_id;

-- The second-color fee is a per-piece premium for the two operator roles.
UPDATE public.salary_schemas
SET fee_2_warna = 10
WHERE role_name IN ('Operator', 'Operator Mesin');

CREATE TABLE IF NOT EXISTS public.employee_attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  attendance_date DATE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('Hadir', 'Off', 'Izin', 'Sakit', 'Cuti', 'Alpa')),
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT employee_attendance_employee_date_unique UNIQUE (employee_id, attendance_date)
);

CREATE INDEX IF NOT EXISTS employee_attendance_date_idx
  ON public.employee_attendance(attendance_date);

ALTER TABLE public.employee_attendance ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.employee_attendance FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.employee_attendance TO service_role;

ALTER TABLE public.payroll_items
  ADD COLUMN IF NOT EXISTS attendance_days INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS piecework_qty NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS piecework_rate NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS two_color_qty NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS two_color_rate NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS two_color_amount NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS daily_bonus_amount NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS overtime_amount NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS late_deduction NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pinjaman_amount NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS gross_total NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_deductions NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS weekly_bonus_weeks INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS calculation_snapshot JSONB NOT NULL DEFAULT '{}'::JSONB;

COMMIT;

-- Rollback (only if no attendance data or payroll snapshots have been written):
-- DROP TABLE IF EXISTS public.employee_attendance;
-- ALTER TABLE public.salary_schemas DROP COLUMN IF EXISTS gaji_harian, DROP COLUMN IF EXISTS uang_makan;
-- ALTER TABLE public.payroll_items DROP COLUMN IF EXISTS attendance_days, DROP COLUMN IF EXISTS piecework_qty,
--   DROP COLUMN IF EXISTS piecework_rate, DROP COLUMN IF EXISTS two_color_qty, DROP COLUMN IF EXISTS two_color_rate,
--   DROP COLUMN IF EXISTS two_color_amount, DROP COLUMN IF EXISTS daily_bonus_amount, DROP COLUMN IF EXISTS overtime_amount,
--   DROP COLUMN IF EXISTS late_deduction, DROP COLUMN IF EXISTS pinjaman_amount, DROP COLUMN IF EXISTS gross_total,
--   DROP COLUMN IF EXISTS total_deductions, DROP COLUMN IF EXISTS weekly_bonus_weeks, DROP COLUMN IF EXISTS calculation_snapshot;
