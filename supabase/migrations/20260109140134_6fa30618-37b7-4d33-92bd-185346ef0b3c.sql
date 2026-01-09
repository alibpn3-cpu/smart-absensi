-- Drop existing foreign key constraint
ALTER TABLE attendance_records 
DROP CONSTRAINT IF EXISTS attendance_records_staff_uid_fkey;

-- Recreate with CASCADE ON UPDATE
ALTER TABLE attendance_records 
ADD CONSTRAINT attendance_records_staff_uid_fkey 
FOREIGN KEY (staff_uid) 
REFERENCES staff_users(uid) 
ON UPDATE CASCADE;

-- Create function to update staff UID across all related tables
CREATE OR REPLACE FUNCTION public.update_staff_uid(
  old_uid TEXT,
  new_uid TEXT
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Validate new UID is not already in use
  IF EXISTS (SELECT 1 FROM staff_users WHERE uid = new_uid) THEN
    RAISE EXCEPTION 'UID baru sudah digunakan oleh karyawan lain';
  END IF;
  
  -- Validate old UID exists
  IF NOT EXISTS (SELECT 1 FROM staff_users WHERE uid = old_uid) THEN
    RAISE EXCEPTION 'UID lama tidak ditemukan';
  END IF;

  -- Update staff_users (CASCADE will automatically update attendance_records)
  UPDATE staff_users SET uid = new_uid, updated_at = now() WHERE uid = old_uid;
  
  -- Update other tables that don't have FK constraints
  UPDATE daily_scores SET staff_uid = new_uid WHERE staff_uid = old_uid;
  UPDATE p2h_toolbox_checklist SET staff_uid = new_uid WHERE staff_uid = old_uid;
  UPDATE monthly_ranking_overrides SET staff_uid = new_uid WHERE staff_uid = old_uid;
  UPDATE debug_logs SET staff_uid = new_uid WHERE staff_uid = old_uid;
  
  RETURN TRUE;
END;
$$;