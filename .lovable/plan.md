
# Rencana Implementasi

## Ringkasan Perubahan
1. **RankingCard Enhancement** - Tampilkan total score + ranking 1-20 per tier dengan auto-slide
2. **StatusPresensiDialog Fix** - Prevent auto-focus ke textarea di mobile

---

## 1. RankingCard Enhancement

### Analisis Perhitungan Saat Ini

Data Januari 2026 menunjukkan:
- 11 user memiliki avg score 5.00 (perfect)
- FATONI ICHWAN dengan 21 hari kerja dan total 104.3 score ada di ranking 12 karena avg 4.97

### Rekomendasi: Gunakan Kombinasi Average + Total

**Logika baru:**
- Primary sort: Average score (DESC)
- Secondary sort: Total score (DESC) - untuk tie-breaker
- Tampilkan keduanya: `⭐4.97 (104.3)`

Ini lebih fair karena jika avg sama, yang lebih rajin (total lebih tinggi) di atas.

### Perubahan UI

**A. Tampilkan Total Score:**
```typescript
// Di RankingUser interface, tambah:
interface RankingUser {
  staff_uid: string;
  staff_name: string;
  avg_score: number;
  total_score: number;  // BARU
  total_days: number;   // BARU (opsional)
  photo_url?: string;
}
```

**B. Expand MAX_USERS_PER_TIER dari 5 ke 20:**
```typescript
const MAX_USERS_PER_TIER = 20; // Sebelumnya 5
```

**C. Pagination/Slide per 5 user dalam satu tier:**

Jika tier punya >5 user, bagi jadi beberapa "page" dalam carousel nested:

```text
Platinum Tier (20 users)
┌─────────────────────────┐
│ Slide 1: #1-5           │
│ Slide 2: #6-10          │
│ Slide 3: #11-15         │
│ Slide 4: #16-20         │
└─────────────────────────┘
Auto-slide setiap 5 detik
```

**D. Update Display:**
```typescript
// Sebelum:
⭐4.97

// Sesudah:
⭐4.97 (104⭐)  // avg (total)
```

### File yang Diubah
- `src/components/RankingCard.tsx`

---

## 2. StatusPresensiDialog Focus Fix

### Masalah
DialogContent dari Radix UI auto-focus ke elemen interaktif pertama. Textarea mendapat focus, memicu keyboard di mobile yang menutupi status selection.

### Solusi
Gunakan `onOpenAutoFocus` event dari DialogContent untuk prevent default dan focus ke elemen lain (atau tidak focus sama sekali).

### Perubahan Code

**File:** `src/components/StatusPresensiDialog.tsx`

```typescript
// Tambah ref untuk tombol konfirmasi
const confirmButtonRef = useRef<HTMLButtonElement>(null);

// Di DialogContent, tambah onOpenAutoFocus:
<DialogContent 
  className="max-w-md"
  onOpenAutoFocus={(e) => {
    e.preventDefault();
    // Opsional: focus ke tombol konfirmasi
    // confirmButtonRef.current?.focus();
  }}
>
```

Dengan `e.preventDefault()`, dialog tidak akan auto-focus ke textarea, sehingga keyboard mobile tidak muncul otomatis.

### File yang Diubah
- `src/components/StatusPresensiDialog.tsx`

---

## Ringkasan Teknis

| File | Perubahan |
|------|-----------|
| `src/components/RankingCard.tsx` | - MAX_USERS_PER_TIER: 5 → 20<br>- Tambah total_score di interface<br>- Update query untuk fetch SUM<br>- Secondary sort by total_score<br>- Pagination/chunk per 5 user dalam tier<br>- Display format: `⭐avg (total)` |
| `src/components/StatusPresensiDialog.tsx` | - Tambah onOpenAutoFocus handler<br>- Prevent auto-focus ke textarea |

---

## Hasil Akhir

### RankingCard:
- Menampilkan avg score DAN total score
- Ranking hingga 20 user per tier
- Auto-slide per 5 user dalam satu tier
- Lebih fair: tie-breaker menggunakan total score

### StatusPresensiDialog:
- Dialog muncul tanpa keyboard mobile otomatis
- User bisa lihat semua pilihan status dan tombol konfirmasi
- Baru focus ke textarea jika user tap manual
