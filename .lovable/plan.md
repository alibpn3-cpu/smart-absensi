## Perbaikan 4 Isu: Fake GPS, Reminder, Manipulasi Jam, Export

### 1. Fake GPS false positive (khususnya iPhone)

**Root cause**: `gpsValidator.ts` menghukum akurasi < 3m (-25 poin) dan tidak-ada-altitude (-5 poin). iPhone modern (iOS 15+) di outdoor kerap melaporkan akurasi 2–5m tanpa altitude di web Safari — bukan spoofing. Ambang mocked di skor <50 juga terlalu ketat.

**Perbaikan**:
- Deteksi platform via `userAgent` (iOS Safari vs Android Chrome) dan longgarkan aturan untuk iOS:
  - iOS: akurasi <2m baru dianggap terlalu sempurna (bukan <3m); no-altitude tidak dipenalti sama sekali (Safari memang jarang expose altitude di web).
  - Android: pertahankan aturan lama (akurasi <3m suspicious) karena aplikasi fake GPS Android umum.
- Turunkan ambang "mocked" dari `<50` menjadi `<35` supaya tidak terlalu agresif.
- Tambah "hard signal" yang lebih spesifik: hanya tandai `is_mocked=true` bila menemui indikator kuat (kecepatan negatif, teleportasi >100 m/s, atau accuracy 0/1 m yang mustahil).
- Simpan `platform` di snapshot GPS supaya edge function bisa menerapkan aturan yang sama saat cross-check.
- Di `attendance-context/index.ts`, hanya tandai `suspected_mock_gps` bila `is_mocked=true` **atau** confidence <35 (bukan <50), agar konsisten dengan client.
- Tambahkan flag halus baru `gps_low_confidence` (skor 35–60) di kolom `device_flag` sehingga admin tetap melihat gejala tanpa tuduhan keras.

### 2. Reminder clock-out belum maksimal

**Root cause**: Cron hanya jalan sekali di `0 15 * * *` UTC (=22:00 WIB / 23:00 WITA). Push notification memang sudah dipanggil ke `send-push-notification`, tapi sekali saja dan terlalu larut untuk WITA.

**Perbaikan**:
- Migrasi baru menjadwalkan **dua** cron:
  - `14 * * * *` UTC (=21:00 WIB & 22:00 WITA) untuk WIB.
  - `15 * * * *` UTC (=22:00 WIB & 23:00 WITA) untuk WITA.
  - Alternatif lebih rapi: satu cron per jam antara 21:00–23:59 local (parameter `?tz=WIB|WITA`), edge function memfilter user by `work_area`.
- Ubah `remind-clock-out/index.ts`:
  - Terima `tz` param dan hitung tanggal lokal dari zona itu (bukan hardcoded WIB).
  - Filter `staff_users` by `work_area` yang sesuai zona.
  - Kirim web push dulu (paralel, tak bergantung nomor HP), lalu WhatsApp untuk user yang punya `phone_number`.
  - Web push kirim dengan `requireInteraction: true` dan `renotify: true` supaya notifikasi tetap terlihat saat browser tertutup / user tidur.
  - Idempotent: kirim ulang OK karena `tag` unik per (uid,date,slot).
- Di `push-sw.js` pastikan opsi `requireInteraction`, `renotify`, `silent: false`, dan vibrate diteruskan dari payload.
- Di UI `UserProfile`, tambah copy singkat: "Aktifkan notifikasi browser agar reminder tetap muncul walau aplikasi ditutup."

### 3. Manipulasi jam masih ke-flag walau tidak dimanipulasi

**Root cause**:
- Perbedaan zona waktu memang tidak jadi masalah di guard client (`useClockSkewGuard` sudah pakai epoch UTC), tapi di `attendance-context/index.ts` `client_timestamp` dibandingkan dengan `Date.now()` server. Jika ada latency network / clock drift kecil <2 menit itu OK, tapi kombinasi (a) `time_sync_stale` karena user offline saat verifikasi terakhir dan (b) skew karena RTT tinggi bisa memicu `clock_manipulated` (soft) padahal jam benar.
- Threshold `CLOCK_SKEW_THRESHOLD_SECONDS = 120` terlalu ketat untuk jaringan lemah.

**Perbaikan**:
- Naikkan `CLOCK_SKEW_THRESHOLD_SECONDS` menjadi 300 (5 menit) — cukup untuk clock drift wajar tapi tetap menangkap manipulasi jam bulanan.
- Tambah "grace window" bila `time_sync_verified_at` ada dan usianya <24 jam: tidak pernah set `clock_manipulated_hard`, maksimal `time_sync_stale`.
- Sertakan `client_tz_offset_minutes` di payload (dari `new Date().getTimezoneOffset()`). Server memvalidasi offset masuk akal (WIB=-420 atau WITA=-480). Jika offset tidak masuk akal, cukup catat flag `unusual_timezone` — bukan `clock_manipulated_hard`.
- Ubah label flag jadi lebih deskriptif: `clock_drift_soft` (skew 120–300s), `clock_skew_high` (>300s tapi sync fresh), `clock_manipulated_hard` (>300s DAN sync stale >24h).
- Update exporter agar tetap kompatibel: kolom flag baru dimapping ke label bahasa Indonesia.

### 4. Export XLS & limit 1000 Supabase

**Root cause**: `AttendanceExporter.fetchAttendanceData` sudah pakai batch 1000 dengan `.range()`, tapi:
- Kondisi berhenti `data.length < BATCH_SIZE` benar, tapi tidak ada log jika error di batch ke-N (silent partial return).
- Ada risiko duplikasi baris jika `date` + `check_in_time` tidak unik dan sorting tie-break tidak stabil.
- Filter status/employee/area sudah OK; hanya perlu memastikan tidak ada `.limit()` implisit yang lolos.

**Perbaikan**:
- Tambah safety upper bound (mis. 200 batch = 200.000 rows) dan toast jika terpotong.
- Sertakan kolom flag baru (`gps_low_confidence`, `clock_drift_soft`, `clock_skew_high`, `unusual_timezone`) di header export XLS/CSV/PDF.
- Pastikan fallback legacy untuk `device_id_out`/`client_ip_out` sudah tetap ada (sudah), dan tambah kolom `Fake GPS Confidence In/Out` menampilkan angka mentah supaya admin bisa audit.
- Cek juga `AttendanceStatusList` dan API endpoint lain (`sub-admin-reports` jika ada) menggunakan pola batch yang sama; kalau ada yang belum, samakan.

### File yang akan diubah

- `src/utils/gpsValidator.ts` — aturan iOS-aware, ambang baru.
- `src/utils/enhancedGeolocation.ts` — sertakan hasil validasi (platform) ke snapshot.
- `src/utils/attendanceContext.ts` — kirim `client_tz_offset_minutes`.
- `supabase/functions/attendance-context/index.ts` — threshold baru, validasi TZ, flag baru.
- `supabase/functions/remind-clock-out/index.ts` — support `tz` param, push web maksimal.
- `public/push-sw.js` — `requireInteraction`, `renotify`.
- `src/components/AttendanceExporter.tsx` — kolom flag baru + safety cap.
- `src/pages/UserProfile.tsx` — copy edukasi notifikasi.
- Migrasi baru untuk cron dua-jadwal (via `supabase--insert`, bukan file migrasi, sesuai instruksi karena berisi anon key).

### Yang TIDAK diubah

- Skema DB attendance tidak berubah (flag baru masuk ke kolom string `device_flag` yang sama).
- Flow clock-in/out di `AttendanceForm` tidak disentuh — hanya utilitas pendukung.
