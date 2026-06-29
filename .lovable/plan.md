
## Ringkasan 5 perubahan

### 1. Lonceng & Reminder Pagi → masuk Sidebar/Profile
**Masalah:** Lonceng di header bikin judul aplikasi sempit di mobile.

**Aksi:**
- Hapus `<NotificationBell />` dari header `src/pages/Index.tsx`.
- Tambahkan item "Notifikasi" baru di `UserSidebar` (ikon Bell + badge unread count). Klik → buka Sheet/Drawer berisi daftar notifikasi (reuse logic dari `NotificationBell.tsx` — extract list ke komponen `NotificationList`).
- Badge unread realtime via Supabase channel (sudah ada di hook).
- **Reminder pagi toggle**: tambah row baru di Profile (`UserProfile.tsx`) section "Preferensi Notifikasi":
  - Switch **"Aktifkan Push Notifikasi"** (subscribe / unsubscribe via `usePushNotifications`).
  - Switch **"Reminder Clock-In Pagi"** → simpan ke kolom baru `staff_users.morning_reminder_enabled BOOLEAN DEFAULT true`.
- Edge function `remind-clock-in` di-update: filter `morning_reminder_enabled = true` sebelum kirim push/WA.

### 2. Upload Foto User Manual
**Aksi:**
- Di `UserProfile.tsx`: tombol "Ganti Foto" di atas avatar — buka file picker, upload ke bucket `staff-photos` (sudah public) dengan path `{uid}/{timestamp}.jpg`, validasi max 2MB & image/*, update `staff_users.photo_url`, refresh `userSession` di localStorage.
- Di `EmployeeManager.tsx` (form edit): tambah input file upload foto dengan preview + tombol hapus foto. Pakai bucket dan logic yang sama.
- Tidak ubah schema (kolom `photo_url` sudah ada).

### 3. URL Link Announcement Salah Prefix
**Masalah:** Saat user input `example.com/page` tanpa `https://`, `<a href="example.com/page">` jadi relatif → browser tambahkan domain absensi (`https://absensi.petrolog.my.id/example.com/page`).

**Aksi:**
- Di `AnnouncementsCarousel.tsx`: normalisasi `link_url` → kalau tidak diawali `http://` atau `https://`, prepend `https://` saat render.
- Di `AnnouncementManager.tsx`: auto-normalisasi sebelum save (tambah `https://` jika perlu), `target="_blank" rel="noopener noreferrer"` (sudah ada di carousel).

### 4. Site Admin Bisa Disable Birthday Card di Area-nya
**Aksi:**
- Migration: tambah baris `app_settings` dengan key `birthday_disabled_areas` (value JSON array of work_area), atau buat kolom `disable_birthday_card BOOLEAN` di tabel baru `site_admin_preferences (work_area UNIQUE, ...)`. **Lebih simple:** pakai `app_settings` dengan key per area: `birthday_disabled:{work_area}` value `"true"/"false"`.
- Di `AnnouncementManager.tsx` (tab Pengumuman site admin): tambah card "Pengaturan Area" berisi Switch **"Tampilkan Birthday Card di area {workArea}"** (default ON). Simpan ke `app_settings`.
- Di `BirthdayCard.tsx`: fetch session user's `work_area`, fetch flag dari `app_settings`, jika disabled untuk area itu → return `null`.

### 5. Bug Filter Attendance Records Kosong untuk Site Admin
**Root cause:** `src/pages/Dashboard.tsx` baris 98-106 set `filterLocation` default ke `siteAdminArea` (mis. `"PHAS - BATU AMPAR"`). Baris 138-143 mencocokkan dengan `r.checkin_location_address.includes(filterLocation)` — tapi `checkin_location_address` adalah alamat reverse-geocode jalan (tidak pernah berisi string `"PHAS - BATU AMPAR"`). Hasilnya semua record terbuang → "0 dari 1 record".

**Aksi (di `Dashboard.tsx`):**
- Untuk site admin: **skip filter lokasi sepenuhnya** karena data sudah di-scope via `staff_uid`. Set initial `filterLocation = 'all'` walau site admin, dan disable dropdown Lokasi (atau hide-kan untuk site admin).
- Atau: ubah logic filter — kalau `isSiteAdmin`, jangan apply location filter di `useEffect` filter pipeline.
- Lebih clean: untuk site admin, sembunyikan dropdown Lokasi dan chip "Filter aktif: Lokasi: …", karena toh sudah otomatis terbatas.

## Perubahan Database (1 migration)
```sql
ALTER TABLE public.staff_users
  ADD COLUMN IF NOT EXISTS morning_reminder_enabled BOOLEAN DEFAULT true;
-- birthday_disabled per area pakai app_settings existing (tidak perlu schema baru)
```

## Files yang Disentuh
- `src/pages/Index.tsx` — hapus NotificationBell dari header
- `src/components/UserSidebar.tsx` — tambah item Notifikasi + badge
- `src/components/NotificationBell.tsx` — extract isi popover jadi reusable list (atau buat `NotificationSheet`)
- `src/pages/UserProfile.tsx` — upload foto + 2 switch (push + morning reminder)
- `src/components/EmployeeManager.tsx` — upload foto di form edit
- `src/components/AnnouncementsCarousel.tsx` — normalize link_url
- `src/components/AnnouncementManager.tsx` — normalize sebelum save + section "Pengaturan Area" (toggle birthday)
- `src/components/BirthdayCard.tsx` — cek flag disabled per area
- `src/pages/Dashboard.tsx` — fix filter lokasi site admin
- `supabase/functions/remind-clock-in/index.ts` — filter `morning_reminder_enabled`

## Tradeoff & Risiko
- **Lonceng di sidebar**: user perlu buka sidebar untuk lihat notif baru. Badge unread di tombol sidebar (☰) tetap muncul realtime, jadi tidak hilang awareness.
- **Foto upload user-sendiri**: tidak ada moderasi konten. Kalau khawatir, bisa tambah approval flow nanti — sekarang trust-based seperti edit kontak.
- **Birthday disable per area**: pakai `app_settings` (key string) lebih fleksibel daripada bikin tabel baru, tapi tidak ada FK ke work_area. Acceptable karena work_area sendiri cuma string di `staff_users`.
- **Filter lokasi site admin disembunyikan**: konsisten dengan prinsip "site admin scope-locked", tidak membingungkan.
