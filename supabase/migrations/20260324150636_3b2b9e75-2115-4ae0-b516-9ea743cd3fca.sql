CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

SELECT cron.schedule(
  'remind-clock-out-daily',
  '0 15 * * *',
  $$
  SELECT net.http_post(
    url := 'https://spqakoyhyziuxfgdkgpm.supabase.co/functions/v1/remind-clock-out',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNwcWFrb3loeXppdXhmZ2RrZ3BtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTcwMTE2MzAsImV4cCI6MjA3MjU4NzYzMH0.sLfUaH_DgoRcZzONOA-30RstLdIS-UMM24E3GkUHFyY"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);