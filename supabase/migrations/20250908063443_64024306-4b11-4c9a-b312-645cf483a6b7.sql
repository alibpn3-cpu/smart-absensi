-- Enable Row Level Security on all tables and create basic policies

-- Enable RLS on admin_accounts
ALTER TABLE public.admin_accounts ENABLE ROW LEVEL SECURITY;

-- Enable RLS on app_settings
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Enable RLS on attendance_records
ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;

-- Enable RLS on geofence_areas
ALTER TABLE public.geofence_areas ENABLE ROW LEVEL SECURITY;

-- Enable RLS on staff_users
ALTER TABLE public.staff_users ENABLE ROW LEVEL SECURITY;

-- Create policies for app_settings (admin access only via service role)
CREATE POLICY "Allow service role access to app_settings" ON public.app_settings
FOR ALL USING (true);

-- Create policies for admin_accounts (admin access only via service role)
CREATE POLICY "Allow service role access to admin_accounts" ON public.admin_accounts
FOR ALL USING (true);

-- Create policies for attendance_records (admin access only via service role)
CREATE POLICY "Allow service role access to attendance_records" ON public.attendance_records
FOR ALL USING (true);

-- Create policies for geofence_areas (admin access only via service role)
CREATE POLICY "Allow service role access to geofence_areas" ON public.geofence_areas
FOR ALL USING (true);

-- Create policies for staff_users (admin access only via service role)
CREATE POLICY "Allow service role access to staff_users" ON public.staff_users
FOR ALL USING (true);