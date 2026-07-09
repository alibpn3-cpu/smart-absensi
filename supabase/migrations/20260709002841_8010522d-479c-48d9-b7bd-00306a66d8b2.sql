
ALTER TABLE public.attendance_records
  ADD COLUMN IF NOT EXISTS device_id_in text,
  ADD COLUMN IF NOT EXISTS device_label_in text,
  ADD COLUMN IF NOT EXISTS device_flag_in text,
  ADD COLUMN IF NOT EXISTS client_ip_in text,
  ADD COLUMN IF NOT EXISTS clock_skew_seconds_in integer,
  ADD COLUMN IF NOT EXISTS device_id_out text,
  ADD COLUMN IF NOT EXISTS device_label_out text,
  ADD COLUMN IF NOT EXISTS device_flag_out text,
  ADD COLUMN IF NOT EXISTS client_ip_out text,
  ADD COLUMN IF NOT EXISTS clock_skew_seconds_out integer,
  ADD COLUMN IF NOT EXISTS gps_accuracy_in numeric,
  ADD COLUMN IF NOT EXISTS gps_accuracy_out numeric,
  ADD COLUMN IF NOT EXISTS gps_altitude_in numeric,
  ADD COLUMN IF NOT EXISTS gps_altitude_out numeric,
  ADD COLUMN IF NOT EXISTS gps_speed_in numeric,
  ADD COLUMN IF NOT EXISTS gps_speed_out numeric,
  ADD COLUMN IF NOT EXISTS gps_confidence_in integer,
  ADD COLUMN IF NOT EXISTS gps_confidence_out integer,
  ADD COLUMN IF NOT EXISTS time_sync_verified_at_in timestamptz,
  ADD COLUMN IF NOT EXISTS time_sync_verified_at_out timestamptz,
  ADD COLUMN IF NOT EXISTS offline_queued boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS offline_queued_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_attendance_records_device_id_in ON public.attendance_records (device_id_in) WHERE device_id_in IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_attendance_records_device_id_out ON public.attendance_records (device_id_out) WHERE device_id_out IS NOT NULL;
