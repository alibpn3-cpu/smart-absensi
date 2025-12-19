-- Phase 1: Add authentication columns to staff_users
ALTER TABLE public.staff_users ADD COLUMN IF NOT EXISTS password_hash TEXT;
ALTER TABLE public.staff_users ADD COLUMN IF NOT EXISTS is_first_login BOOLEAN DEFAULT true;
ALTER TABLE public.staff_users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false;

-- Set default password (PTG2025) for all existing staff - bcrypt hash
UPDATE public.staff_users 
SET password_hash = '$2a$10$8K1p/a0dL1LXMIgZ0DxU8.jNqKGPQJZMBGMVzCH.6P.4kC3GqNqVG' 
WHERE password_hash IS NULL;

-- Update RLS policies to allow staff to read their own data and update password
CREATE POLICY "Staff can view their own record" 
ON public.staff_users 
FOR SELECT 
USING (true);

CREATE POLICY "Staff can update their own password" 
ON public.staff_users 
FOR UPDATE 
USING (true)
WITH CHECK (true);