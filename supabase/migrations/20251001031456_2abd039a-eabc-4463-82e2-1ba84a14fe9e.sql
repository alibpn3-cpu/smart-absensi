-- Add photo_url column to staff_users table
ALTER TABLE public.staff_users 
ADD COLUMN photo_url text;

-- Create storage bucket for staff photos if not exists
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'staff-photos',
  'staff-photos',
  true,
  524288,  -- 512KB limit
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Create storage policies for staff photos
CREATE POLICY "Staff photos are publicly accessible"
ON storage.objects
FOR SELECT
USING (bucket_id = 'staff-photos');

CREATE POLICY "Authenticated users can upload staff photos"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'staff-photos' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update staff photos"
ON storage.objects
FOR UPDATE
USING (bucket_id = 'staff-photos' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete staff photos"
ON storage.objects
FOR DELETE
USING (bucket_id = 'staff-photos' AND auth.role() = 'authenticated');