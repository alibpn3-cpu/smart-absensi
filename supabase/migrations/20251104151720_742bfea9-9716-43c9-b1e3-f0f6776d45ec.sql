-- Add separate selfie photo columns for check-in and check-out
ALTER TABLE public.attendance_records
  ADD COLUMN IF NOT EXISTS selfie_checkin_url text,
  ADD COLUMN IF NOT EXISTS selfie_checkout_url text;

-- Optional: backfill existing data is not performed here (data update not part of migrations per project guidelines)
