-- Create admin accounts table
CREATE TABLE public.admin_accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create geofence areas table
CREATE TABLE public.geofence_areas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  coordinates JSONB NOT NULL, -- Store polygon coordinates
  radius INTEGER, -- Radius in meters for circular geofence
  center_lat DECIMAL(10,8),
  center_lng DECIMAL(11,8),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create staff users table
CREATE TABLE public.staff_users (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  uid TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  position TEXT NOT NULL,
  work_area TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create attendance records table
CREATE TABLE public.attendance_records (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  staff_uid TEXT NOT NULL,
  staff_name TEXT NOT NULL,
  check_in_time TIMESTAMP WITH TIME ZONE,
  check_out_time TIMESTAMP WITH TIME ZONE,
  location_lat DECIMAL(10,8),
  location_lng DECIMAL(11,8),
  location_address TEXT,
  selfie_photo_url TEXT,
  status TEXT NOT NULL CHECK (status IN ('wfo', 'wfh', 'dinas')),
  reason TEXT,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  FOREIGN KEY (staff_uid) REFERENCES public.staff_users(uid)
);

-- Enable Row Level Security
ALTER TABLE public.admin_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.geofence_areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;

-- Create policies for public access (since this is an attendance system)
CREATE POLICY "Allow all access to admin_accounts" ON public.admin_accounts FOR ALL USING (true);
CREATE POLICY "Allow all access to geofence_areas" ON public.geofence_areas FOR ALL USING (true);
CREATE POLICY "Allow all access to staff_users" ON public.staff_users FOR ALL USING (true);
CREATE POLICY "Allow all access to attendance_records" ON public.attendance_records FOR ALL USING (true);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_geofence_areas_updated_at
  BEFORE UPDATE ON public.geofence_areas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_staff_users_updated_at
  BEFORE UPDATE ON public.staff_users
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_attendance_records_updated_at
  BEFORE UPDATE ON public.attendance_records
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Insert sample data
INSERT INTO public.admin_accounts (username, password_hash) VALUES
('admin', '$2a$10$K9Z5oU7pQu8B6f1H3L9k1eF5M.N7R8T9V0W1X2Y3Z4A5B6C7D8E9F0'); -- password: admin123

INSERT INTO public.staff_users (uid, name, position, work_area) VALUES
('EMP001', 'John Doe', 'Software Developer', 'IT Department'),
('EMP002', 'Jane Smith', 'Marketing Manager', 'Marketing Department'),
('EMP003', 'Ahmad Rahman', 'Sales Executive', 'Sales Department');

INSERT INTO public.geofence_areas (name, center_lat, center_lng, radius) VALUES
('Head Office', -6.2088, 106.8456, 100),
('Branch Office Jakarta', -6.1944, 106.8229, 50);