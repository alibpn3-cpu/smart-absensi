
# Plan: Anti-Joki Enhancements + Offline Queue

Semua perubahan **additive** — kolom lama tetap ada agar workflow existing tidak rusak. Backfill data lama tidak dilakukan (mulai berlaku dari sekarang).

---

## 1. Pisahkan Device / Flag / IP per Aksi (Check-in vs Check-out)

### Database (migration)
Tambah kolom baru di `attendance_records` (tanpa hapus yang lama):
- `device_id_in`, `device_id_out` (text)
- `device_label_in`, `device_label_out` (text)
- `device_flag_in`, `device_flag_out` (text)
- `client_ip_in`, `client_ip_out` (text)
- `clock_skew_seconds_in`, `clock_skew_seconds_out` (int)

Kolom lama (`device_id`, `device_flag`, dll) tetap ada — akan tetap terisi (mirror dari yang terbaru) untuk backward compatibility.

### Edge function `attendance-context`
Sudah menerima `action: 'check_in' | 'check_out'`. Tidak berubah — perbedaan penulisan kolom dilakukan di client.

### Client (`AttendanceForm.tsx`)
- Saat **check-in**: tulis ke kolom `*_in` + mirror ke kolom lama.
- Saat **check-out**: tulis ke kolom `*_out` + mirror ke kolom lama (jangan overwrite `*_in`).

### Report UI (`AttendanceExporter.tsx` + `DashboardAnalytics.tsx` bagian device/flag)
- Tampilkan dua baris flag: "Check-in: Chrome • Android 13 | flag: device_shared_with_other_user (Budi Santoso)" dan "Check-out: ...".
- **Resolve UID → nama karyawan**: saat flag mengandung `device_shared_with_other_user` atau `user_on_other_device`, query nama staff dari `staff_users` berdasarkan UID yang tersimpan di history device_id itu, lalu tampilkan `nama (UID)` bukan hanya UID.

---

## 2. Anti Fake GPS — Tambah Flag Baru (tidak block)

### Client (`gpsValidator.ts`)
Tambah indikator mentah ke `AttendanceContext`:
- `gps_accuracy`, `gps_altitude_null` (bool), `gps_speed`, `gps_confidence_score` (dari validator existing).

### Edge function `attendance-context` — tambah flag baru
- **`suspected_mock_gps`**: jika `gps_confidence_score < 50` (dari client) ATAU accuracy < 3m + altitude null + speed null (kombinasi klasik Fake GPS).
- **`ip_gps_mismatch`**: reverse-geolocate IP client via IP → country/region (gunakan header CF `cf-ipcountry` jika ada; kalau tidak, skip). Bandingkan negara IP vs koordinat GPS (Indonesia vs bukan). Jarak antar kota tidak dicek karena butuh API berbayar.
- **`clock_manipulated_hard`** (BARU): jika `time-sync` gagal dipanggil di sesi ini SAMA SEKALI padahal request masuk (indikasi user matikan jaringan → clock in → nyalakan). Client kirim boolean `time_sync_verified_at` (timestamp terakhir sukses time-sync). Edge function tandai jika > 15 menit lalu atau null.

### Client — perkuat time guard
- Di `AttendanceForm.tsx` sebelum submit clock in/out: **wajib panggil `time-sync` sekali lagi** (bukan hanya dari polling 5 menit). Kalau gagal → toast peringatan "Jaringan tidak stabil, absensi tetap diproses tapi akan ditandai" — tetap lanjut submit (fail-open, tapi flag tercatat).
- Kirim `time_sync_verified_at` ke `attendance-context` supaya bisa dijadikan flag.

### Report UI
Warna badge flag:
- Merah: `device_shared_with_other_user`, `clock_manipulated`, `clock_manipulated_hard`, `suspected_mock_gps`, `ip_gps_mismatch`
- Kuning: `new_device`, `user_on_other_device`

**Tidak ada block/prevent** — semua tetap bisa clock in. Admin cek di laporan.

---

## 3. Offline Queue untuk Clock In/Out (PWA — Full Offline)

### Ekspektasi jujur (harus disampaikan ke user di UI)
- Web/PWA **tidak bisa** deteksi mock GPS setingkat native.
- Saat offline: koordinat & jam **dari device** (tidak ada validasi server). Manipulasi jauh lebih mudah.
- Semua clock-in offline **otomatis di-flag** `offline_queued` + `offline_client_time_only` supaya admin tahu ini butuh review manual.

### Implementasi

**PWA setup (mengikuti PWA skill)**
- Update `public/manifest.json` — sudah ada, pastikan `display: standalone`, icon lengkap.
- Ganti `public/sw.js` custom yang sekarang (bermasalah, cache script) dengan setup `vite-plugin-pwa` (`generateSW`, `NetworkFirst` untuk HTML, `CacheFirst` untuk asset hashed). Guard registration: hanya di produksi, bukan di preview Lovable.

**Offline queue (IndexedDB)**
- Utility baru `src/utils/offlineAttendanceQueue.ts` pakai `idb-keyval` (ringan).
- Schema entry: `{ id, action, staff_uid, timestamp_client, location, photo_blob, geofence_area_id, work_status, shift_type, context, queued_at }`.
- Saat online + submit gagal → simpan ke queue → toast "Absensi tersimpan offline, akan sync saat online".
- Saat offline → langsung antre + toast.

**Sync worker**
- Listen `online` event + interval 30 detik saat halaman aktif.
- Proses antrian FIFO: upload foto ke storage → insert row `attendance_records` dengan flag `offline_queued` + jam asli client (bukan server `now()`).
- Setelah sukses → hapus dari queue + notif "N absensi offline berhasil sync".
- Kalau gagal (mis. duplikat, staff dinonaktifkan): pindahkan ke "failed queue" + notif ke user.

**UI indicator**
- Badge di `AttendanceForm.tsx`: "🔴 Offline — N absensi menunggu sync" saat ada antrian.
- Tombol manual sync di badge.

**Batasan (dokumentasikan di komentar + toast)**
- Foto disimpan sebagai Blob di IndexedDB (bisa besar) — batasi max 20 entry di queue.
- Time-sync tidak bisa jalan → flag `clock_manipulated_hard` otomatis.
- Geofence tetap divalidasi dari koordinat cached terakhir jika ada; kalau tidak → flag `offline_no_location_validation`.

### Rekomendasi tegas (tetap sarankan native)
Setelah fitur offline PWA jalan, tambahkan **catatan di UI Admin** dan **README**: untuk anti-joki tingkat serius (mock GPS detection, secure device attestation, background sync andal), migrasi ke Capacitor native tetap direkomendasikan. PWA offline queue = pragmatic compromise, bukan solusi ideal.

---

## Technical Details

### Files to change
- **Migration baru**: tambah kolom `*_in`/`*_out` di `attendance_records`.
- **Edit `supabase/functions/attendance-context/index.ts`**: tambah logic flag `suspected_mock_gps`, `ip_gps_mismatch`, `clock_manipulated_hard`. Terima field baru dari client.
- **Edit `src/utils/attendanceContext.ts`**: kirim `gps_*` fields + `time_sync_verified_at`.
- **Edit `src/components/AttendanceForm.tsx`**: pre-submit time-sync check; tulis ke kolom `*_in`/`*_out`.
- **Edit `src/components/AttendanceExporter.tsx` + komponen laporan yang tampilkan flag**: resolve UID→nama, tampilkan flag check-in vs check-out terpisah.
- **New `src/utils/offlineAttendanceQueue.ts`**: IndexedDB queue.
- **New `src/hooks/useOfflineSync.tsx`**: hook untuk auto-sync.
- **Edit `src/components/AttendanceForm.tsx`**: integrate queue + UI indicator.
- **Setup `vite-plugin-pwa`**: `bun add -D vite-plugin-pwa`, edit `vite.config.ts`, ganti `public/sw.js` (kill-switch dulu untuk SW lama, lalu generateSW).
- **New `src/pwa/registerSW.ts`**: guarded registration wrapper.

### Non-goals (eksplisit)
- Tidak backfill data device_id lama.
- Tidak block clock in walaupun terdeteksi mock GPS (sesuai keputusan user).
- Tidak migrasi ke Capacitor di iterasi ini — hanya direkomendasikan.
- Tidak call API IP-geolocation berbayar; hanya pakai header CF gratis.

### Risiko
- **PWA switch dari custom `sw.js` ke `vite-plugin-pwa`**: user existing yang sudah install PWA butuh 1 kali reload untuk kill-switch worker lama menghapus registrasi. Sudah standard flow di PWA skill.
- **IndexedDB blob**: bisa penuh di HP low-storage. Cap 20 entry + expire >7 hari.
- **Flag `ip_gps_mismatch` false-positive**: user yg pakai VPN → flagged. OK karena tetap non-blocking.
