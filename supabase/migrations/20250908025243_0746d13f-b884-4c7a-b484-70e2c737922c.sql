-- Create fresh it_bpn admin account
-- Delete any existing data first
DELETE FROM public.admin_accounts;

-- Insert it_bpn with password 'admin123' (simple password for testing)
-- Using bcrypt hash for 'admin123' 
INSERT INTO public.admin_accounts (username, password_hash) VALUES
('it_bpn', '$2b$10$N9qo8uLOickgx2ZMRXnxVeaiSnq0Q0GqypJqYGQJ8rrfIzo6nE8US');

-- Verify insertion
SELECT username, length(password_hash) as hash_length, substring(password_hash, 1, 7) as hash_prefix FROM public.admin_accounts;