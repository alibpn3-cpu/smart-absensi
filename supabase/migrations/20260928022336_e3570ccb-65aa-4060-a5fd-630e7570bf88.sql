CREATE TABLE public.attendance_correction_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_uid text NOT NULL,
  staff_name text NOT NULL,
  work_area text,
  division text,
  request_date date NOT NULL,
  request_kind text NOT NULL DEFAULT 'correction',
  attendance_record_id uuid,
  original_check_in text,
  original_check_out text,
  requested_check_in text,
  requested_check_out text,
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  reviewer_uid text,
  reviewer_name text,
  reviewer_comment text,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.attendance_correction_requests TO anon, authenticated;
GRANT ALL ON public.attendance_correction_requests TO service_role;
ALTER TABLE public.attendance_correction_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow app access to correction requests" ON public.attendance_correction_requests FOR ALL USING (true) WITH CHECK (true);
CREATE INDEX idx_acr_staff ON public.attendance_correction_requests(staff_uid, request_date);
CREATE INDEX idx_acr_status_area ON public.attendance_correction_requests(status, work_area);
CREATE UNIQUE INDEX uq_acr_pending ON public.attendance_correction_requests(staff_uid, request_date) WHERE status = 'pending';
CREATE TRIGGER update_acr_updated_at BEFORE UPDATE ON public.attendance_correction_requests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();