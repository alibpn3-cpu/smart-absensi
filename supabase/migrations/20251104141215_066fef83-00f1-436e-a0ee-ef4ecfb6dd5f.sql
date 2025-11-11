-- Add checkout location fields to attendance_records
ALTER TABLE public.attendance_records 
ADD COLUMN IF NOT EXISTS checkout_location_address text,
ADD COLUMN IF NOT EXISTS checkout_location_lat numeric,
ADD COLUMN IF NOT EXISTS checkout_location_lng numeric;

-- Rename existing location fields to be more specific for check-in
ALTER TABLE public.attendance_records 
RENAME COLUMN location_address TO checkin_location_address;

ALTER TABLE public.attendance_records 
RENAME COLUMN location_lat TO checkin_location_lat;

ALTER TABLE public.attendance_records 
RENAME COLUMN location_lng TO checkin_location_lng;

-- Create ad_images table for popup advertisements
CREATE TABLE IF NOT EXISTS public.ad_images (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  image_url text NOT NULL,
  display_order integer NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT ad_images_display_order_check CHECK (display_order >= 1 AND display_order <= 5)
);

-- Enable RLS for ad_images
ALTER TABLE public.ad_images ENABLE ROW LEVEL SECURITY;

-- Create policies for ad_images
CREATE POLICY "Anyone can view active ads"
ON public.ad_images
FOR SELECT
USING (is_active = true);

CREATE POLICY "Allow service role access to ad_images"
ON public.ad_images
FOR ALL
USING (true);

-- Create trigger for updated_at
CREATE TRIGGER update_ad_images_updated_at
BEFORE UPDATE ON public.ad_images
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_ad_images_active_order 
ON public.ad_images (is_active, display_order) 
WHERE is_active = true;