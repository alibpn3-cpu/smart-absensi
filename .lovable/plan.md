
## 1. False positive `clock_manipulated_hard` (banyak user terflag padahal jam benar)

**Root cause** di `useClockSkewGuard.ts` + `attendance-context/index.ts`:
- `setTimeSyncVerifiedNow()` hanya dipanggil kalau **RTT ≤ 3000 ms**. Jaringan lambat (4G lemah, area tambang) sering >3 s → cache time-sync **tidak pernah terisi** → edge function menganggap "belum verify" → hard flag.
- Batas usia verifikasi cuma **15 menit**. Kalau user buka app, menunggu, lalu clock-in setelah >15 menit → hard flag.
- `recheck()` sebelum submit juga tunduk pada RTT<3s yang sama, jadi tidak menyelamatkan.

**Fix (aman, tidak mengubah aturan bisnis)**:
- Relax constraint di `useClockSkewGuard`:
  - Perpanjang `MAX_ACCEPTABLE_RTT_MS` dari 3 s → **8 s**.
  - Kalau RTT > 8 s tapi masih dapat response valid dan `skew ≤ 120 s`, tetap set `setTimeSyncVerifiedNow()` (server merespons = jam server terverifikasi; RTT tinggi hanya bikin estimasi skew kurang presisi, bukan bukti manipulasi).
- Perpanjang `TIME_SYNC_MAX_AGE_MS` di edge function dari 15 menit → **60 menit** (masih cukup ketat untuk mendeteksi trik airplane-mode-tunggu-lama, tapi tidak menghukum user yang idle 20–30 menit).
- Trigger `clockGuard.recheck()` **hanya sekali** tambahan tepat sebelum submit (sudah ada) — pastikan menunggu selesai (`await`) sebelum panggil `getAttendanceContext`.

Hasilnya: user dengan jaringan lambat / aplikasi kebuka lama tidak lagi terflag palsu; manipulasi jam nyata (skew >2 menit) tetap terdeteksi.

## 2. Anti-joki split in/out — verifikasi

Cek konfirmasi (tidak ada perubahan kalau sudah benar):
- `contextToColumns(ctx, 'check_in')` menulis ke `*_in`, `contextToColumns(ctx, 'check_out')` ke `*_out`.
- Semua site submit di `AttendanceForm.tsx` (form biasa + kiosk) memakai helper ini → clock-out **tidak** menimpa data clock-in. Report exporter sudah menampilkan dua kolom terpisah + resolve UID → nama.
- Tidak ada regresi dari fix #1 karena hanya threshold yang berubah.

## 3. Shift lintas hari — validasi setelah penghapusan cabang `h < 12`

Verifikasi flow saat ini (setelah simplifikasi `computeWorkDate` menjadi selalu `toLocalDateString(now)`):

- **Clock-in shift malam pukul 23:00 (14 Juli)** → `date = 2026-07-14` ✓.
- **Clock-out pukul 07:00 (15 Juli)**: `fetchTodayAttendance` cari record 15 Juli (kosong), lalu karena `isNightShift || shift_available` cek 14 Juli → menemukan record open → `todayAttendance.date = 2026-07-14` → submit checkout memakai `todayAttendance?.date` (line 1525) → **tetap tercatat di 14 Juli** ✓.
- **User pilih shift saat clock-in pagi (07:30)** → `date = hari ini` ✓ (bukan lagi kemarin) — sesuai perbaikan user.
- Kiosk flow (line 1136–1146) juga sudah cek yesterday untuk night shift saat clock-out → konsisten.

Kesimpulan: perubahan user sudah tepat. **Tidak perlu edit** file `shiftHelper.ts` maupun logika terkait; hanya update komentar JSDoc di `computeWorkDate` supaya tidak menyesatkan (sekarang komentar masih menyebut "hour < 12 → yesterday" padahal sudah dihapus).

## 4. Update modal: user ter-logout & modal muncul terus

**Root cause** di `ForceUpdateModal.tsx` (`handleCarouselComplete`):
- `localStorage.clear()` menghapus **semua** key termasuk token sesi Supabase (`sb-<ref>-auth-token`, dll). Setelah reload, user tidak login lagi.
- Preserve list hanya menyimpan `shared_device_mode`, `device_id`, `user_timezone` — sesi hilang.
- Selain itu, jika `localStorage.clear()` gagal sebagian atau reload race, `app_installed_version` bisa hilang → modal muncul lagi di reload berikutnya.

**Fix**:
- Ganti strategi dari "clear all + restore" jadi **selective clear**: iterate `localStorage` keys, hapus hanya key non-esensial (mis. cache attendance, cache dropdown). Whitelist yang **wajib disimpan**:
  - Semua key berawalan `sb-` (Supabase auth session).
  - `shared_device_mode`, `device_id`, `user_timezone`, `app_installed_version` (di-set setelahnya).
  - Key user preference lain (`selected_staff_uid`, dll) — audit singkat.
- Tetap clear `caches` API + trigger `registration.unregister()` untuk SW lama biar aset baru ke-fetch.
- Set `app_installed_version = newVersion` **sebelum** reload, dengan try/catch dan verify `getItem` cocok setelah set.
- Di `useVersionCheck.tsx`: initial default `installedVersion` sudah `currentAppVersion` (fallback), tapi tambahkan **write-once**: kalau `LOCAL_VERSION_KEY` belum ada, tulis `currentAppVersion` saat pertama check — sehingga user baru tidak dianggap "belum update" ketika DB version = current build version.

Hasil: setelah update user tetap login; modal hanya muncul saat DB version benar-benar berubah lebih tinggi dari yang sudah tercatat.

## Files to edit

- `src/hooks/useClockSkewGuard.ts` — relax RTT, mark verified even on slow RTT.
- `supabase/functions/attendance-context/index.ts` — `TIME_SYNC_MAX_AGE_MS` 15m → 60m.
- `src/utils/shiftHelper.ts` — update stale JSDoc only.
- `src/components/ForceUpdateModal.tsx` — selective localStorage clear preserving `sb-*` session.
- `src/hooks/useVersionCheck.tsx` — write baseline `LOCAL_VERSION_KEY` on first run.

## Non-goals
- Tidak mengubah skema DB.
- Tidak menyentuh logika geofence / GPS validator.
- Tidak mengubah aturan penulisan kolom `*_in` / `*_out`.
