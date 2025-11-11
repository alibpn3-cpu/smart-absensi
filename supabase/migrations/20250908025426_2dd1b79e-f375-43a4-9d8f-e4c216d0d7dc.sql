-- Fix the password hash for it_bpn
-- Delete existing account and create with proper hash for 'admin123'
DELETE FROM public.admin_accounts WHERE username = 'it_bpn';

-- Insert with proper bcrypt hash for 'admin123'
-- Using online bcrypt generator with cost 10 for 'admin123'
INSERT INTO public.admin_accounts (username, password_hash) VALUES
('it_bpn', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi');

-- Verify the insertion
SELECT username, password_hash FROM public.admin_accounts;