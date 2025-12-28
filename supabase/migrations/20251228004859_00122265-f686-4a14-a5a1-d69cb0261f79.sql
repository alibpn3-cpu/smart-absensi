-- Add photo URL columns to p2h_toolbox_checklist for storing evidence photos
ALTER TABLE public.p2h_toolbox_checklist 
ADD COLUMN IF NOT EXISTS p2h_photo_url text,
ADD COLUMN IF NOT EXISTS toolbox_photo_url text;

-- Create storage bucket for P2H/Toolbox photos if not exists
INSERT INTO storage.buckets (id, name, public)
VALUES ('p2h-photos', 'p2h-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Create policies for p2h-photos bucket
CREATE POLICY "Public can view p2h photos" ON storage.objects
FOR SELECT USING (bucket_id = 'p2h-photos');

CREATE POLICY "Users can upload p2h photos" ON storage.objects
FOR INSERT WITH CHECK (bucket_id = 'p2h-photos');

CREATE POLICY "Users can update p2h photos" ON storage.objects
FOR UPDATE USING (bucket_id = 'p2h-photos');

CREATE POLICY "Users can delete p2h photos" ON storage.objects
FOR DELETE USING (bucket_id = 'p2h-photos');