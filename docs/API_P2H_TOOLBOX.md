# API P2H Prestart Checklist & Toolbox Meeting

REST API untuk mengambil data checklist P2H (Prestart) & Toolbox Meeting beserta link foto evidence-nya. Cocok untuk diintegrasikan ke dashboard / aplikasi eksternal.

## Base URL

```
https://spqakoyhyziuxfgdkgpm.supabase.co/functions/v1/p2h-toolbox-export
```

## Autentikasi

Setiap request **wajib** menyertakan header:

| Header | Value |
|---|---|
| `x-api-key` | API key yang sudah di-set di Supabase Secret `EXTERNAL_API_KEY` |

Request tanpa header / dengan key salah → `401 Unauthorized`.

## Method

`GET`

## Query Parameters

| Param | Wajib | Tipe | Keterangan |
|---|---|---|---|
| `month` | ✅ | int 1–12 | Bulan |
| `year` | ✅ | int | Tahun (cth: `2026`) |
| `work_area` | ❌ | string | Filter berdasarkan work area karyawan |
| `staff_uid` | ❌ | string | Filter satu karyawan tertentu |
| `format` | ❌ | `json` \| `csv` | Default `json` |

## Response — JSON

```json
{
  "month": 4,
  "year": 2026,
  "count": 2,
  "period": { "start": "2026-04-01", "end": "2026-04-30" },
  "data": [
    {
      "id": "f7c1...",
      "checklist_date": "2026-04-01",
      "staff_uid": "EMP001",
      "staff_name": "Budi Santoso",
      "p2h_checked": true,
      "p2h_photo_url": "https://spqakoyhyziuxfgdkgpm.supabase.co/storage/v1/object/public/p2h-photos/EMP001/2026-04-01-p2h.jpg",
      "toolbox_checked": true,
      "toolbox_photo_url": "https://spqakoyhyziuxfgdkgpm.supabase.co/storage/v1/object/public/p2h-photos/EMP001/2026-04-01-tbm.jpg",
      "created_at": "2026-04-01T00:12:34.000Z",
      "updated_at": "2026-04-01T00:15:01.000Z"
    }
  ]
}
```

## Response — CSV

Bila `format=csv`, response berupa file CSV dengan header `Content-Type: text/csv` dan `Content-Disposition: attachment`.

## Error Format

```json
{ "error": "Pesan kesalahan" }
```

Status code yang mungkin: `400` (param invalid), `401` (auth gagal), `405` (method bukan GET), `500` (server error).

---

## Contoh Pemanggilan

### cURL

```bash
curl -X GET "https://spqakoyhyziuxfgdkgpm.supabase.co/functions/v1/p2h-toolbox-export?month=4&year=2026" \
  -H "x-api-key: YOUR_EXTERNAL_API_KEY"
```

Filter + CSV:

```bash
curl -X GET "https://spqakoyhyziuxfgdkgpm.supabase.co/functions/v1/p2h-toolbox-export?month=4&year=2026&work_area=Site%20A&format=csv" \
  -H "x-api-key: YOUR_EXTERNAL_API_KEY" \
  -o p2h_april.csv
```

### JavaScript (fetch)

```javascript
const BASE = 'https://spqakoyhyziuxfgdkgpm.supabase.co/functions/v1/p2h-toolbox-export';
const API_KEY = 'YOUR_EXTERNAL_API_KEY';

async function getP2H(month, year, opts = {}) {
  const params = new URLSearchParams({ month, year, ...opts });
  const res = await fetch(`${BASE}?${params}`, {
    headers: { 'x-api-key': API_KEY },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
  return res.json();
}

// Pemakaian
const data = await getP2H(4, 2026, { work_area: 'Site A' });
console.log(data.count, data.data);
```

### Python (requests)

```python
import requests

BASE = "https://spqakoyhyziuxfgdkgpm.supabase.co/functions/v1/p2h-toolbox-export"
API_KEY = "YOUR_EXTERNAL_API_KEY"

def get_p2h(month: int, year: int, **filters):
    params = {"month": month, "year": year, **filters}
    r = requests.get(BASE, params=params, headers={"x-api-key": API_KEY}, timeout=30)
    r.raise_for_status()
    return r.json()

data = get_p2h(4, 2026, work_area="Site A")
print(data["count"])
for row in data["data"]:
    print(row["checklist_date"], row["staff_name"], row["p2h_photo_url"])
```

### PHP (cURL)

```php
$url = 'https://spqakoyhyziuxfgdkgpm.supabase.co/functions/v1/p2h-toolbox-export?month=4&year=2026';
$ch = curl_init($url);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, ['x-api-key: YOUR_EXTERNAL_API_KEY']);
$resp = curl_exec($ch);
$data = json_decode($resp, true);
print_r($data);
```

---

## Catatan Keamanan

- **Jangan** commit API key ke git publik. Simpan di env variable / secret manager aplikasi pemanggil.
- Untuk rotasi key, update secret `EXTERNAL_API_KEY` di Supabase Dashboard → Edge Functions → Secrets.
- Endpoint **read-only** (hanya GET). Tidak ada operasi tulis / update yang tersedia.
- Foto berada di bucket `p2h-photos` (public). URL bisa diakses langsung tanpa auth.
