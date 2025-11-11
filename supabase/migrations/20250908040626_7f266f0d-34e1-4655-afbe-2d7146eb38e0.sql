-- Disable Row Level Security on all tables since security is not needed for this internal app
ALTER TABLE public.admin_accounts DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_records DISABLE ROW LEVEL SECURITY;  
ALTER TABLE public.geofence_areas DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_users DISABLE ROW LEVEL SECURITY;

-- Drop all existing RLS policies since they're not needed
DROP POLICY IF EXISTS "Allow authenticated users to delete admin accounts" ON public.admin_accounts;
DROP POLICY IF EXISTS "Allow authenticated users to insert admin accounts" ON public.admin_accounts;
DROP POLICY IF EXISTS "Allow authenticated users to update admin accounts" ON public.admin_accounts;
DROP POLICY IF EXISTS "Allow public access for login verification" ON public.admin_accounts;

DROP POLICY IF EXISTS "Authenticated users can delete attendance_records" ON public.attendance_records;
DROP POLICY IF EXISTS "Authenticated users can insert attendance_records" ON public.attendance_records;
DROP POLICY IF EXISTS "Authenticated users can update attendance_records" ON public.attendance_records;
DROP POLICY IF EXISTS "Authenticated users can view attendance_records" ON public.attendance_records;

DROP POLICY IF EXISTS "Authenticated users can manage geofence_areas" ON public.geofence_areas;

DROP POLICY IF EXISTS "Authenticated users can delete staff_users" ON public.staff_users;
DROP POLICY IF EXISTS "Authenticated users can insert staff_users" ON public.staff_users;
DROP POLICY IF EXISTS "Authenticated users can update staff_users" ON public.staff_users;
DROP POLICY IF EXISTS "Authenticated users can view staff_users" ON public.staff_users;