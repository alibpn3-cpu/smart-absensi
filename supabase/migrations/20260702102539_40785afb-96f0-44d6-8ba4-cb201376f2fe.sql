
ALTER TABLE public.staff_users
  ADD COLUMN IF NOT EXISTS shift_type TEXT NOT NULL DEFAULT 'regular';

ALTER TABLE public.attendance_records
  ADD COLUMN IF NOT EXISTS shift_type TEXT;

COMMENT ON COLUMN public.staff_users.shift_type IS 'regular | shift_morning | shift_afternoon | shift_night. Night shift crosses midnight; date column stores logical work date.';
COMMENT ON COLUMN public.attendance_records.shift_type IS 'Snapshot of shift_type at clock-in time.';
