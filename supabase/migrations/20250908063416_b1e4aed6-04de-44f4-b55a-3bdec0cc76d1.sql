-- Add app_title setting to allow configurable application title
INSERT INTO public.app_settings (setting_key, setting_value, description) 
VALUES ('app_title', 'Smart Zone Absensi', 'Application title displayed on main page and forms')
ON CONFLICT (setting_key) DO UPDATE SET 
setting_value = EXCLUDED.setting_value,
description = EXCLUDED.description;