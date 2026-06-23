ALTER TABLE public.attendance_records
  ADD COLUMN IF NOT EXISTS client_timestamp timestamptz,
  ADD COLUMN IF NOT EXISTS clock_skew_seconds integer;