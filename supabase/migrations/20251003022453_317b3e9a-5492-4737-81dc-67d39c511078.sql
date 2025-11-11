-- Sync created_at and updated_at with user-provided local timestamps in attendance_records
-- This trigger ensures created_at = check_in_time and updated_at = check_out_time (when provided)

-- Create or replace trigger function
CREATE OR REPLACE FUNCTION public.sync_attendance_timestamps()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Set created_at from check_in_time if provided and parsable
    IF NEW.check_in_time IS NOT NULL THEN
      BEGIN
        NEW.created_at := (NEW.check_in_time)::timestamptz;
      EXCEPTION WHEN others THEN
        NEW.created_at := COALESCE(NEW.created_at, now());
      END;
    END IF;

    -- If check_out_time provided during insert, sync updated_at as well
    IF NEW.check_out_time IS NOT NULL THEN
      BEGIN
        NEW.updated_at := (NEW.check_out_time)::timestamptz;
      EXCEPTION WHEN others THEN
        NEW.updated_at := COALESCE(NEW.updated_at, NEW.created_at);
      END;
    ELSE
      NEW.updated_at := COALESCE(NEW.updated_at, NEW.created_at);
    END IF;

  ELSIF TG_OP = 'UPDATE' THEN
    -- On update, if check_out_time changed/set, sync updated_at
    IF NEW.check_out_time IS NOT NULL AND (OLD.check_out_time IS DISTINCT FROM NEW.check_out_time) THEN
      BEGIN
        NEW.updated_at := (NEW.check_out_time)::timestamptz;
      EXCEPTION WHEN others THEN
        NEW.updated_at := now();
      END;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Recreate triggers to attach to attendance_records
DROP TRIGGER IF EXISTS trg_sync_attendance_timestamps_ins ON public.attendance_records;
DROP TRIGGER IF EXISTS trg_sync_attendance_timestamps_upd ON public.attendance_records;

CREATE TRIGGER trg_sync_attendance_timestamps_ins
BEFORE INSERT ON public.attendance_records
FOR EACH ROW
EXECUTE FUNCTION public.sync_attendance_timestamps();

CREATE TRIGGER trg_sync_attendance_timestamps_upd
BEFORE UPDATE ON public.attendance_records
FOR EACH ROW
EXECUTE FUNCTION public.sync_attendance_timestamps();