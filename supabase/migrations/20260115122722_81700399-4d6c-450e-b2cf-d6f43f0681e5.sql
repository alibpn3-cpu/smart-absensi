-- Add tolerance_meters column to geofence_areas table
ALTER TABLE public.geofence_areas 
ADD COLUMN tolerance_meters INTEGER NOT NULL DEFAULT 20;

-- Update Branch Office Balikpapan with higher tolerance (user was ~87m from edge)
UPDATE public.geofence_areas 
SET tolerance_meters = 100 
WHERE name ILIKE '%balikpapan%';

-- Add comment for documentation
COMMENT ON COLUMN public.geofence_areas.tolerance_meters IS 'Maximum GPS tolerance in meters for this geofence. Higher values are more lenient.';