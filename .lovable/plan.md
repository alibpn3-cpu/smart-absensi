## Tujuan
1. Tambahkan fitur **Export Excel** untuk data **P2H Prestart Checklist & Toolbox Meeting** di dashboard admin, dengan filter bulan/tahun + kolom link foto evidence.
2. Sediakan **REST API publik** (Supabase Edge Function) yang sama untuk diakses dari aplikasi dashboard eksternal, lengkap dengan dokumentasi & contoh kode pemanggilan.

---

## Bagian 1 — Export Excel di Admin Dashboard

### Komponen baru: `src/components/P2HToolboxExporter.tsx`
- Filter: **Bulan** (1–12) + **Tahun**, opsional filter **Work Area** & **Staff UID**.
- Tombol **Export Excel** menggunakan library `exceljs` (sudah dipakai di project — lihat memory `excel-export-styling-system`) agar styling konsisten: header biru `FF3B82F6`, teks putih bold, frozen header, auto-filter, border tipis.
- Query ke tabel `p2h_toolbox_checklist` (filter `checklist_date` antara awal–akhir bulan).
- Kolom yang diexport:
  | No | Tanggal | UID | Nama | P2H Checked | P2H Photo (link) | Toolbox Checked | Toolbox Photo (link) | Created At |
  Kolom foto memakai URL langsung dari `p2h_photo_url` & `toolbox_photo_url` (bucket `p2h-photos` sudah public) sebagai hyperlink yang bisa di-klik di Excel.

### Integrasi ke Dashboard
- Tambah komponen `<P2HToolboxExporter />` di `src/pages/Dashboard.tsx`, ditempatkan di tab yang sama dengan `<AttendanceExporter />` (atau buat sub-section "Prestart & Toolbox") agar admin punya satu tempat export.

---

## Bagian 2 — REST API Publik untuk Integrasi Eksternal

### Edge Function baru: `supabase/functions/p2h-toolbox-export/index.ts`
- Method: **GET**
- `verify_jwt = false` (di `supabase/config.toml`) supaya bisa dipanggil dari aplikasi luar.
- **Auth via API key custom**: header `x-api-key` dicek terhadap secret baru `EXTERNAL_API_KEY` (akan diminta lewat `add_secret`). Jika tidak cocok → 401.
- Query params:
  - `month` (1–12, wajib) 
  - `year` (wajib)
  - `work_area` (opsional)
  - `staff_uid` (opsional)
  - `format` = `json` (default) atau `csv`
- Memakai `SUPABASE_SERVICE_ROLE_KEY` internal untuk membaca tabel.
- Response JSON contoh:
  ```json
  {
    "month": 4, "year": 2026, "count": 23,
    "data": [
      {
        "id": "...", "checklist_date": "2026-04-01",
        "staff_uid": "EMP001", "staff_name": "Budi",
        "p2h_checked": true, "p2h_photo_url": "https://.../p2h-photos/...jpg",
        "toolbox_checked": true, "toolbox_photo_url": "https://.../...jpg",
        "created_at": "2026-04-01T00:12:00Z"
      }
    ]
  }
  ```
- CORS aktif (`Access-Control-Allow-Origin: *`) supaya bisa dipanggil dari browser dashboard eksternal.

### Dokumentasi: `docs/API_P2H_TOOLBOX.md`
Berisi:
- Base URL: `https://spqakoyhyziuxfgdkgpm.supabase.co/functions/v1/p2h-toolbox-export`
- Header wajib: `x-api-key: <YOUR_KEY>`
- Tabel parameter
- Response schema
- **Contoh kode** dalam 3 bahasa:
  - **cURL**
  - **JavaScript (fetch)**
  - **Python (requests)**
- Catatan rate limit & contoh error response.

### Secrets
Akan minta user menambahkan **`EXTERNAL_API_KEY`** (string acak buatan user) lewat `add_secret`. SMTP/Supabase secrets sudah ada.

---

## Ringkasan File yang Akan Diubah/Dibuat
| File | Aksi |
|---|---|
| `src/components/P2HToolboxExporter.tsx` | baru (UI export Excel) |
| `src/pages/Dashboard.tsx` | tambah komponen exporter |
| `supabase/functions/p2h-toolbox-export/index.ts` | baru (REST API) |
| `supabase/config.toml` | tambah entry function `verify_jwt = false` |
| `docs/API_P2H_TOOLBOX.md` | dokumentasi API + contoh kode |
| Secret `EXTERNAL_API_KEY` | diminta ke user |

---

## Catatan Keamanan
- API key disimpan di Supabase Secrets, tidak di-hardcode.
- Edge function hanya **read-only** (SELECT) — tidak mengekspos endpoint write.
- Hyperlink foto memakai bucket `p2h-photos` yang memang public (sudah dikonfirmasi di storage buckets).
