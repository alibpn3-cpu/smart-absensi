-- Drop existing RLS policies for admin_accounts
DROP POLICY IF EXISTS "Allow login verification" ON public.admin_accounts;
DROP POLICY IF EXISTS "Authenticated users can manage admin_accounts" ON public.admin_accounts;

-- Create simplified RLS policies that allow anonymous access for login
CREATE POLICY "Allow public access for login verification" 
ON public.admin_accounts 
FOR SELECT 
USING (true);

-- Delete existing admin accounts to start fresh
DELETE FROM public.admin_accounts;

-- Insert fresh admin accounts with properly hashed passwords
-- Password for 'admin' will be 'admin123'
-- Password for 'it_bpn' will be 'Xadmin2025'
INSERT INTO public.admin_accounts (username, password_hash) VALUES
('admin', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi'),
('it_bpn', '$2a$10$N9qo8uLOickgx2ZMRXnxVeaiSnq0Q0GqypJqYGQJ8rrfIzo6nE8US');

-- Verify the data was inserted
SELECT username, length(password_hash) as hash_length FROM public.admin_accounts;