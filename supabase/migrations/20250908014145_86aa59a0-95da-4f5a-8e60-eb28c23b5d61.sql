-- Fix security vulnerability: Restrict access to staff_users table
-- Remove the overly permissive policy that allows public access
DROP POLICY IF EXISTS "Allow all access to staff_users" ON public.staff_users;

-- Create secure policies that only allow authenticated users to access staff data
-- Only authenticated users can view staff records
CREATE POLICY "Authenticated users can view staff_users" 
ON public.staff_users 
FOR SELECT 
TO authenticated 
USING (true);

-- Only authenticated users can insert staff records
CREATE POLICY "Authenticated users can insert staff_users" 
ON public.staff_users 
FOR INSERT 
TO authenticated 
WITH CHECK (true);

-- Only authenticated users can update staff records
CREATE POLICY "Authenticated users can update staff_users" 
ON public.staff_users 
FOR UPDATE 
TO authenticated 
USING (true) 
WITH CHECK (true);

-- Only authenticated users can delete staff records
CREATE POLICY "Authenticated users can delete staff_users" 
ON public.staff_users 
FOR DELETE 
TO authenticated 
USING (true);

-- Apply the same security fix to attendance_records table
DROP POLICY IF EXISTS "Allow all access to attendance_records" ON public.attendance_records;

CREATE POLICY "Authenticated users can view attendance_records" 
ON public.attendance_records 
FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Authenticated users can insert attendance_records" 
ON public.attendance_records 
FOR INSERT 
TO authenticated 
WITH CHECK (true);

CREATE POLICY "Authenticated users can update attendance_records" 
ON public.attendance_records 
FOR UPDATE 
TO authenticated 
USING (true) 
WITH CHECK (true);

CREATE POLICY "Authenticated users can delete attendance_records" 
ON public.attendance_records 
FOR DELETE 
TO authenticated 
USING (true);

-- Also secure the admin_accounts table properly
DROP POLICY IF EXISTS "Allow all access to admin_accounts" ON public.admin_accounts;

CREATE POLICY "Authenticated users can view admin_accounts" 
ON public.admin_accounts 
FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Authenticated users can manage admin_accounts" 
ON public.admin_accounts 
FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);

-- Secure geofence_areas table
DROP POLICY IF EXISTS "Allow all access to geofence_areas" ON public.geofence_areas;

CREATE POLICY "Authenticated users can manage geofence_areas" 
ON public.geofence_areas 
FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);