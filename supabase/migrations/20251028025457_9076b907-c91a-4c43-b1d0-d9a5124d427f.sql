-- Allow INSERT operations on birthdays table for service role and public access
-- Since this is managed through admin dashboard, we allow INSERT operations

CREATE POLICY "Allow insert birthdays"
ON public.birthdays
FOR INSERT
TO public
WITH CHECK (true);

CREATE POLICY "Allow update birthdays"
ON public.birthdays
FOR UPDATE
TO public
USING (true);

CREATE POLICY "Allow delete birthdays"
ON public.birthdays
FOR DELETE
TO public
USING (true);