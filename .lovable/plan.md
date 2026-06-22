## Tujuan

1. **Halaman Sub-Admin `/reports`** — user dengan `show_attendance_status=true` bisa lihat & export laporan kehadiran karyawan di **work_area + division yang sama**, read-only.
2. **Anti-joki capture** — saat clock in/out, sistem menangkap `ip_address`, `user_agent`, dan `device_id` (persisten). Data tersembunyi dari user biasa, hanya tampil di **export Excel sub-admin & admin** dan **viewer admin AttendanceExporter**. Sistem otomatis menandai (flag) baris yang mencurigakan.

---

## Bagian A — Sub-Admin Reports

### A1. Halaman baru `src/pages/SubAdminReports.tsx` (route `/reports`)

- Header: nama user + chip "Sub-Admin" + scope info ("Area: X • Divisi: Y")
- Filter bar: combobox nama (auto-close, hanya nama di area+divisi yang sama, termasuk inactive), date-range / month picker, status, btn Terapkan/Reset
- Tabel kehadiran read-only:
  - Kolom: Tanggal, Nama, Status, Clock In, Clock Out, Lokasi In, Lokasi Out, Foto In, Foto Out, **IP**, **Device**, **Flag**
  - Foto = thumbnail → dialog lightbox (selfie + alamat)
  - Alamat → buka Google Maps
  - Baris ber-flag diberi border/warning subtle
  - Pagination 50/halaman
- Tombol **Export Excel** — file `Laporan_<Area>_<Divisi>_<periode>.xlsx`, include kolom anti-joki + kolom flag

### A2. Guard `src/components/SubAdminGuard.tsx`

- Cek session user → fetch `staff_users` row-nya
- `show_attendance_status !== true` → redirect `/dashboard` + toast
- Tidak login → redirect `/login`

### A3. Entry point

- Banner conditional di `/dashboard` (hanya kalau user sub-admin) → klik ke `/reports`
- Tidak menyentuh menu/route admin lain

### A4. Logika query

1. Ambil `work_area` + `division` user login
2. Fetch `staff_users` filter area+divisi (semua, termasuk inactive)
3. Fetch `attendance_records` pakai pagination internal + tiebreaker `id` (cegah miss data)
4. Filter status/staff_uid di-server, sisanya client-side bila kecil

---

## Bagian B — Anti-Joki Capture

### B1. Skema database (migration)

Tambah kolom **nullable** ke `attendance_records` (additive, tidak break data lama):
- `client_ip text`
- `user_agent text`
- `device_id text`
- `device_label text` — hasil parse UA jadi "Samsung A53 • Chrome 120 • Android 14" (readable)
- `device_flag text` — null / `'new_device'` / `'device_shared_with_other_user'` / `'user_on_other_device'`

Index tambahan: `(staff_uid, device_id)` untuk lookup cepat.

### B2. Edge function baru `attendance-context` (`verify_jwt=false`)

- Method: POST, body: `{ staff_uid, action: 'check_in'|'check_out', device_id, user_agent }`
- Ambil IP dari header `x-forwarded-for` (atau `cf-connecting-ip` fallback) — **server-side, tidak bisa dipalsukan client**
- Parse `user_agent` jadi `device_label` (pakai regex sederhana inline, tidak perlu lib)
- Cek riwayat:
  - `staff_uid` belum punya `device_id` ini sebelumnya → `flag='new_device'`
  - `device_id` ini sudah pernah dipakai `staff_uid` lain dalam 30 hari → `flag='device_shared_with_other_user'`
  - `staff_uid` ini dalam 7 hari terakhir absen dengan `device_id` lain → `flag='user_on_other_device'`
  - Tidak ada anomali → `flag=null`
- Response: `{ client_ip, device_label, device_flag }`
- CORS standar; auth validation via existing `staff_uid` lookup

### B3. Client-side device_id generator `src/utils/deviceId.ts`

- Generate UUID v4 → simpan ke `localStorage['attendance_device_id']` & IndexedDB (dual-store, lebih sulit dihapus)
- Helper `getOrCreateDeviceId()` dipanggil saat init app
- Catatan tradeoff: user bisa clear storage → device_id baru → akan ter-flag `new_device` (justru bagus, audit trail)

### B4. Integrasi ke alur clock in/out

Di komponen yang melakukan submit attendance (Clock In/Out handlers):
1. Sebelum insert `attendance_records`, panggil edge `attendance-context`
2. Sertakan `client_ip`, `user_agent`, `device_id`, `device_label`, `device_flag` di payload insert
3. **Tidak menampilkan apapun ke user** — silent capture
4. Kalau edge function error → tetap lanjutkan insert tanpa kolom anti-joki (additive, jangan ganggu UX)

### B5. Tampilan di Admin & Sub-Admin

- **Sub-Admin export Excel**: tambah kolom IP, Device, Flag (dgn warna kuning utk row ber-flag)
- **Admin `AttendanceExporter.tsx`**: tambah kolom yang sama di export Excel + opsional kolom Flag di tabel viewer
- **Dashboard user biasa**: TIDAK ada perubahan visual — kolom ini tersembunyi

### B6. Privacy notice

Tambah satu baris kecil di dashboard footer (atau di dialog clock-in): _"Aktivitas clock in/out direkam (IP, perangkat) untuk audit keamanan."_ → kepatuhan PII dasar.

---

## File yang berubah

**Baru:**
- `src/pages/SubAdminReports.tsx`
- `src/components/SubAdminGuard.tsx`
- `src/utils/deviceId.ts`
- `supabase/functions/attendance-context/index.ts`
- Migration: 5 kolom + index di `attendance_records`

**Edit:**
- `src/App.tsx` — route `/reports`
- `src/pages/Dashboard.tsx` — banner sub-admin + privacy notice
- Handler clock-in & clock-out (cari `check_in_time` insert paths) — panggil edge function & simpan kolom anti-joki
- `src/components/admin/AttendanceExporter.tsx` — kolom export tambahan + viewer flag
- `supabase/config.toml` — tidak perlu (verify_jwt default ok via in-code validation)

**Tidak diubah:**
- Skema/RLS tabel lain
- Halaman admin lain
- Alur user biasa secara visual

---

## Verifikasi setelah implementasi

1. Login user `show_attendance_status=true` → `/reports` muncul, hanya data area+divisi sendiri
2. Login user biasa → `/reports` ditolak
3. Clock in → cek di DB: `client_ip`, `device_id`, `device_label` ter-isi
4. Clear localStorage → clock in lagi → `device_flag='new_device'`
5. Coba simulasi 2 user pakai device_id sama → flag `device_shared_with_other_user`
6. Export Excel sub-admin & admin → kolom anti-joki muncul, baris flag berwarna
7. UI user biasa tidak berubah, tidak ada kolom IP/device terlihat

---

## Risiko yang sudah saya akui (jangan kaget di kemudian hari)

- **Office NAT**: semua user di 1 IP → kolom IP cuma berguna utk WFH/Dinas, bukan utk pembanding antar user WFO.
- **device_id bisa di-reset**: user bisa clear storage → flag `new_device` muncul terus. Itu sengaja — bikin joki ribet & meninggalkan jejak.
- **Tidak menggantikan face recognition**: ini hanya pengganggu, bukan pencegah absolut. Joki pintar (login user A di HP teman, biarkan teman absen) tetap lolos kalau device baru itu diterima. Solusi penuh tetap butuh liveness — fitur ini hanya jembatan.
