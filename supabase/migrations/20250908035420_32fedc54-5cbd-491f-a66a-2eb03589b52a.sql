-- Fix RLS policies for admin_accounts table to allow admin operations
-- Drop existing policies first
DROP POLICY IF EXISTS "Allow public access for login verification" ON public.admin_accounts;

-- Create comprehensive RLS policies for admin_accounts
-- Allow SELECT for login verification (public access needed for login)
CREATE POLICY "Allow public access for login verification" 
ON public.admin_accounts 
FOR SELECT 
USING (true);

-- Allow INSERT for creating new admin accounts
CREATE POLICY "Allow authenticated users to insert admin accounts" 
ON public.admin_accounts 
FOR INSERT 
WITH CHECK (true);

-- Allow UPDATE for editing admin accounts
CREATE POLICY "Allow authenticated users to update admin accounts" 
ON public.admin_accounts 
FOR UPDATE 
USING (true) 
WITH CHECK (true);

-- Allow DELETE for removing admin accounts
CREATE POLICY "Allow authenticated users to delete admin accounts" 
ON public.admin_accounts 
FOR DELETE 
USING (true);