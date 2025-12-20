-- Update all staff_users to have plain text password "PTG2025" (remove hash)
UPDATE public.staff_users 
SET password_hash = 'PTG2025'
WHERE password_hash IS NOT NULL AND password_hash LIKE '$2a$%';

-- Also update any NULL passwords
UPDATE public.staff_users 
SET password_hash = 'PTG2025'
WHERE password_hash IS NULL;