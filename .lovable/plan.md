
## Tujuan
Deteksi user yang manipulasi jam HP (nonaktif NTP + edit manual) untuk menghindari flag terlambat. Pendekatan: **detect + flag + soft warning**, tidak blokir absen. Jam absen yang tercatat tetap pakai jam **server** (sudah benar di sistem sekarang via `created_at = now()`), jadi manipulasi jam HP hanya menipu UI user sendiri — DB selalu mencatat kebenaran.

## Yang akan dibangun

### 1. Migration: tambah kolom `attendance_records`
- `client_timestamp` (timestamptz, nullable) — jam device user saat submit
- `clock_skew_seconds` (integer, nullable) — selisih |server - client| dalam detik

Tidak ubah `device_flag` enum/string — cukup append nilai baru `'clock_manipulated'` ke string yang ada. Bisa gabungan: `'clock_manipulated,device_shared_with_other_user'`.

### 2. Update edge function `attendance-context`
- Terima `client_timestamp` (ISO string) di body
- Hitung `clock_skew_seconds = Math.round(Math.abs(Date.now() - new Date(client_timestamp).getTime()) / 1000)`
- Threshold: **120 detik**. Jika lewat → append `'clock_manipulated'` ke `device_flag`
- Return tambahan: `{ clock_skew_seconds, clock_warning: boolean }`

### 3. Update `src/utils/attendanceContext.ts`
- Kirim `client_timestamp: new Date().toISOString()` di payload
- Return interface tambah `clock_skew_seconds`, `clock_warning`
- Fallback (kalau edge function gagal): keduanya `null` / `false`

### 4. Update `src/components/AttendanceForm.tsx`
Di **7 titik insert/update** yang sudah panggil `getAttendanceContext`:
- Tulis `client_timestamp` dan `clock_skew_seconds` ke insert/update payload
- Setelah context return, kalau `ctx.clock_warning === true`:
  ```
  toast({
    title: 'Jam perangkat tidak sinkron',
    description: 'Jam HP Anda berbeda ~X menit dari jam server. Mohon aktifkan "Tanggal & Waktu Otomatis" di pengaturan. Absensi tetap diproses dengan jam server.',
    duration: 6000
  })
  ```
- **Absen TETAP LANJUT** — tidak ada `return`, tidak ada blokir

### 5. Tampilan di export (audit trail)
**`src/components/AttendanceExporter.tsx`** & **`src/pages/SubAdminReports.tsx`**:
- Tambah 1 kolom Excel: **"Skew Jam (detik)"** menampilkan `clock_skew_seconds || '-'`
- Label flag kalau `device_flag` mengandung `'clock_manipulated'`: "Jam Manipulasi" (gabung dengan label lain pakai " + ")
- Baris dengan `clock_manipulated` flag → tetap highlight kuning (sudah ada logic-nya)

### 6. UI biasa user tidak berubah
User normal (skew < 120 detik) tidak lihat apa-apa, alur sama persis. History attendance user juga tidak menampilkan skew (privacy).

## Yang TIDAK dibangun (sesuai keputusan)
- ❌ Tidak ada timezone check (Indonesia ada WIB/WITA/WIT, tidak praktis dibandingkan)
- ❌ Tidak ada hard block clock in/out
- ❌ Tidak ubah `created_at` / `check_in_time` logic — sudah benar pakai jam server
- ❌ Tidak ada perubahan ke alur offline (offline records skip skew capture, silent)

## File yang berubah
- **Migration baru**: tambah `client_timestamp`, `clock_skew_seconds` ke `attendance_records`
- **Edit**: `supabase/functions/attendance-context/index.ts`
- **Edit**: `src/utils/attendanceContext.ts`
- **Edit**: `src/components/AttendanceForm.tsx` (7 titik: check-in, check-out, fast checkout, 2 overtime-in, 2 overtime-out)
- **Edit**: `src/components/AttendanceExporter.tsx` (kolom + label)
- **Edit**: `src/pages/SubAdminReports.tsx` (kolom + label)

## Verifikasi
1. Set jam HP mundur 5 menit → clock in → toast warning muncul → absen sukses → DB: `clock_skew_seconds ≈ 300`, `device_flag` berisi `clock_manipulated`, `check_in_time` tetap jam server (bukan jam HP)
2. Jam HP normal (drift < 120 detik) → tidak ada toast → `clock_skew_seconds < 120`, tidak ada flag
3. Edge function gagal/timeout → absen tetap sukses, kedua kolom skew NULL (graceful)
4. Sub-admin export Excel → kolom "Skew Jam (detik)" tampil, baris flagged highlight kuning
5. User biasa lihat history → tidak ada perubahan UI

## Risiko yang diterima
- User canggih bisa intercept request & ubah `client_timestamp` sebelum kirim → diterima, ini deterrent + audit, bukan crypto-grade
- HP baru boot belum sync NTP bisa drift 30-90 detik → di bawah threshold 120 detik, aman dari false positive
- Threshold 120 detik dipilih agar tidak ganggu user normal
