-- =====================================================
-- FASE 1: Database Foundation & Feature Flags
-- =====================================================

-- 1. Add employee_type to staff_users
ALTER TABLE public.staff_users 
ADD COLUMN IF NOT EXISTS employee_type text DEFAULT 'staff';

-- 2. Create daily_scores table
CREATE TABLE IF NOT EXISTS public.daily_scores (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  staff_uid text NOT NULL,
  staff_name text NOT NULL,
  score_date date NOT NULL DEFAULT CURRENT_DATE,
  
  -- Score components
  clock_in_score integer NOT NULL DEFAULT 0,
  clock_out_score integer NOT NULL DEFAULT 0,
  p2h_score integer NOT NULL DEFAULT 0,
  toolbox_score integer NOT NULL DEFAULT 0,
  final_score numeric(3,1) NOT NULL DEFAULT 0,
  
  -- Metadata
  check_in_time text,
  check_out_time text,
  is_late boolean DEFAULT false,
  employee_type text DEFAULT 'staff',
  work_area text,
  calculation_method text DEFAULT 'manual',
  
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  
  -- Prevent duplicate scores per user per day
  UNIQUE(staff_uid, score_date)
);

-- 3. Create p2h_toolbox_checklist table
CREATE TABLE IF NOT EXISTS public.p2h_toolbox_checklist (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  staff_uid text NOT NULL,
  staff_name text NOT NULL,
  checklist_date date NOT NULL DEFAULT CURRENT_DATE,
  
  p2h_checked boolean DEFAULT false,
  toolbox_checked boolean DEFAULT false,
  
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  
  -- One checklist per user per day
  UNIQUE(staff_uid, checklist_date)
);

-- 4. Insert feature flags into app_settings
INSERT INTO public.app_settings (setting_key, setting_value, description) VALUES 
  ('score_feature_enabled', 'false', 'Enable star score feature for attendance'),
  ('login_required', 'false', 'Require user login instead of staff dropdown selection'),
  ('beta_mode_enabled', 'false', 'Enable beta mode for developer testing on specific devices')
ON CONFLICT (setting_key) DO NOTHING;

-- 5. Enable RLS on new tables
ALTER TABLE public.daily_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.p2h_toolbox_checklist ENABLE ROW LEVEL SECURITY;

-- 6. RLS Policies for daily_scores
CREATE POLICY "Users can view their own scores" 
ON public.daily_scores 
FOR SELECT 
USING (true);

CREATE POLICY "Users can insert their own scores" 
ON public.daily_scores 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Users can update their own scores" 
ON public.daily_scores 
FOR UPDATE 
USING (true);

CREATE POLICY "Allow service role access to daily_scores" 
ON public.daily_scores 
FOR ALL 
USING (true);

-- 7. RLS Policies for p2h_toolbox_checklist
CREATE POLICY "Users can view their own checklist" 
ON public.p2h_toolbox_checklist 
FOR SELECT 
USING (true);

CREATE POLICY "Users can insert their own checklist" 
ON public.p2h_toolbox_checklist 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Users can update their own checklist" 
ON public.p2h_toolbox_checklist 
FOR UPDATE 
USING (true);

CREATE POLICY "Allow service role access to p2h_toolbox_checklist" 
ON public.p2h_toolbox_checklist 
FOR ALL 
USING (true);

-- 8. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_daily_scores_staff_date ON public.daily_scores(staff_uid, score_date);
CREATE INDEX IF NOT EXISTS idx_daily_scores_date ON public.daily_scores(score_date);
CREATE INDEX IF NOT EXISTS idx_p2h_checklist_staff_date ON public.p2h_toolbox_checklist(staff_uid, checklist_date);

-- 9. Trigger for updated_at on daily_scores
CREATE TRIGGER update_daily_scores_updated_at
BEFORE UPDATE ON public.daily_scores
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- 10. Trigger for updated_at on p2h_toolbox_checklist
CREATE TRIGGER update_p2h_checklist_updated_at
BEFORE UPDATE ON public.p2h_toolbox_checklist
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();