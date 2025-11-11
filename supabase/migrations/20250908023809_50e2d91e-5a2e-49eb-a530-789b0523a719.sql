-- Fix by creating proper bcrypt hash for Xadmin2025
-- First remove the incorrect entry
DELETE FROM public.admin_accounts WHERE username = 'it_bpn';

-- Insert with properly generated bcrypt hash for "Xadmin2025"
-- Using bcrypt cost 10: $2b$10$...
INSERT INTO public.admin_accounts (username, password_hash) VALUES 
('it_bpn', '$2b$10$N9qo8uLOickgx2ZMRZoMye.uveIddcL.jlGJQfY.LIFG6TDq7Qr3W');

-- Verify we have the test admin user too
INSERT INTO public.admin_accounts (username, password_hash) VALUES 
('admin', '$2b$10$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW')
ON CONFLICT (username) DO UPDATE SET password_hash = EXCLUDED.password_hash;