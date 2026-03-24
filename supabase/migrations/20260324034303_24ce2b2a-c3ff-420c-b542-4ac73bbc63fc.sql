
-- Add new columns to staff_users
ALTER TABLE staff_users ADD COLUMN IF NOT EXISTS phone_number TEXT;
ALTER TABLE staff_users ADD COLUMN IF NOT EXISTS supervisor_uid TEXT;
ALTER TABLE staff_users ADD COLUMN IF NOT EXISTS hcga_approver_uid TEXT;
ALTER TABLE staff_users ADD COLUMN IF NOT EXISTS join_date DATE;

-- Create leave_balances table
CREATE TABLE IF NOT EXISTS leave_balances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_uid TEXT NOT NULL,
  year INTEGER NOT NULL,
  total_days INTEGER NOT NULL DEFAULT 12,
  used_days INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(staff_uid, year)
);

ALTER TABLE leave_balances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public access to leave_balances" ON leave_balances FOR ALL TO public USING (true) WITH CHECK (true);

-- Create leave_requests table
CREATE TABLE IF NOT EXISTS leave_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_number TEXT NOT NULL UNIQUE,
  staff_uid TEXT NOT NULL,
  staff_name TEXT NOT NULL,
  department TEXT,
  position TEXT,
  join_date DATE,
  leave_year INTEGER NOT NULL,
  days_requested INTEGER NOT NULL,
  leave_dates JSONB NOT NULL,
  remaining_balance INTEGER,
  previous_year_balance INTEGER,
  supervisor_uid TEXT,
  hcga_approver_uid TEXT,
  supervisor_status TEXT DEFAULT 'pending',
  hcga_status TEXT DEFAULT 'pending',
  supervisor_notes TEXT,
  hcga_notes TEXT,
  supervisor_recommendation TEXT,
  other_decisions TEXT,
  supervisor_approved_at TIMESTAMPTZ,
  hcga_approved_at TIMESTAMPTZ,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE leave_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public access to leave_requests" ON leave_requests FOR ALL TO public USING (true) WITH CHECK (true);

-- Create permission_requests table
CREATE TABLE IF NOT EXISTS permission_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_number TEXT NOT NULL UNIQUE,
  staff_uid TEXT NOT NULL,
  staff_name TEXT NOT NULL,
  department TEXT,
  position TEXT,
  join_date DATE,
  permission_duration TEXT NOT NULL,
  permission_date DATE NOT NULL,
  phone_number TEXT,
  reason TEXT NOT NULL,
  supervisor_uid TEXT,
  hcga_approver_uid TEXT,
  supervisor_status TEXT DEFAULT 'pending',
  hcga_status TEXT DEFAULT 'pending',
  supervisor_notes TEXT,
  hcga_notes TEXT,
  supervisor_approved_at TIMESTAMPTZ,
  hcga_approved_at TIMESTAMPTZ,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE permission_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public access to permission_requests" ON permission_requests FOR ALL TO public USING (true) WITH CHECK (true);
