-- 1) Per-user auto supervisor-only leave approval
ALTER TABLE public.staff_users
  ADD COLUMN IF NOT EXISTS leave_supervisor_only boolean NOT NULL DEFAULT false;

-- 2) Schedule morning clock-in reminder at 07:30 WIB (00:30 UTC)
DO $$
BEGIN
  PERFORM cron.unschedule('remind-clock-in-daily');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'remind-clock-in-daily',
  '30 0 * * *',
  $$
  SELECT net.http_post(
    url := 'https://spqakoyhyziuxfgdkgpm.supabase.co/functions/v1/remind-clock-in',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNwcWFrb3loeXppdXhmZ2RrZ3BtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTcwMTE2MzAsImV4cCI6MjA3MjU4NzYzMH0.sLfUaH_DgoRcZzONOA-30RstLdIS-UMM24E3GkUHFyY"}'::jsonb,
    body := '{"trigger": "cron"}'::jsonb
  ) AS request_id;
  $$
);