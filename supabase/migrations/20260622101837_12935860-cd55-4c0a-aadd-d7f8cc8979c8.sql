ALTER TABLE public.attendance_records
  ADD COLUMN IF NOT EXISTS client_ip text,
  ADD COLUMN IF NOT EXISTS user_agent text,
  ADD COLUMN IF NOT EXISTS device_id text,
  ADD COLUMN IF NOT EXISTS device_label text,
  ADD COLUMN IF NOT EXISTS device_flag text;

CREATE INDEX IF NOT EXISTS idx_attendance_records_staff_device
  ON public.attendance_records (staff_uid, device_id);

CREATE INDEX IF NOT EXISTS idx_attendance_records_device_id
  ON public.attendance_records (device_id);
