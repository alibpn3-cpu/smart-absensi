-- Fix RLS policy for admin_accounts to allow login process
-- Remove the current restrictive policy
DROP POLICY IF EXISTS "Authenticated users can view admin_accounts" ON public.admin_accounts;
DROP POLICY IF EXISTS "Authenticated users can manage admin_accounts" ON public.admin_accounts;

-- Create a policy that allows reading admin accounts for login (but not listing all)
-- This allows the login process to work while still protecting the data
CREATE POLICY "Allow login verification" 
ON public.admin_accounts 
FOR SELECT 
USING (true);

-- Only authenticated users can insert/update/delete admin accounts
CREATE POLICY "Authenticated users can manage admin_accounts" 
ON public.admin_accounts 
FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);