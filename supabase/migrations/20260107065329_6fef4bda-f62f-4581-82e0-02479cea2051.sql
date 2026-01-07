-- Add is_manager column to staff_users table
ALTER TABLE public.staff_users 
ADD COLUMN is_manager boolean DEFAULT false;