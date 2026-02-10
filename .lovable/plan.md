
# Rencana Perbaikan

## 1. Bug: Tombol "Ambil Foto" Disabled (Marianus - Android 10)

### Analisis Root Cause

Di `CameraCapture.tsx` baris 43-52, sebelum memanggil `getUserMedia`, ada pengecekan:

```typescript
const permissions = await navigator.permissions.query({ name: 'camera' as PermissionName });
if (permissions.state === 'denied') {
  // return early - stream TIDAK pernah di-set
}
```

Masalah: `navigator.permissions.query({ name: 'camera' })` **tidak didukung secara konsisten** di Android WebView dan Chrome versi lama. Pada beberapa device Android 10, API ini bisa:
- Throw error (tertangkap catch, lalu dialog muncul - bukan kasus ini)
- Return `'denied'` padahal kamera sebenarnya bisa diakses (kasus Marianus)

Karena function return early sebelum `getUserMedia` dipanggil, `stream` tetap `null`, dan tombol tetap disabled (`disabled={!stream}`).

### Solusi

Hapus pre-check `navigator.permissions.query` dan langsung panggil `getUserMedia`. Jika gagal, error handler yang sudah ada akan menangani (dialog konfirmasi muncul). Ini lebih reliable karena `getUserMedia` adalah satu-satunya cara pasti untuk tahu apakah kamera bisa diakses.

### Perubahan Code

**File:** `src/components/CameraCapture.tsx`

Hapus baris 42-52 (permissions.query pre-check), langsung ke `getUserMedia`:

```typescript
const startCamera = async () => {
  try {
    // Langsung request camera - jangan pre-check permissions
    // karena navigator.permissions.query('camera') tidak reliable di semua Android
    const mediaStream = await navigator.mediaDevices.getUserMedia({
      video: { 
        facingMode: 'user',
        width: { ideal: 640 },
        height: { ideal: 480 }
      },
      audio: false
    });
    
    setStream(mediaStream);
    if (videoRef.current) {
      videoRef.current.srcObject = mediaStream;
    }
    localStorage.setItem('camera_permission_granted', 'true');
    
  } catch (error: any) {
    // ... existing error handling tetap sama
  }
};
```

---

## 2. ScoreCard: Ganti "Score Kemarin" ke "Total Bintang Bulan Ini"

### Konsep

Ganti dari menampilkan score 1 hari kemarin menjadi akumulasi total bintang dari tanggal 1 bulan berjalan sampai hari kemarin. Reset otomatis setiap tanggal 1.

Contoh:
- Tanggal 3: total = score tgl 1 + score tgl 2
- Tanggal 1: total = 0 (belum ada data bulan ini)

### Apakah Berat?

**Tidak berat.** Query-nya sederhana:

```sql
SELECT SUM(final_score) as total
FROM daily_scores
WHERE staff_uid = ?
AND score_date >= '2026-02-01'  -- tanggal 1 bulan ini
AND score_date < '2026-02-10'   -- hari ini (tidak termasuk hari ini)
```

Ini single aggregate query yang sangat ringan, sama beratnya dengan query score kemarin yang sudah ada.

### Perubahan Code

**File:** `src/hooks/useScoreCalculation.ts`

Tambah function baru:

```typescript
export const getMonthlyAccumulatedScore = async (staffUid: string): Promise<number | null> => {
  const today = new Date();
  const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const firstOfMonthStr = firstOfMonth.toISOString().split('T')[0];
  const todayStr = today.toISOString().split('T')[0];

  // Jika tanggal 1, belum ada data bulan ini
  if (firstOfMonthStr === todayStr) return null;

  const { data, error } = await supabase
    .from('daily_scores')
    .select('final_score')
    .eq('staff_uid', staffUid)
    .gte('score_date', firstOfMonthStr)
    .lt('score_date', todayStr);

  if (error || !data || data.length === 0) return null;

  return data.reduce((sum, row) => sum + Number(row.final_score), 0);
};
```

**File:** `src/components/ScoreCard.tsx`

Update untuk menampilkan total akumulasi bulan ini:

- Import `getMonthlyAccumulatedScore` (ganti `getYesterdayScore`)
- Tampilkan total bintang (bukan score 0-5)
- Ubah label: "Score Kemarin" menjadi "Total Bintang Bulan Ini"
- Tampilkan angka total (misal: "45.5 bintang") tanpa star rating 1-5
- Hapus render stars (karena total bisa lebih dari 5)
- Tampilkan icon bintang tunggal dengan angka total

### UI Baru ScoreCard

```
┌──────────────────────────────────────┐
│ Total Bintang Bulan Ini              │
│ Februari 2026            ⭐ 45.5     │
└──────────────────────────────────────┘
```

---

## Ringkasan

| File | Perubahan |
|------|-----------|
| `src/components/CameraCapture.tsx` | Hapus `navigator.permissions.query` pre-check, langsung `getUserMedia` |
| `src/hooks/useScoreCalculation.ts` | Tambah `getMonthlyAccumulatedScore()` |
| `src/components/ScoreCard.tsx` | Ganti dari score kemarin ke total bintang bulan ini |

