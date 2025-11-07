-- Add RLS policy to allow inserts into admin_activity_logs
-- This allows the client to log admin activities
CREATE POLICY "Allow insert admin activity logs"
ON public.admin_activity_logs
FOR INSERT
WITH CHECK (true);