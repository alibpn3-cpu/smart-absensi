-- Create work_area_schedules table
CREATE TABLE public.work_area_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_area TEXT NOT NULL,
  employee_type TEXT NOT NULL DEFAULT 'staff',
  clock_in_time TEXT NOT NULL DEFAULT '08:00',
  clock_out_time TEXT NOT NULL DEFAULT '17:00',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(work_area, employee_type)
);

-- Enable RLS
ALTER TABLE public.work_area_schedules ENABLE ROW LEVEL SECURITY;

-- Policy untuk service role
CREATE POLICY "Allow service role access to work_area_schedules" ON public.work_area_schedules
  FOR ALL USING (true);

-- Policy untuk read publik (agar bisa fetch dari frontend)
CREATE POLICY "Anyone can view work schedules" ON public.work_area_schedules
  FOR SELECT USING (true);

-- Trigger untuk update updated_at
CREATE TRIGGER update_work_area_schedules_updated_at
  BEFORE UPDATE ON public.work_area_schedules
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default schedules
INSERT INTO public.work_area_schedules (work_area, employee_type, clock_in_time, clock_out_time) VALUES
  ('SITE HANDIL', 'staff', '07:00', '16:00'),
  ('SITE HANDIL', 'primary', '07:00', '16:00'),
  ('SITE MUARA BADAK', 'staff', '07:00', '16:00'),
  ('SITE MUARA BADAK', 'primary', '07:00', '16:00'),
  ('SITE KM 13 BPP', 'staff', '07:00', '16:00'),
  ('SITE KM 13 BPP', 'primary', '07:00', '16:00'),
  ('HEAD OFFICE', 'staff', '08:30', '17:30'),
  ('HEAD OFFICE', 'primary', '07:00', '16:00'),
  ('SITE SANIPAH', 'staff', '08:00', '17:00'),
  ('SITE SANIPAH', 'primary', '07:00', '16:00'),
  ('SITE CIKARANG', 'staff', '08:00', '17:00'),
  ('SITE CIKARANG', 'primary', '07:00', '16:00'),
  ('SITE TANJUNG', 'staff', '08:00', '17:00'),
  ('SITE TANJUNG', 'primary', '07:00', '16:00'),
  ('BRANCH OFFICE', 'staff', '08:00', '17:00'),
  ('BRANCH OFFICE', 'primary', '07:00', '16:00'),
  ('DEFAULT', 'staff', '08:00', '17:00'),
  ('DEFAULT', 'primary', '07:00', '16:00');