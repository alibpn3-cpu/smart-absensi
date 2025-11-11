-- Convert check_in_time and check_out_time columns to text type
-- This prevents timezone conversion and stores exact time as shown in application

-- First, create new text columns
ALTER TABLE public.attendance_records 
ADD COLUMN check_in_time_text text,
ADD COLUMN check_out_time_text text;

-- Copy existing data with timezone formatting
UPDATE public.attendance_records 
SET check_in_time_text = to_char(check_in_time AT TIME ZONE 'UTC', 'DD Mon YYYY HH24:MI:SS')
WHERE check_in_time IS NOT NULL;

UPDATE public.attendance_records 
SET check_out_time_text = to_char(check_out_time AT TIME ZONE 'UTC', 'DD Mon YYYY HH24:MI:SS')
WHERE check_out_time IS NOT NULL;

-- Drop old timestamp columns
ALTER TABLE public.attendance_records 
DROP COLUMN check_in_time,
DROP COLUMN check_out_time;

-- Rename new text columns to original names
ALTER TABLE public.attendance_records 
RENAME COLUMN check_in_time_text TO check_in_time;

ALTER TABLE public.attendance_records 
RENAME COLUMN check_out_time_text TO check_out_time;