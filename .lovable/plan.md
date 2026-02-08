# ✅ Rencana Perbaikan RankingCard - SELESAI

**Status**: Implementasi selesai pada 2026-02-08


# Rencana Perbaikan RankingCard

## Perubahan Inti

### 1. Batas Minimal Total Bintang per Band

Berdasarkan analisis data Januari 2026 (195 user, max 104.3⭐):

| Band | Batas Minimal | Penjelasan |
|------|---------------|------------|
| Platinum | >= 60⭐ | Top tier (11 user lolos di Jan) |
| Gold | >= 50⭐ | (17 user lolos di Jan) |
| Silver | >= 40⭐ | (25 user lolos di Jan) |
| Bronze | >= 30⭐ | (30 user lolos di Jan) |

User dengan total < 30⭐ tidak masuk band manapun.

### 2. Penomoran Ranking per Band (1-10)

Setiap band memiliki urutan independen:
- Platinum: #1, #2, #3... (max #10)
- Gold: #1, #2, #3... (max #10) - bukan #11, #12...
- Silver: #1, #2, #3... (max #10)
- Bronze: #1, #2, #3... (max #10)

### 3. Satu Slide per Band

- Tampilkan maksimal 10 user per band dalam 1 slide
- Auto-slide hanya antar band (bukan antar halaman dalam 1 band)
- Hapus nested carousel, gunakan carousel utama saja

---

## Perubahan Teknis

### File: `src/components/RankingCard.tsx`

**A. Konstanta Batas Band (baris baru):**
```typescript
const TIER_THRESHOLDS = {
  platinum: 60,  // >= 60 bintang
  gold: 50,      // >= 50 bintang
  silver: 40,    // >= 40 bintang
  bronze: 30,    // >= 30 bintang
};

const MAX_USERS_PER_TIER = 10;
```

**B. Logika Grouping Baru (mengganti slicing posisi):**
```typescript
// Sebelum (posisi-based):
users: allUsers.slice(0, 10)  // Platinum #1-10
users: allUsers.slice(10, 20) // Gold #11-20

// Sesudah (threshold-based):
const platinumUsers = allUsers
  .filter(u => u.total_score >= TIER_THRESHOLDS.platinum)
  .slice(0, MAX_USERS_PER_TIER)
  .map((u, idx) => ({ ...u, tierRank: idx + 1 }));

const goldUsers = allUsers
  .filter(u => 
    u.total_score >= TIER_THRESHOLDS.gold && 
    u.total_score < TIER_THRESHOLDS.platinum &&
    !platinumUsers.some(p => p.staff_uid === u.staff_uid)
  )
  .slice(0, MAX_USERS_PER_TIER)
  .map((u, idx) => ({ ...u, tierRank: idx + 1 }));
// dst...
```

**C. Update Interface:**
```typescript
interface RankingUser {
  staff_uid: string;
  staff_name: string;
  total_score: number;
  total_days: number;
  photo_url?: string;
  tierRank?: number;  // Urutan dalam band (1-10)
}
```

**D. Hapus `globalRank`, ganti dengan `tierRank`:**
```typescript
// Display:
<span className={`text-xs font-bold w-5 ${tierColor}`}>
  #{user.tierRank}
</span>
```

**E. Hapus Nested Carousel:**
- Hapus `chunkUsers()` function
- Hapus `tierApis` dan `tierCurrentSlides` state
- Render langsung 10 user dalam satu div (bukan carousel dalam tier)
- Auto-slide hanya pada carousel utama antar band

**F. Update `rankRange` Display:**
```typescript
// Tampilkan batas threshold, bukan posisi
rankRange: '≥60⭐'  // untuk Platinum
rankRange: '≥50⭐'  // untuk Gold
// dst
```

---

## Contoh Output Visual

### Platinum (≥60⭐) - 8 user lolos
```
#1  FATONI ICHWAN       104⭐
#2  SARIF               88⭐
#3  SUYATNO             86⭐
#4  NURUL ANISA         85⭐
#5  KARMAN              85⭐
#6  AFIF MEIDIANSYAH    82⭐
#7  EVI YUNIATI         81⭐
#8  RATIH Y. CHULLY     78⭐
```

### Gold (≥50⭐) - 10 user lolos
```
#1  EVA SUKINA          76⭐
#2  RIFKI AULIA         76⭐
#3  ...                 ...
#10 ...                 ...
```

---

## Ringkasan Perubahan

| Aspek | Sebelum | Sesudah |
|-------|---------|---------|
| Penentuan band | Posisi #1-10, #11-20, dst | Batas bintang ≥60, ≥50, dst |
| Urutan dalam band | Global (#1-40) | Per band (#1-10) |
| Slide per band | Nested carousel 5 user | 1 slide, 10 user |
| User < 30⭐ | Tidak ditampilkan | Sama (tidak ditampilkan) |
| Band kosong | Tetap tampil | Tidak tampil |

---

## File yang Diubah
- `src/components/RankingCard.tsx`

