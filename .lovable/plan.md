
## Tujuan
Tutup celah deteksi "joki via shared device" di layer **export Excel**. Saat ini flag `device_shared_with_other_user` hanya dihitung saat insert — kalau User A absen pagi & User B pakai device sama sore hari, record User A pagi tetap tak terflag. Solusi: scan dataset di export, mark merah semua record yang terlibat sharing.

## Yang berubah

### 1. `src/components/AttendanceExporter.tsx` (admin export)
Sebelum loop bikin baris:
- Build map `deviceUsersMap: Record<device_id, Set<staff_uid>>` dari semua records di dataset
- Identifikasi `sharedDeviceIds = Set<device_id>` dengan `users.size > 1`

Saat render baris:
- Kalau `record.device_id` ada di `sharedDeviceIds`:
  - Set `record._jokiSuspect = true`
  - Set `record._sharedWith = [staff_uid lain]` (untuk label)
- Kolom **Flag** sekarang menampilkan:
  - Kalau `_jokiSuspect`: `'⚠ JOKI SUSPECT: device juga dipakai oleh ' + sharedWith.join(', ')`
  - Else: label existing (Perangkat Baru / dst)
- Highlight baris:
  - `_jokiSuspect` → fill **merah muda** (`FFFFCDD2`) — prioritas tertinggi
  - `device_flag` ada (non-suspect) → fill **kuning** existing (`FFFFF3CD`)
  - Tidak ada → no fill

### 2. `src/pages/SubAdminReports.tsx` (sub-admin export & tabel)
Logic identik:
- Build `sharedDeviceIds` dari dataset yang sudah di-fetch
- Excel export: kolom Flag & highlight merah sama persis
- Tabel UI: tambah badge merah "JOKI SUSPECT" di kolom Flag kalau device shared (visual immediate sebelum export)

### 3. Tidak ada perubahan DB
Tidak ada migration, tidak ada perubahan edge function, tidak ubah `attendance_records`. Pure presentational logic di sisi export. Kalau dataset diperluas (filter beda), perhitungan otomatis update.

## Edge case yang ditangani
- `device_id IS NULL` → tidak masuk perhitungan (tidak false-flag user dengan stale bundle)
- 1 user pakai device sama berkali-kali → tidak shared (set.size = 1), tidak flag
- 3+ user pakai 1 device → semua di-mark, label list semua staff_uid lain
- Dataset 1 hari vs 1 bulan → cross-check otomatis ikut scope filter

## Verifikasi
1. Export Excel periode yang mencakup device `212ef1a9-...` (sudah confirmed shared antara `01092301` & `18102101`) → kedua baris merah, label "JOKI SUSPECT: device juga dipakai oleh [uid lain]"
2. Export periode 1 hari di mana hanya 1 user pakai device → tidak ada flag merah
3. Sub-admin reports tabel → badge merah muncul di kolom Flag untuk shared device
4. Record dengan `device_id = NULL` → tidak terpengaruh, tetap '-'
5. Record dengan flag lama (`new_device`, `user_on_other_device`) tapi device tidak shared → tetap kuning

## File yang diubah
- `src/components/AttendanceExporter.tsx` — tambah pre-scan + override flag/fill
- `src/pages/SubAdminReports.tsx` — sama + badge di tabel

## Yang TIDAK dibangun (sesuai keputusan)
- ❌ Tidak ada nightly backfill — flag DB tetap as-is, hanya export yang akurat
- ❌ Tidak ada force version bump — stale bundle dibiarkan sembuh natural
