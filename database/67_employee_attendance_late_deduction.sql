BEGIN;

ALTER TABLE public.employee_attendance
  ADD COLUMN IF NOT EXISTS late_deduction NUMERIC NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.employee_attendance'::regclass
      AND conname = 'employee_attendance_late_deduction_nonnegative'
  ) THEN
    ALTER TABLE public.employee_attendance
      ADD CONSTRAINT employee_attendance_late_deduction_nonnegative
      CHECK (late_deduction >= 0);
  END IF;
END
$$;

COMMIT;
