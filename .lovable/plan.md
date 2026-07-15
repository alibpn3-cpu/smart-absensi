## Ringkasan Masalah (Data dari DB & Export)

Query DB (`attendance_records` sejak 2026-07-01, 2356 baris):
- `device_id_in` NOT NULL: **0** baris
- `device_id_out` NOT NULL: **0** baris
- `device_id` (legacy) terisi: 2290 baris

Artinya kolom split `_in`/`_out` **tidak pernah tertulis sekalipun**, meskipun `contextToColumns()` sudah spread-nya ke insert. Ini root cause issue #2 dan sebagian issue #4 (fake-GPS flag hilang karena disimpan di `device_flag_in/_out`).

Untuk issue #1: query menunjukkan hampir semua baris hari ini punya `device_flag = 'clock_manipulated_hard'`. Berarti `time_sync_verified_at` sering kosong / basi walau user tidak mengubah jam.

---

## 1. Main Concern

Split column `_in` / `_out` **tidak pernah masuk DB** → seluruh sistem anti-joki v2 (per-action device, IP, GPS, skew) belum berjalan. Semua analisa (fake GPS, joki, checkout evidence) masih bergantung ke kolom legacy yang di-overwrite saat clock-out.

## 2. Weakest Assumption

Asumsi bahwa `contextToColumns()` sudah cukup untuk memastikan kolom split terisi. Kenyataan: 0/2356 baris terisi. Ada gap antara kode & DB — kemungkinan besar user masih pakai bundle PWA lama (cache SW) yang belum punya split writer, atau ada schema-cache mismatch di PostgREST.

## 3. Strongest Counterargument

"Cukup tunggu force-update rollout." — Tidak cukup. Bahkan setelah bundle baru sampai ke semua device, kita perlu verifikasi via satu insert test bahwa PostgREST menerima kolom `_in`/`_out`. Kalau tidak, semua tetap NULL.

## 4. Yang Perlu Diverifikasi

- Apakah bundle di `absensi.petrolog.my.id` sudah punya `device_id_in` di payload insert (cek via Network tab / rebuild).
- Apakah PostgREST schema cache mengenali kolom `_in`/`_out` (test insert manual via SQL Editor / edge function).
- Apakah `enhancedGeolocation` memanggil `gpsValidator.validateGPS()` sebelum submit (kalau tidak, `setLastGpsSnapshot` tak pernah dipanggil → fake-gps flag selalu null).

## 5. Rencana Perbaikan

### Isu 1 — False positive `clock_manipulated_hard`

Root cause: `time-sync` sering gagal di jaringan lambat (mining site), sehingga `time_sync_verified_at` kosong / lewat 60 menit → edge function men-flag hard.

**Fix (frontend + backend, additive):**
- `useClockSkewGuard.ts`:
  - Poll ulang saat `visibilitychange` (user buka app), bukan cuma tiap 5 menit.
  - Tambah retry ringan (3× dengan backoff 500ms/1s/2s) sebelum give-up.
  - Kalau RTT ≤ 8s DAN skew invalid → tetap invalid; tapi kalau server tidak reachable sama sekali → **tetap panggil `setTimeSyncVerifiedNow()`** hanya jika sebelumnya sudah pernah sukses dalam 24 jam (grace period offline).
- `useAttendanceForm` / titik sebelum submit: `await clockGuard.recheck()` **sebelum** `getAttendanceContext`, dan kalau masih gagal, kirim `time_sync_verified_at` dari last-known-good (persist di localStorage, bukan cuma memory).
- `attendance-context/index.ts`: naikkan `TIME_SYNC_MAX_AGE_MS` dari 60m → **6 jam**, dan pisahkan `clock_manipulated_hard` (skew > 120s TERUKUR) vs `time_sync_stale` (soft flag, tidak block). Flag hard hanya kalau `clock_skew_seconds` benar-benar > 120.
- Persist `time_sync_verified_at` di `localStorage` (key `last_time_sync_ok`) sehingga bertahan across reload/PWA restart.

### Isu 2 — Kolom `_in` / `_out` kosong di DB & Export

**Langkah A: Buktikan penyebab.**
Insert test 1 baris via SQL editor dengan semua kolom `_in` terisi. Kalau tersimpan → root cause = bundle lama di device user. Kalau tetap NULL → PostgREST/RLS masalah.

**Langkah B: Fix di frontend (defensif):**
- `attendanceContext.ts` → `contextToColumns()`: tetap tulis legacy + split (sudah OK), tapi **tambah** kolom yang sekarang hilang untuk check-out:
  - Saat action = `check_out`, JANGAN overwrite `device_id`, `client_ip`, `device_label`, `device_flag` legacy — biarkan tetap punya nilai check-in. Cukup tulis `*_out` versinya.
  - Sekarang legacy diwrite ulang di setiap update → data check-in hilang. Fix: hapus kunci legacy dari hasil `contextToColumns` ketika action=`check_out`.

**Langkah C: Debug logging & fallback:**
- Tambah `console.debug('[attendance] insert payload keys', Object.keys(row))` supaya bisa lihat di production apakah `device_id_in` ikut terkirim.
- Force SW replacement + version bump agar semua user pakai bundle baru.

**Langkah D: Exporter (`AttendanceExporter.tsx`)**
- Fallback: `device_in = device_label_in || device_label || '-'`, `device_out = device_label_out || (checkout ada ? device_label : '-')`. Sama untuk ip/device_id/flag/skew.
- Ini menjaga backward compat sampai split cols terisi konsisten.

### Isu 3 — Reminder di Profile: hapus clock-in, ganti clock-out (+ push notif maksimal)

**DB migration (baru):**
- Tambah kolom `evening_reminder_enabled boolean DEFAULT true` di `staff_users`.
- Biarkan `morning_reminder_enabled` tetap ada (jangan drop — dipakai `remind-clock-in`). User hanya minta UI di profile diubah.

**Frontend (`src/pages/UserProfile.tsx`):**
- Ganti toggle "Reminder Clock-In Pagi" → "Reminder Clock-Out Sore".
- Baca/tulis kolom `evening_reminder_enabled`.

**Backend (`remind-clock-out/index.ts`):**
- Filter staff `.neq('evening_reminder_enabled', false)`.
- Tambah kirim **Web Push** (via `web-push` + tabel `push_subscriptions` yang sudah ada) selain WA, supaya jalan walaupun browser tertutup. Sudah ada infra `push-sw.js` & `send-push-notification` edge function → cukup panggil untuk staff yang belum clock-out.

**Push reliability:**
- Pastikan `push-sw.js` handle event `push` & `notificationclick` benar (tampilkan bahkan saat browser closed di Android Chrome/PWA). Cek subscription auto-renew di `usePushNotifications.ts`.

### Isu 4 — Fake GPS: pastikan terbaca di export

**Verifikasi flow:**
- `enhancedGeolocation.getCurrentPosition()` harus panggil `gpsValidator.validateGPS(coords)` → `setLastGpsSnapshot(...)` sebelum submit. Kalau belum, tambahkan.
- `attendance-context` sudah punya `detectMockGps()` dan menambah flag `suspected_mock_gps` ke `device_flag`. Sekarang hilang karena split cols kosong (issue #2).

**Tambahan di export XLS:**
- Tambah 2 kolom baru: `Fake GPS Clock-In` & `Fake GPS Clock-Out` (Ya/Tidak) berdasarkan `device_flag_in/_out` mengandung `suspected_mock_gps` ATAU `gps_confidence_in/out < 50`.
- Highlight baris merah kalau kedua-nya `Ya`.

## 6. Rekomendasi Final

Kerjakan urutan: **#2 dulu** (paling fundamental — kalau split col masih NULL, isu #4 & sebagian #1 percuma diperbaiki), lalu **#1** (relax hard-flag + persist last sync), lalu **#3** (reminder), terakhir **#4** (kolom export & verifikasi validator).

## File yang Akan Diubah

**Frontend:**
- `src/utils/attendanceContext.ts` — jangan overwrite legacy saat check_out; log payload keys
- `src/utils/antiJokiCache.ts` — persist `time_sync_verified_at` ke localStorage
- `src/utils/enhancedGeolocation.ts` — pastikan panggil `validateGPS()` & set snapshot
- `src/hooks/useClockSkewGuard.ts` — retry + visibilitychange + last-known-good grace
- `src/components/AttendanceExporter.tsx` — fallback legacy + 2 kolom Fake GPS baru
- `src/pages/UserProfile.tsx` — ganti toggle jadi clock-out reminder
- `src/hooks/usePushNotifications.ts` — pastikan auto-renew subscription
- `public/push-sw.js` — verifikasi handler push/notificationclick

**Backend:**
- `supabase/functions/attendance-context/index.ts` — `TIME_SYNC_MAX_AGE_MS` 60m→6h, pisahkan hard vs soft flag
- `supabase/functions/remind-clock-out/index.ts` — filter `evening_reminder_enabled` + trigger push notif

**Migration (data-only, no schema di kolom absensi):**
- `ALTER TABLE staff_users ADD COLUMN evening_reminder_enabled boolean DEFAULT true`

**Non-goals:**
- Tidak backfill data lama (permintaan sebelumnya "mulai sekarang saja")
- Tidak ubah geofence, star score, shift logic
- Tidak block user karena fake GPS — cuma flag (permintaan user)