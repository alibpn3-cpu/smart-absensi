-- Fix RLS configuration issues
-- Ensure RLS is enabled on admin_accounts
ALTER TABLE public.admin_accounts ENABLE ROW LEVEL SECURITY;

-- Verify all other tables have RLS enabled
ALTER TABLE public.staff_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.geofence_areas ENABLE ROW LEVEL SECURITY;