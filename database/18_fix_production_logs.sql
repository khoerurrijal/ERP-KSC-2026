-- 18_fix_production_logs.sql
-- Run this in Supabase SQL Editor to fix the missing employee_id column error

-- Drop the old table that was created from 03_full_schema_v2
DROP TABLE IF EXISTS public.production_logs CASCADE;

-- Recreate with the correct schema from Sprint 4
CREATE TABLE public.production_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID REFERENCES public.sales_items(id) ON DELETE CASCADE,
    employee_id UUID REFERENCES public.employees(id) ON DELETE SET NULL,
    qty_processed INTEGER NOT NULL,
    processed_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Grant permissions
GRANT ALL ON TABLE public.production_logs TO anon, authenticated;

-- Force PostgREST to reload schema cache so the API picks up the new employee_id column
NOTIFY pgrst, 'reload schema';
