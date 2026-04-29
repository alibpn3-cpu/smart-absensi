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

### Periode (pilih SALAH SATU mode)

**Mode A — Range bulan (disarankan):**
| Param | Wajib | Tipe | Keterangan |
|---|---|---|---|
| `start_month` | ✅ | int 1–12 | Bulan awal |
| `start_year`  | ✅ | int      | Tahun awal |
| `end_month`   | ✅ | int 1–12 | Bulan akhir |
| `end_year`    | ✅ | int      | Tahun akhir |

**Mode B — Bulan tunggal (backward-compat):**
| Param | Wajib | Tipe | Keterangan |
|---|---|---|---|
| `month` | ✅ | int 1–12 | Bulan |
| `year`  | ✅ | int      | Tahun |

**Mode C — Tanggal eksak:**
| Param | Wajib | Tipe | Keterangan |
|---|---|---|---|
| `start_date` | ✅ | YYYY-MM-DD | Tanggal awal |
| `end_date`   | ✅ | YYYY-MM-DD | Tanggal akhir |

### Filter umum
| Param | Wajib | Tipe | Keterangan |
|---|---|---|---|
| `activity` | ❌ | `both` \| `p2h` \| `toolbox` | Default `both`. `p2h` → hanya record dengan `p2h_checked=true`. `toolbox` → hanya `toolbox_checked=true`. Kolom yang dikembalikan menyesuaikan. |
| `work_area` | ❌ | string | Filter berdasarkan work area karyawan |
| `staff_uid` | ❌ | string | Filter satu karyawan tertentu |
| `format` | ❌ | `json` \| `csv` | Default `json` |

## Response — JSON

```json
{
  "period": { "start": "2026-03-01", "end": "2026-04-30" },
  "activity": "both",
  "count": 2,
  "data": [
    {
      "id": "f7c1...",
      "checklist_date": "2026-03-15",
      "staff_uid": "EMP001",
      "staff_name": "Budi Santoso",
      "created_at": "2026-03-15T00:12:34.000Z",
      "p2h_checked": true,
      "p2h_photo_url": "https://.../p2h-photos/EMP001/2026-03-15-p2h.jpg",
      "toolbox_checked": true,
      "toolbox_photo_url": "https://.../p2h-photos/EMP001/2026-03-15-tbm.jpg"
    }
  ]
}
```

Bila `activity=p2h` → field `toolbox_*` tidak disertakan (vice versa).

## Response — CSV

Bila `format=csv`, response berupa file CSV dengan header `Content-Type: text/csv` dan `Content-Disposition: attachment`. Kolom mengikuti `activity`.

## Error Format

```json
{ "error": "Pesan kesalahan" }
```

Status code: `400` (param invalid), `401` (auth gagal), `405` (method bukan GET), `500` (server error).

---

## Contoh Pemanggilan

### cURL — range 2 bulan, hanya P2H, CSV

```bash
curl -X GET "https://spqakoyhyziuxfgdkgpm.supabase.co/functions/v1/p2h-toolbox-export?start_month=3&start_year=2026&end_month=4&end_year=2026&activity=p2h&format=csv" \
  -H "x-api-key: YOUR_EXTERNAL_API_KEY" \
  -o p2h_q1.csv
```

### cURL — single month, semua kegiatan

```bash
curl -X GET "https://spqakoyhyziuxfgdkgpm.supabase.co/functions/v1/p2h-toolbox-export?month=4&year=2026" \
  -H "x-api-key: YOUR_EXTERNAL_API_KEY"
```

### JavaScript (fetch)

```javascript
const BASE = 'https://spqakoyhyziuxfgdkgpm.supabase.co/functions/v1/p2h-toolbox-export';
const API_KEY = 'YOUR_EXTERNAL_API_KEY';

async function getP2HRange({ startMonth, startYear, endMonth, endYear, activity = 'both', workArea, staffUid, format = 'json' }) {
  const params = new URLSearchParams({
    start_month: startMonth, start_year: startYear,
    end_month: endMonth, end_year: endYear,
    activity, format,
  });
  if (workArea) params.set('work_area', workArea);
  if (staffUid) params.set('staff_uid', staffUid);

  const res = await fetch(`${BASE}?${params}`, { headers: { 'x-api-key': API_KEY } });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
  return format === 'csv' ? res.text() : res.json();
}

// Contoh: Toolbox Meeting Maret–April 2026 di Site A
const data = await getP2HRange({
  startMonth: 3, startYear: 2026, endMonth: 4, endYear: 2026,
  activity: 'toolbox', workArea: 'Site A',
});
console.log(data.count, data.data);
```

### Python (requests)

```python
import requests

BASE = "https://spqakoyhyziuxfgdkgpm.supabase.co/functions/v1/p2h-toolbox-export"
API_KEY = "YOUR_EXTERNAL_API_KEY"

def get_p2h_range(start_month, start_year, end_month, end_year, activity="both", **filters):
    params = {
        "start_month": start_month, "start_year": start_year,
        "end_month": end_month, "end_year": end_year,
        "activity": activity, **filters,
    }
    r = requests.get(BASE, params=params, headers={"x-api-key": API_KEY}, timeout=30)
    r.raise_for_status()
    return r.json()

data = get_p2h_range(3, 2026, 4, 2026, activity="p2h", work_area="Site A")
print(data["count"])
for row in data["data"]:
    print(row["checklist_date"], row["staff_name"], row.get("p2h_photo_url"))
```

### PHP (cURL)

```php
$qs = http_build_query([
  'start_month' => 3, 'start_year' => 2026,
  'end_month'   => 4, 'end_year'   => 2026,
  'activity'    => 'toolbox',
]);
$url = "https://spqakoyhyziuxfgdkgpm.supabase.co/functions/v1/p2h-toolbox-export?$qs";

$ch = curl_init($url);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, ['x-api-key: YOUR_EXTERNAL_API_KEY']);
$resp = curl_exec($ch);
$data = json_decode($resp, true);
print_r($data);
```

---

## Catatan Keamanan

- **Jangan** commit API key ke git publik. Simpan di env / secret manager aplikasi pemanggil.
- Untuk rotasi key, update secret `EXTERNAL_API_KEY` di Supabase Dashboard → Edge Functions → Secrets.
- Endpoint **read-only** (hanya GET).
- Foto berada di bucket `p2h-photos` (public). URL bisa diakses langsung tanpa auth.
