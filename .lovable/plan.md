
## 1) Dukungan 3 Shift (Shift Malam Lintas Tengah Malam) — khusus PHAS - BATU AMPAR

**Konsep inti: "Work Date" (tanggal kerja) ≠ "Calendar Date" (tanggal kalender)**

Saat ini semua record disimpan dengan `date = tanggal kalender clock-in`. Ini pecah untuk shift malam (23:00 → 07:00 besok) karena clock-out dianggap hari baru.

**Solusi: tambah shift preset per user + pinned work date**

### Database (migration baru)
- `staff_users.shift_type` TEXT default `'regular'` — nilai: `regular`, `shift_morning` (07-15), `shift_afternoon` (15-23), `shift_night` (23-07).
- `attendance_records.shift_type` TEXT — snapshot shift saat clock-in.
- `attendance_records.work_date` DATE — tanggal kerja logis (untuk shift night = tanggal saat clock-in walau clock-out di hari berikut).
- Backfill: `work_date = date` untuk semua record lama.

### Logika Clock-In
- User dengan `shift_type = shift_night`: window valid clock-in `20:00–03:59`. Jika clock-in `≥ 20:00` → `work_date = tanggal hari ini`. Jika clock-in `00:00–03:59` → `work_date = kemarin` (lanjut shift semalam).
- Shift lain: `work_date = tanggal hari ini` (tidak berubah).

### Logika Clock-Out (kunci masalah user)
- Cek "open shift" berdasarkan `work_date + shift_type` (bukan `date` kalender).
- Untuk `shift_night`: setelah tengah malam, sistem tetap mengenali user masih dalam shift kemarin (belum clock-out), sehingga clock-out `04:00–10:00` akan menutup record `work_date` kemarin, bukan bikin record baru.
- Reset harian di tengah malam **dilewati** untuk user shift_night yang masih open.

### Score & Rekap
- `calculate-daily-scores`, exporter, ranking, dashboard filter → semua diubah dari filter `date` menjadi `work_date`.
- Deadline late untuk shift dibaca dari preset shift, bukan `work_area_schedules` default.

### UI
- **Employee Manager**: dropdown "Shift Type" (Regular / Pagi / Sore / Malam).
- **AttendanceForm**: header user memperlihatkan badge shift jika bukan regular; validasi window clock-in disesuaikan shift.
- **Kompatibilitas**: user non-PHAS / `shift_type = regular` → perilaku 100% seperti sekarang (aditif, tidak mengubah workflow existing).

---

## 2) Perbaikan Dialog Edit Employee — lebih lebar, tidak terlalu panjang

- Ubah `DialogContent` menjadi `sm:max-w-4xl` (dari default sempit).
- Grid 2 kolom pada layar `md+`: pasangan field kiri-kanan (mis. Nama | UID, Position | Work Area, Division | Employee Type, WhatsApp | Email, Tanggal Mulai | Atasan, HC&GA | Toggles).
- `max-h-[85vh] overflow-y-auto` tetap dipertahankan untuk fallback layar kecil.
- Field toggle (Site Admin, Show Status, dll) dijadikan grid 2 kolom di bawah.

---

## 3) Ranking Card — tampilkan Work Area di sebelah nama

- Ambil `work_area` dari `staff_users` bersamaan dengan `photo_url` (query yang sudah ada).
- Simpan di objek `RankingUser` sebagai `work_area?: string`.
- Render di list tier: nama tetap seperti sekarang, di bawahnya (atau di kanan dengan `text-[10px] text-muted-foreground truncate`) tampilkan work area.

Layout list: `Nama Karyawan · text-xs muted work_area` — muat 1 baris via `truncate`.

---

## 4) Aktivasi Notifikasi Cuti & Ijin (WA Meta + Email api.co.id)

Wiring sudah ada (`notifyRequestSubmitted`, `notifyApproverNewRequest`, `notifyStatusUpdate` dipanggil di LeaveRequestForm, PermissionRequestForm, RequestApprovalDialog). Yang perlu dipastikan/perbaiki:

- Audit `src/utils/notificationHelper.ts` — pastikan memanggil edge function `send-whatsapp-notification` (Meta) dan `send-email-notification` untuk 3 event: submit user, notif approver baru, update status ke pemohon.
- Audit edge function `send-whatsapp-notification` → memakai `META_TOKEN` + `META_PHONE_ID` (sudah ada di secrets) dengan throttle 3 detik.
- Audit `send-email-notification` → memakai SMTP secrets yang sudah ada (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM_EMAIL`).
- Tambah logging ke `debug_logs` bila gagal kirim, supaya user bisa cek di Debug Log Viewer.
- Template pesan WA & email untuk: Pengajuan Cuti (baru), Approver Notifikasi Approval, Status Cuti (approved/rejected). Sama untuk Ijin.
- Tidak menambah tabel baru; hanya memastikan pipeline berjalan end-to-end.

Setelah implementasi, saya akan minta Anda melakukan test submit 1 pengajuan cuti untuk memverifikasi WA + email terkirim, dan cek Edge Function logs jika ada error.

---

## Urutan Kerja
1. Migration DB (shift_type + work_date + backfill).
2. Update AttendanceForm (clock-in/out logic + reset skip untuk night shift).
3. Update EmployeeManager (dropdown shift + dialog width & layout 2 kolom).
4. Update `calculate-daily-scores`, Exporter, Dashboard, RankingCard → pakai `work_date`.
5. Tambah `work_area` di RankingCard.
6. Audit & aktifkan notifikasi cuti/ijin (WA + email).

