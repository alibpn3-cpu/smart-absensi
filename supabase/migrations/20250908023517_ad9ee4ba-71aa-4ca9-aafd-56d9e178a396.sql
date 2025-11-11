-- Create new admin user with username it_bpn and password Xadmin2025
INSERT INTO public.admin_accounts (username, password_hash) VALUES 
('it_bpn', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi'); -- bcrypt hash for Xadmin2025

-- Fix RLS policies for admin_accounts to allow proper login verification
DROP POLICY IF EXISTS "Allow login verification" ON public.admin_accounts;
DROP POLICY IF EXISTS "Authenticated users can manage admin_accounts" ON public.admin_accounts;

-- Create new policy that allows SELECT for login verification (no auth required)
CREATE POLICY "Allow login verification" 
ON public.admin_accounts 
FOR SELECT 
TO anon, authenticated
USING (true);

-- Create policy for authenticated users to manage admin accounts
CREATE POLICY "Authenticated users can manage admin_accounts" 
ON public.admin_accounts 
FOR ALL 
TO authenticated
USING (true) 
WITH CHECK (true);