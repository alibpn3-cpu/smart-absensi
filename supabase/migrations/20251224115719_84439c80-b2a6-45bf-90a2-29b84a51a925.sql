-- Hapus cron job lama yang menggunakan UTC 23:59
SELECT cron.unschedule('calculate-daily-scores-2359');

-- Buat cron job baru dengan WIB timezone (23:59 WIB = 16:59 UTC)
SELECT cron.schedule(
  'calculate-daily-scores-2359-wib',
  '59 16 * * *',
  $$
  SELECT net.http_post(
    url := 'https://spqakoyhyziuxfgdkgpm.supabase.co/functions/v1/calculate-daily-scores',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNwcWFrb3loeXppdXhmZ2RrZ3BtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTcwMTE2MzAsImV4cCI6MjA3MjU4NzYzMH0.sLfUaH_DgoRcZzONOA-30RstLdIS-UMM24E3GkUHFyY"}'::jsonb,
    body := '{"trigger": "cron", "timezone": "WIB"}'::jsonb
  ) AS request_id;
  $$
);