-- Drop existing policies if they exist and recreate them properly
DROP POLICY IF EXISTS "Allow insert birthdays" ON public.birthdays;
DROP POLICY IF EXISTS "Allow update birthdays" ON public.birthdays;
DROP POLICY IF EXISTS "Allow delete birthdays" ON public.birthdays;

-- Create proper policies for birthdays table
-- Allow public INSERT access (admin dashboard managed)
CREATE POLICY "Allow insert birthdays"
ON public.birthdays
FOR INSERT
WITH CHECK (true);

-- Allow public UPDATE access
CREATE POLICY "Allow update birthdays"
ON public.birthdays
FOR UPDATE
USING (true);

-- Allow public DELETE access  
CREATE POLICY "Allow delete birthdays"
ON public.birthdays
FOR DELETE
USING (true);