-- 01_auth_rbac.sql
-- Run this script in the Supabase SQL Editor

-- 1. Create Roles Table
CREATE TABLE public.roles (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Create Permissions Table
CREATE TABLE public.permissions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE, -- e.g. 'so:read', 'inventory:write'
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Create Role_Permissions Table (Many-to-Many)
CREATE TABLE public.role_permissions (
    role_id UUID REFERENCES public.roles(id) ON DELETE CASCADE,
    permission_id UUID REFERENCES public.permissions(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    PRIMARY KEY (role_id, permission_id)
);

-- 4. Create Users Extension Table 
-- (Links to Supabase auth.users to store additional data like role_id)
CREATE TABLE public.users (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    full_name VARCHAR(255),
    role_id UUID REFERENCES public.roles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. Insert Initial Roles
INSERT INTO public.roles (name) VALUES 
('Owner'),
('Admin'),
('Operator Mesin'),
('Operator'),
('Customer');

-- 6. Insert Basic Permissions (You can add more later)
INSERT INTO public.permissions (name, description) VALUES
('all', 'Super admin full access'),
('customer:read', 'Read customer data'),
('customer:write', 'Write customer data'),
('so:read', 'Read sales orders'),
('so:write', 'Write sales orders'),
('po:read', 'Read purchase orders'),
('po:write', 'Write purchase orders'),
('inventory:read', 'Read inventory'),
('inventory:write', 'Write inventory'),
('payroll:read', 'Read payrolls'),
('payroll:write', 'Write payrolls'),
('finance:read', 'Read finance mutations'),
('finance:write', 'Write finance mutations'),
('production:read', 'Read production data'),
('production:update', 'Update production status'),
('tracking:create', 'Create tracking logs'),
('packing:update', 'Update packing status');

-- 7. Assign Permissions to Roles (Example for Owner)
DO $$
DECLARE
    owner_role_id UUID;
    perm_all_id UUID;
BEGIN
    SELECT id INTO owner_role_id FROM public.roles WHERE name = 'Owner';
    SELECT id INTO perm_all_id FROM public.permissions WHERE name = 'all';
    
    INSERT INTO public.role_permissions (role_id, permission_id) 
    VALUES (owner_role_id, perm_all_id)
    ON CONFLICT DO NOTHING;
END $$;

-- Enable Row Level Security (RLS) on new tables
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Basic Policies (Allow authenticated users to read roles & permissions)
CREATE POLICY "Allow read access for authenticated users on roles" ON public.roles FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Allow read access for authenticated users on permissions" ON public.permissions FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Allow read access for authenticated users on role_permissions" ON public.role_permissions FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Allow users to read their own profile" ON public.users FOR SELECT USING (auth.uid() = id);

