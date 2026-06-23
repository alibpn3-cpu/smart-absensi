
# Hard-Block "Pengaturan Waktu Tidak Valid" (Talenta-style)

## 1. Konsep yang dipakai Talenta (dan aplikasi sejenis)
Mereka **tidak** mengecek timezone. Yang dicek hanya **selisih UTC absolut** antara `Date.now()` device dengan server time. Caranya:

- Saat app dibuka / sebelum aksi presensi, app **ping server** (HEAD ke endpoint sendiri, atau call edge function ringan) → ambil header `Date:` atau body `{ server_now }`.
- Hitung `skew = |server_utc - device_utc|`.
- Jika `skew > threshold` → tampilkan **modal blocking** (bukan toast). Tombol "Atur waktu sekarang" + "Kembali ke dasbor".
- Modal ini **mencegah** klik Clock In / Clock Out sampai user perbaiki jam device-nya (atau app re-check ulang dan skew kembali normal).

Timezone device dibiarkan apa adanya (WIB/WITA/WIT/UTC) karena perbandingan dilakukan dalam **epoch UTC** — zona tampilan tidak mempengaruhi epoch.

## 2. Kenapa pakai modal blocking, bukan toast saja?
Strategi sebelumnya (soft warning + flag) tetap meloloskan absen. User dengan niat curang tidak peduli toast. Modal blocking memaksa user fix jam-nya, sehingga semua data turunan (UI tampilan jam, log lokal, IndexedDB offline cache, P2H timestamp) jadi konsisten dengan server. Server `now()` tetap jadi sumber kebenaran final, modal ini lapisan pencegahan di depan.

## 3. Yang akan dibangun

### A. Edge function `time-sync` (baru, sangat ringan)
- `GET /time-sync` → return `{ server_time: <ISO>, server_epoch_ms: <number> }`.
- Tanpa auth (public), tanpa DB query. Tujuan: latency rendah agar perbandingan skew akurat.
- Set header `Cache-Control: no-store`.

### B. Hook `useClockSkewGuard` (baru, `src/hooks/useClockSkewGuard.ts`)
- Panggil `time-sync` saat:
  - mount halaman utama,
  - setiap **5 menit** sekali (interval),
  - manual via `recheck()` (dipanggil sebelum aksi presensi).
- Hitung RTT round-trip; `skew = |server_epoch_ms - (device_epoch_ms - rtt/2)|`.
- Threshold: **120 detik** (konsisten dengan yang sudah ada).
- Expose: `{ isClockInvalid, skewSeconds, recheck, lastCheckedAt }`.
- Graceful: jika network gagal → `isClockInvalid = false` (jangan blokir user offline).

### C. Komponen `ClockInvalidDialog` (baru)
- Modal dialog (shadcn `Dialog`, `closeOnOverlayClick={false}`, tanpa tombol X jika `isClockInvalid` masih true).
- Konten meniru screenshot Talenta:
  - Ikon jam + warning.
  - Judul: "Pengaturan waktu tidak valid".
  - Body: "Aktifkan waktu otomatis pada perangkat Anda agar dapat disinkronkan dengan server Digital Presensi."
  - Info: tampilkan `Selisih: X menit Y detik`.
  - Tombol primary "Cek ulang sekarang" → panggil `recheck()`. (Web app tidak bisa buka Settings Android secara langsung — beda dengan native app Talenta. Kita kasih instruksi + tombol re-check.)
  - Tombol sekunder "Kembali ke dasbor" → tutup modal, **tapi tombol Clock In/Out tetap di-disable** selama `isClockInvalid` true.
- Konsisten dengan dark theme + neon (sesuai memory project).

### D. Integrasi di `AttendanceForm.tsx`
- Konsumsi `useClockSkewGuard` di top level form.
- Render `<ClockInvalidDialog open={isClockInvalid} ... />`.
- **Disable** tombol Clock In, Clock Out, Fast Checkout, Overtime Extend ketika `isClockInvalid === true`. Tooltip / helper text: "Perbaiki jam perangkat dulu".
- Saat user tekan tombol presensi → call `await recheck()` dulu; jika `isClockInvalid` setelah recheck → tetap blokir + buka dialog. Jika lolos → lanjutkan flow existing (yang sudah menulis `clock_skew_seconds` & flag).

### E. Hal-hal yang TIDAK dirubah
- Logika `attendance-context` existing (soft warning + flag) **tetap ada** sebagai lapisan kedua untuk case di mana skew < 120s tapi tetap janggal, atau user manipulasi `client_timestamp` di payload. Modal blocking adalah UX layer, server flag adalah audit layer.
- `created_at`, `check_in_time`, `check_out_time` tetap pakai server `now()`.
- Tidak ada pengecekan timezone (sesuai keputusan sebelumnya).
- Tidak ada perubahan schema DB.
- Tidak menyentuh kiosk mode (kiosk biasanya jam-nya stabil; tapi guard ini ikut aktif di sana — itu konsisten, bukan side-effect berbahaya).

## 4. Tantangan jujur (pushback)

**Weakest assumption**: Web app tidak bisa membuka Settings > Date & Time perangkat (tidak ada API browser-nya, beda dengan native Talenta yang punya `ACTION_DATE_SETTINGS` intent). Jadi tombol "Atur waktu sekarang" hanya **instruksi text**, bukan deep-link. UX-nya sedikit lebih lemah dari Talenta, user harus keluar app manual.

**Yang bisa gagal**:
- Jaringan lambat → RTT > 5 detik bisa salah hitung skew. Mitigasi: jangan blokir kalau RTT > 3s, anggap measurement invalid, retry.
- User di pesawat / offline → `time-sync` gagal → kita pilih **tidak blokir** (false negative dapat ditoleransi karena server tetap pakai `now()` saat sync nanti).
- Browser di-throttle background → interval 5 menit bisa molor; itu OK, recheck wajib dilakukan tepat sebelum aksi presensi.

**Yang harus diverifikasi**:
- Cobalah ubah jam HP mundur 5 menit → buka app → modal muncul → tombol Clock In disabled.
- Aktifkan auto-time → tekan "Cek ulang" di modal → modal tertutup → tombol enabled.
- Matikan jaringan → tidak ada modal palsu (tidak boleh blokir karena server unreachable).
- Skew 90 detik (di bawah threshold) → tidak blokir, tetap masuk soft-warning + flag.

**Versi yang lebih baik**: Threshold bisa kita bikin dua tingkat:
- `< 120s` → tidak ada apa-apa,
- `120s–600s` → modal soft (boleh ditutup, tombol tetap enable + soft warning toast),
- `> 600s` → modal hard blocking.

Saya **tidak rekomendasikan** dua tingkat untuk sekarang — over-engineering. Mulai dengan satu threshold 120s + hard block. Naikkan ke 2 tingkat hanya jika ada keluhan false positive dari user.

## 5. Final recommendation
Build: edge function `time-sync` + hook `useClockSkewGuard` + komponen `ClockInvalidDialog` + integrasi disable tombol di `AttendanceForm`. Pertahankan layer soft-warning + flag yang sudah ada sebagai audit trail. Threshold 120s, behavior fail-open jika network gagal.

Setuju lanjut implementasi?
