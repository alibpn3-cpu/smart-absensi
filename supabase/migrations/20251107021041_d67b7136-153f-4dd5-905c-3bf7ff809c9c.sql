-- Fix search_path for security function
-- This addresses the function search path mutable warning
DROP FUNCTION IF EXISTS public.sync_attendance_timestamps() CASCADE;

CREATE OR REPLACE FUNCTION public.sync_attendance_timestamps()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
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
$function$;

-- Recreate the trigger
DROP TRIGGER IF EXISTS sync_attendance_timestamps_trigger ON public.attendance_records;
CREATE TRIGGER sync_attendance_timestamps_trigger
BEFORE INSERT OR UPDATE ON public.attendance_records
FOR EACH ROW
EXECUTE FUNCTION public.sync_attendance_timestamps();