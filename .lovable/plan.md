## 1. Hapus P2H & Toolbox dari User Primary + Samakan Bobot Score

**Yang dihapus / diubah (additive-safe, tabel tetap ada untuk data historis):**
- `AttendanceForm.tsx` — hapus render `<P2HToolboxCard />` (baris ~2789) beserta importnya.
- `AttendanceForm.tsx` — pada payload `attendanceData` (baris 288, dsb.) tetap kirim `employee_type` tapi kolom `p2h_checked` / `toolbox_checked` tidak lagi memicu UI.
- Edge Function `calculate-daily-scores/index.ts`:
  - `getClockInPenalty()` & `getClockOutPenalty()` — hapus cabang `employeeType === 'primary'`, pakai skala staff (in: −15/−25/−35, out: −15/−25/−35 dengan penalty tanpa clock-out −50) untuk **semua** user.
  - Hapus `p2hPenalty` & `toolboxPenalty` dari `calculateScore`; tetap simpan `p2h_score: 0` & `toolbox_score: 0` ke `daily_scores` supaya kolom lama tidak null (backward compat laporan).
- **Tidak dihapus** (agar tidak merusak):
  - Tabel `p2h_toolbox_checklist` dan `daily_scores.p2h_score/toolbox_score` — dibiarkan; data lama tetap terbaca.
  - Menu & endpoint export P2H/TBM di panel admin (`P2HToolboxExporter`, edge function `p2h-toolbox-export`) — dibiarkan untuk audit historis. (Bisa saya sembunyikan juga bila diminta di iterasi berikutnya.)
- `ScoreReport.tsx` & `ScoreExporter.tsx` — kolom p2h/toolbox tetap ditampilkan (isi 0 untuk data baru) supaya tidak ada regresi format Excel.

**Hasil:** Primary tidak lagi dinilai berdasarkan P2H/TBM. Rumus bintang sama dengan staff — bobot in −35, out −35, no-clockout −50 → max 100 → 5 bintang.

## 2. Home Page — Card "Menyatu" (Seamless Look)

Perubahan **kosmetik saja** di `AttendanceForm.tsx` dan komponen anak yang berada di container utama. Tidak ada perubahan logic, tidak menyentuh session/auth.

**Pola visual (glass-panel unified):**
- Bungkus rangkaian card di home page dalam satu wrapper `bg-card/60 backdrop-blur-xl border border-white/5 rounded-3xl shadow-2xl p-3 sm:p-4 space-y-3` (satu "panel besar" ala Apple).
- Untuk tiap card anak (BirthdayCard, AnnouncementsCarousel, CompanyLogoCard, RankingCard, ScoreCard-in-sidebar tidak tersentuh), turunkan intensitas: `border-0 shadow-none bg-transparent` atau `bg-white/[0.02]`, radius `rounded-2xl`, padding konsisten `p-4`.
- Pemisah antar card: subtle divider `divide-y divide-white/5` atau gap saja — bukan border tebal.
- Tetap responsif: wrapper pakai `max-w-md mx-auto w-full`, semua card `w-full`, tidak ada fixed width.
- Conditional cards (Shift selector, Announcements per work_area, Ranking hanya kalau `scoreEnabled`, Birthday hanya kalau ada hari ulang tahun) tetap `null`-return seperti sekarang — panel wrapper tetap terlihat rapi karena `space-y-3` collapse otomatis pada child kosong.

**Yang tidak diubah:** header, tombol Clock In/Out neon, dialog, session/localStorage, service worker — jadi tidak ada risiko logout atau cache invalidation.

## 3. History Clock In/Out di Sidebar (Filter Tanggal)

**File baru:** `src/components/AttendanceHistoryDialog.tsx`
- Dialog (bukan halaman baru) yang query `attendance_records` untuk `staff_uid = userSession.uid`.
- Filter: date range (default 7 hari terakhir) + preset chip (Hari Ini, 7 Hari, 30 Hari, Bulan Ini).
- Tampilkan list card per tanggal: tanggal, status, clock-in time, clock-out time, work area, badge "Tidak Clock Out" bila `check_out_time` null.
- Read-only, no export (bisa ditambah nanti).
- Pagination client-side (25/hal) untuk hemat query.

**Wiring di `UserSidebar.tsx`:**
- Tambah tombol "Riwayat Absensi" di grup Navigation Items (di bawah "Notifikasi") dengan icon `History` (lucide) — buka dialog di atas.

**Query:** `select('date,check_in_time,check_out_time,status,attendance_type,work_area').eq('staff_uid', uid).gte('date', from).lte('date', to).order('date',{ascending:false}).limit(200)` — hanya baca, tanpa policy baru (RLS existing sudah izinkan user membaca record sendiri).

## Technical Details

- **DB migrations**: tidak diperlukan. Semua perubahan client-side + edge function.
- **Edge function redeploy**: `calculate-daily-scores` di-update; auto-deploy oleh platform.
- **Backward compat**: kolom `p2h_score`/`toolbox_score` tetap ditulis (0), export lama tetap valid.
- **Feature flag**: tidak ada flag baru — perubahan langsung berlaku.
- **Risiko logout**: nol. Tidak ada perubahan cache-key, service worker, atau localStorage session.
