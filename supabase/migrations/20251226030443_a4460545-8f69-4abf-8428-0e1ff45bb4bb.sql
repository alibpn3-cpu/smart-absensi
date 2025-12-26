-- Create table for manual ranking overrides
CREATE TABLE public.monthly_ranking_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  year INTEGER NOT NULL,
  month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
  tier TEXT NOT NULL CHECK (tier IN ('platinum', 'gold', 'silver', 'bronze')),
  staff_uid TEXT NOT NULL,
  staff_name TEXT NOT NULL,
  photo_url TEXT,
  display_score NUMERIC(2,1) DEFAULT 5.0,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(year, month, tier, staff_uid)
);

-- Enable RLS
ALTER TABLE public.monthly_ranking_overrides ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Anyone can view ranking overrides"
ON public.monthly_ranking_overrides
FOR SELECT
USING (true);

CREATE POLICY "Allow service role access to monthly_ranking_overrides"
ON public.monthly_ranking_overrides
FOR ALL
USING (true);

-- Create trigger for updated_at
CREATE TRIGGER update_monthly_ranking_overrides_updated_at
BEFORE UPDATE ON public.monthly_ranking_overrides
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for faster lookups
CREATE INDEX idx_monthly_ranking_overrides_year_month ON public.monthly_ranking_overrides(year, month);