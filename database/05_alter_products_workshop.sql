-- Menambahkan relasi kepemilikan Workshop pada tabel Products
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS workshop_id UUID REFERENCES public.workshops(id) ON DELETE SET NULL;
