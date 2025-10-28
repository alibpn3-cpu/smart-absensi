-- Create birthdays table
CREATE TABLE public.birthdays (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nama text NOT NULL,
  tanggal text NOT NULL,
  lokasi text,
  level text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.birthdays ENABLE ROW LEVEL SECURITY;

-- Allow service role full access
CREATE POLICY "Allow service role access to birthdays" 
ON public.birthdays 
FOR ALL 
TO service_role
USING (true);

-- Allow public to read birthdays for display
CREATE POLICY "Anyone can view birthdays" 
ON public.birthdays 
FOR SELECT 
USING (true);