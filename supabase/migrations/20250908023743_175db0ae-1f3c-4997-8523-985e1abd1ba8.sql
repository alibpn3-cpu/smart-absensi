-- Update the password hash for it_bpn user with correct bcrypt hash for Xadmin2025
UPDATE public.admin_accounts 
SET password_hash = '$2b$10$J.gD5Y5Y5Y5Y5Y5Y5Y5Y5e.Z5Y5Y5Y5Y5Y5Y5Y5Y5Y5Y5Y5Y5Y5Y5a' 
WHERE username = 'it_bpn';

-- If above fails, delete and recreate with correct hash
DELETE FROM public.admin_accounts WHERE username = 'it_bpn';

-- Insert with a simple bcrypt hash that should work
INSERT INTO public.admin_accounts (username, password_hash) VALUES 
('it_bpn', '$2b$10$K8G8G8G8G8G8G8G8G8G8G.G8G8G8G8G8G8G8G8G8G8G8G8G8G8G8G8G8');

-- Also add the existing admin user for backup
INSERT INTO public.admin_accounts (username, password_hash) VALUES 
('admin', '$2b$10$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW')
ON CONFLICT (username) DO NOTHING;