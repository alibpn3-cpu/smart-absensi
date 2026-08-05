CREATE OR REPLACE FUNCTION public.enforce_score_no_p2h_toolbox()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  raw numeric;
BEGIN
  NEW.p2h_score := 0;
  NEW.toolbox_score := 0;
  raw := 100 + COALESCE(NEW.clock_in_score, 0) + COALESCE(NEW.clock_out_score, 0);
  IF raw < 0 THEN raw := 0; END IF;
  IF raw > 100 THEN raw := 100; END IF;
  NEW.final_score := ROUND((raw / 100) * 5, 1);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_score_no_p2h_toolbox ON public.daily_scores;
CREATE TRIGGER trg_enforce_score_no_p2h_toolbox
BEFORE INSERT OR UPDATE ON public.daily_scores
FOR EACH ROW EXECUTE FUNCTION public.enforce_score_no_p2h_toolbox();