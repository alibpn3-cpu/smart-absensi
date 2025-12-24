-- Schedule edge function to run every day at 23:59 UTC
-- This will calculate scores for users who forgot to clock out
SELECT cron.schedule(
  'calculate-daily-scores-2359',
  '59 23 * * *',
  $$
  SELECT net.http_post(
    url := 'https://spqakoyhyziuxfgdkgpm.supabase.co/functions/v1/calculate-daily-scores',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNwcWFrb3loeXppdXhmZ2RrZ3BtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTcwMTE2MzAsImV4cCI6MjA3MjU4NzYzMH0.sLfUaH_DgoRcZzONOA-30RstLdIS-UMM24E3GkUHFyY"}'::jsonb,
    body := '{"trigger": "cron"}'::jsonb
  ) AS request_id;
  $$
);