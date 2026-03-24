

# Phase 1: Fix Status In/Out + Database Setup + Admin Assignment

## Ringkasan

Phase 1 mencakup 3 hal:
1. Fix bug Status In/Out yang tidak muncul
2. Setup database tables untuk sistem cuti & ijin request
3. Admin UI untuk assign atasan dan HC&GA Site per user + tambah kolom phone/WhatsApp dan tanggal mulai kerja

---

## 1. Fix Status In/Out Bug

### Analisis

`AttendanceStatusList` memiliki guard di baris 28: `if (!selectedWorkArea || selectedWorkArea === 'all') return;` — jika user login tapi `work_area` adalah 'all' atau kosong, komponen tidak render data. Juga, `StaffUser` interface di `EmployeeManager.tsx` tidak include `show_attendance_status`, sehingga menggunakan `as any` cast.

### Perbaikan
- **AttendanceStatusList**: Jika `selectedWorkArea` kosong, fallback ke work_area dari userSession
- **EmployeeManager StaffUser interface**: Tambah `show_attendance_status?: boolean` agar tidak perlu `as any`
- Pastikan toggle benar-benar update database dan re-fetch data session

---

## 2. Database Migration

### Kolom baru di `staff_users`:
```sql
ALTER TABLE staff_users ADD COLUMN phone_number TEXT;
ALTER TABLE staff_users ADD COLUMN supervisor_uid TEXT;       -- atasan langsung
ALTER TABLE staff_users ADD COLUMN hcga_approver_uid TEXT;    -- HC&GA Site approver
ALTER TABLE staff_users ADD COLUMN join_date DATE;            -- tanggal mulai kerja
```

### Tabel baru: `leave_balances`
```sql
CREATE TABLE leave_balances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_uid TEXT NOT NULL,
  year INTEGER NOT NULL,
  total_days INTEGER NOT NULL DEFAULT 12,
  used_days INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(staff_uid, year)
);
```

### Tabel baru: `leave_requests` (cuti)
```sql
CREATE TABLE leave_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_number TEXT NOT NULL UNIQUE,
  staff_uid TEXT NOT NULL,
  staff_name TEXT NOT NULL,
  department TEXT,
  position TEXT,
  join_date DATE,
  leave_year INTEGER NOT NULL,        -- tahun balance yang dipakai
  days_requested INTEGER NOT NULL,
  leave_dates JSONB NOT NULL,         -- array tanggal cuti
  remaining_balance INTEGER,
  previous_year_balance INTEGER,
  supervisor_uid TEXT,
  hcga_approver_uid TEXT,
  supervisor_status TEXT DEFAULT 'pending',   -- pending/approved/rejected
  hcga_status TEXT DEFAULT 'pending',
  supervisor_notes TEXT,
  hcga_notes TEXT,
  supervisor_recommendation TEXT,
  other_decisions TEXT,
  supervisor_approved_at TIMESTAMPTZ,
  hcga_approved_at TIMESTAMPTZ,
  status TEXT DEFAULT 'pending',       -- pending/approved/rejected
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### Tabel baru: `permission_requests` (ijin)
```sql
CREATE TABLE permission_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_number TEXT NOT NULL UNIQUE,
  staff_uid TEXT NOT NULL,
  staff_name TEXT NOT NULL,
  department TEXT,
  position TEXT,
  join_date DATE,
  permission_duration TEXT NOT NULL,   -- "2 jam" atau "1 hari"
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
```

### Feature flag baru di `app_settings`:
- `leave_request_enabled` (default false)
- `permission_request_enabled` (default false)

### RLS Policies:
- Public SELECT/INSERT/UPDATE pada semua tabel baru (sesuai pola existing)

---

## 3. Admin UI: Assign Atasan & HC&GA Site

### Perubahan di `EmployeeManager.tsx`:

**A. Update StaffUser interface:**
```typescript
interface StaffUser {
  // existing fields...
  show_attendance_status?: boolean;
  phone_number?: string;
  supervisor_uid?: string;
  hcga_approver_uid?: string;
  join_date?: string;
}
```

**B. Form tambah/edit employee:**
- Tambah field: `phone_number`, `join_date`
- Tambah dropdown: Atasan (pilih dari list staff), HC&GA Site Approver (pilih dari list staff)

**C. Batch assign atasan & HC&GA:**
- Di batch update dialog, tambah opsi assign `supervisor_uid` dan `hcga_approver_uid`
- Filter berdasarkan department/division untuk memudahkan batch assign
- Dropdown memilih user sebagai atasan/HC&GA

**D. Toggle feature flag di FeatureFlagSettings:**
- Tambah toggle "Fitur Cuti Request" dan "Fitur Ijin Request"

---

## 4. Update UserLogin & Session

- Tambah `phone_number`, `supervisor_uid`, `hcga_approver_uid`, `join_date` ke query login dan `UserSession` interface
- Data tersimpan di localStorage session untuk dipakai di form cuti/ijin nanti

---

## File yang Diubah

| File | Perubahan |
|------|-----------|
| Migration SQL | Tambah kolom staff_users + tabel baru |
| `src/components/AttendanceStatusList.tsx` | Fix guard condition |
| `src/components/EmployeeManager.tsx` | Update interface, form fields, batch assign |
| `src/components/FeatureFlagSettings.tsx` | Tambah toggle cuti & ijin |
| `src/pages/UserLogin.tsx` | Update query & session |
| `src/integrations/supabase/types.ts` | Auto-updated |

---

## Phase Berikutnya (Preview)

- **Phase 2**: UI form cuti & ijin request + list permintaan user + approval list atasan/HC&GA + progress line
- **Phase 3**: Edge functions (SMTP email + Fonnte WhatsApp) + PDF export dengan stamp approved

