-- Add checkout_status column for storing clock-out status (can differ from clock-in status)
ALTER TABLE public.attendance_records 
ADD COLUMN IF NOT EXISTS checkout_status text;

-- Comment: status = status at clock-in (wfo/wfh/dinas), checkout_status = status at clock-out (wfo/wfh/dinas)