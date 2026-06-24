## Tujuan
Tambahkan tier baru **Site Admin** di atas user biasa tapi di bawah Staff Admin / Superadmin. Site Admin hanya melihat 3 tab: **Attendance**, **In/Out Status**, **Export** — dan semua datanya dipaksa ter-filter ke `work_area` user tersebut. Tidak ada akses ke Employees, Birthdays, Scores, Geofence, Kiosk, Ads, Analytics, Admins, Logs, Settings.

## Pressure-test singkat
- **Asumsi terlemah**: bahwa `staff_users.work_area` selalu match dengan teks pada `geofence_areas.name` / `attendance_records.checkin_location_address`. Saat ini filter location di Dashboard pakai `includes()` string — fragile. Saya akan tetap pakai pola yang sama agar konsisten, tapi tambah catatan agar Superadmin memastikan penamaan area konsisten.
- **Risiko**: Karena auth pakai localStorage (bukan Supabase auth.uid), scoping ini **UI-side only** — user yang manipulasi browser bisa bypass. Sama dengan flag `is_admin` existing. Tidak menambah kerentanan baru, tapi bukan true security boundary.
- **Yang diverifikasi**: Tidak akan menyentuh logic clock-in/out, Tidak mengubah perilaku Staff Admin atau Superadmin.

## Perubahan

### 1. Database (migration)
Tambah kolom `is_site_admin boolean default false` di `staff_users`. Tidak menyentuh `is_admin`. Aturan: jika `is_site_admin=true`, abaikan `is_admin` (Site Admin lebih rendah).

### 2. Dashboard.tsx
- Baca `is_site_admin` dari `userSession` (di-set saat login).
- Tambah state `siteAdminArea = userSession.work_area` saat `isSiteAdmin`.
- **Tab visibility**: jika `isSiteAdmin`, hanya render tab `attendance`, `notcheckedin`, `export`. Tab lain (termasuk Birthdays, Employees, Scores, Geofence, Kiosk, Ads, Analytics) tidak dirender. Superadmin/Staff Admin tetap seperti sekarang.
- **Query scoping**: Saat `isSiteAdmin`, semua `supabase.from('attendance_records').select()` dan `staff_users` di-filter `.eq('work_area', siteAdminArea)`. Filter location di UI di-lock ke area tersebut (dropdown hanya 1 pilihan, disabled).
- Summary card (Total Staff, Hadir, WFO/WFH/Dinas) dihitung ulang berdasarkan staff di area itu saja.

### 3. UserLogin.tsx
Saat sukses login, sertakan `is_site_admin` & `work_area` di `userSession` payload localStorage (saat ini sudah simpan `is_admin`).

### 4. Employees tab (Superadmin only)
Tambah toggle/switch "Site Admin" di form edit employee. Validasi: jika dicentang, `work_area` wajib terisi. Tidak boleh sekaligus `is_admin=true` & `is_site_admin=true` — jika user toggle Site Admin saat is_admin true, set is_admin=false otomatis (atau tampilkan warning).

### 5. Export (AttendanceExporter.tsx)
- Terima prop `forcedWorkArea?: string`.
- Saat prop terisi: filter area di UI hilang/disabled, query di-paksa `.eq('work_area', forcedWorkArea)` (atau filter address `includes` sesuai pola existing), dan join `staff_users` di-scope.
- Dipanggil dengan `forcedWorkArea={siteAdminArea}` saat `isSiteAdmin`.

### 6. In/Out Status (komponen `notcheckedin`)
Cari komponen yang render tab ini, terima prop `scopeWorkArea` dan filter list staff serta status.

### 7. SubAdminGuard (no change)
Halaman `/reports` tetap untuk Sub-Admin existing (`show_attendance_status`). Tidak terkait fitur ini.

## Catatan teknis
- Tidak ada perubahan RLS karena project pakai plaintext custom auth (sudah pola existing).
- Backward compatible: user existing dengan `is_admin=true` tidak terpengaruh.
- Site Admin tidak bisa lihat data area lain — termasuk Total Staff card di-recompute.
- Tidak menambah halaman/route baru; semua tetap di `/dashboard`.

## Pertanyaan terbuka untuk konfirmasi setelah implementasi
- Apakah Site Admin boleh export PDF/Excel keduanya? (Asumsi: ya, sama seperti Staff Admin.)
- Apakah Site Admin boleh lihat foto absensi staff areanya? (Asumsi: ya.)
