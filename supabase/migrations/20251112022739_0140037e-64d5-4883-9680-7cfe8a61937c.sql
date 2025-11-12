-- Add attendance_type column (regular or overtime)
ALTER TABLE attendance_records 
ADD COLUMN IF NOT EXISTS attendance_type TEXT DEFAULT 'regular' 
CHECK (attendance_type IN ('regular', 'overtime'));

-- Add hours_worked column for tracking work duration
ALTER TABLE attendance_records 
ADD COLUMN IF NOT EXISTS hours_worked NUMERIC;

-- Update unique constraint to allow 1 regular + 1 overtime per day per staff
ALTER TABLE attendance_records 
DROP CONSTRAINT IF EXISTS attendance_records_staff_uid_date_key;

ALTER TABLE attendance_records 
ADD CONSTRAINT attendance_records_staff_uid_date_type_key 
UNIQUE (staff_uid, date, attendance_type);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_attendance_type ON attendance_records(attendance_type);