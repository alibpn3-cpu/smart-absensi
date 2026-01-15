-- Add separate reason columns for different attendance actions
ALTER TABLE attendance_records 
ADD COLUMN IF NOT EXISTS checkin_reason text,
ADD COLUMN IF NOT EXISTS checkout_reason text,
ADD COLUMN IF NOT EXISTS extend_reason text;

-- Migrate existing reason data to checkin_reason for records that only have check_in
UPDATE attendance_records 
SET checkin_reason = reason 
WHERE reason IS NOT NULL 
  AND check_out_time IS NULL 
  AND checkin_reason IS NULL;

-- Migrate existing reason data to checkout_reason for records that have check_out
UPDATE attendance_records 
SET checkout_reason = reason 
WHERE reason IS NOT NULL 
  AND check_out_time IS NOT NULL 
  AND checkout_reason IS NULL;

-- Add comment for documentation
COMMENT ON COLUMN attendance_records.checkin_reason IS 'Reason provided during clock in';
COMMENT ON COLUMN attendance_records.checkout_reason IS 'Reason provided during clock out';
COMMENT ON COLUMN attendance_records.extend_reason IS 'Reason provided for extend in/out';