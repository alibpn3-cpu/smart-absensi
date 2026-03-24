

# Rencana: Reminder Clock-Out Otomatis via WhatsApp

## Analisis Beban Sistem

**Tidak memberatkan.** Prosesnya:
1. Satu query SQL sederhana ke `attendance_records` + `staff_users` pada jam 22:00 WIB (sekali sehari)
2. Filter: user yang punya `check_in_time` hari ini tapi `check_out_time` NULL
3. Kirim WhatsApp ke yang punya `phone_number` — biasanya hanya 5-20 user yang lupa, bukan 380

Sama ringannya dengan `calculate-daily-scores` yang sudah berjalan setiap malam.

---

## Implementasi

### 1. Edge Function Baru: `remind-clock-out`

- Dipanggil via pg_cron setiap hari jam `22:00 WIB` (14:00 UTC karena WIB = UTC+7)
- Query: `attendance_records` WHERE `date = today` AND `check_in_time IS NOT NULL` AND `check_out_time IS NULL`
- Join `staff_users` untuk dapat `phone_number` dan `name`
- Untuk setiap user yang belum clock out dan punya nomor WhatsApp, panggil Fonnte API langsung dari function ini (batch, bukan satu-satu via invoke)
- Log jumlah reminder yang dikirim

### 2. Pesan WhatsApp

```
⏰ *Reminder Clock Out*

Halo {nama},

Anda belum melakukan clock out hari ini. 
Silakan segera clock out melalui aplikasi:
https://absensi.petrolog.my.id

_Pesan otomatis dari Digital Presensi_
```

### 3. pg_cron Job (via SQL insert tool)

```sql
SELECT cron.schedule(
  'remind-clock-out-daily',
  '0 15 * * *',   -- 15:00 UTC = 22:00 WIB = 23:00 WITA
  $$ SELECT net.http_post(
    url := '...edge function URL...',
    headers := '{"Authorization": "Bearer ..."}',
    body := '{}'
  ) $$
);
```

### 4. Update WhatsApp Edge Function

Tambah `message_type: 'clock_out_reminder'` ke `send-whatsapp-notification` agar bisa reuse, ATAU kirim langsung dari `remind-clock-out` function (lebih efisien untuk batch).

**Pilihan: kirim langsung dari function** — lebih efisien karena 1 function call, loop internal, bukan N invoke calls.

---

## File yang Dibuat/Diubah

| File | Perubahan |
|------|-----------|
| `supabase/functions/remind-clock-out/index.ts` | Edge Function baru |
| `supabase/config.toml` | Tambah config function |
| pg_cron job (via insert tool) | Schedule harian 22:00 WIB |

---

## Catatan

- Hanya user dengan `phone_number` yang terisi yang akan dapat reminder
- Tidak ada email reminder (hanya WhatsApp) — bisa ditambah nanti jika perlu
- Rate limit Fonnte: ~20 user lupa clock out × 1 pesan = sangat ringan
- Tidak mengganggu fungsi existing apapun

