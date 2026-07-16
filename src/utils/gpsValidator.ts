// GPS Validator - Anti Fake GPS Algorithm (platform-aware)
import { setLastGpsSnapshot } from './antiJokiCache';

export interface GPSValidationResult {
  isValid: boolean;
  isMocked: boolean;
  reason?: string;
  confidenceScore: number;
  platform: 'ios' | 'android' | 'desktop' | 'unknown';
}

interface PositionHistory {
  lat: number;
  lng: number;
  timestamp: number;
  accuracy: number;
}

const positionHistory: PositionHistory[] = [];
const MAX_HISTORY_SIZE = 10;

// Threshold below which we mark as mocked. Loosened from 50 to 35 to avoid
// penalising legit iPhone Safari readings that have no altitude/speed metadata.
const MOCK_THRESHOLD = 35;
// Soft "watch this" band for admin review only.
const LOW_CONFIDENCE_THRESHOLD = 60;

function detectPlatform(): 'ios' | 'android' | 'desktop' | 'unknown' {
  if (typeof navigator === 'undefined') return 'unknown';
  const ua = navigator.userAgent || '';
  if (/iPhone|iPad|iPod/i.test(ua)) return 'ios';
  if (/Android/i.test(ua)) return 'android';
  if (/Windows|Macintosh|Linux/i.test(ua)) return 'desktop';
  return 'unknown';
}

export const addPositionToHistory = (position: GeolocationPosition) => {
  positionHistory.push({
    lat: position.coords.latitude,
    lng: position.coords.longitude,
    timestamp: position.timestamp,
    accuracy: position.coords.accuracy,
  });
  if (positionHistory.length > MAX_HISTORY_SIZE) positionHistory.shift();
};

export const clearPositionHistory = () => {
  positionHistory.length = 0;
};

const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

export const validateGPSPosition = async (
  position: GeolocationPosition
): Promise<GPSValidationResult> => {
  const platform = detectPlatform();
  const checks: string[] = [];
  let confidenceScore = 100;
  // Hard indicators only trigger `isMocked = true` regardless of confidence
  // score. These are truly impossible for a real GPS reading.
  let hardMock = false;

  const accuracy = position.coords.accuracy;
  const altitude = position.coords.altitude;
  const speed = position.coords.speed;

  // 1. Accuracy: perfect accuracy is a fake-GPS signature but iOS Safari
  //    genuinely reports 2–5m outdoors. Only Android sub-3m is suspicious.
  if (platform === 'android') {
    if (accuracy < 3) {
      checks.push('Akurasi GPS terlalu sempurna (Android)');
      confidenceScore -= 20;
    }
  } else if (platform === 'ios') {
    // iOS: only sub-1m is essentially impossible.
    if (accuracy < 1) {
      checks.push('Akurasi GPS mustahil (iOS)');
      confidenceScore -= 30;
      hardMock = true;
    }
  } else {
    if (accuracy < 2) {
      checks.push('Akurasi GPS terlalu sempurna');
      confidenceScore -= 15;
    }
  }
  if (accuracy > 150) {
    checks.push('Akurasi GPS sangat buruk');
    confidenceScore -= 5;
  }

  // 2. Freshness
  const timeDiff = Date.now() - position.timestamp;
  if (timeDiff > 60000) {
    checks.push('Data lokasi terlalu lama');
    confidenceScore -= 15;
  }

  // 3. Altitude: iOS Safari almost never exposes altitude on the web. Do NOT
  //    penalise iOS/desktop for missing altitude — that was the main source
  //    of false positives on iPhone.
  if (platform === 'android' && altitude === null && position.coords.altitudeAccuracy === null) {
    confidenceScore -= 5;
  } else if (altitude !== null && (altitude < -500 || altitude > 10000)) {
    checks.push('Ketinggian GPS tidak wajar');
    confidenceScore -= 10;
  }

  // 4. Teleportation (impossible movement) — HARD indicator.
  if (positionHistory.length > 0) {
    const lastPos = positionHistory[positionHistory.length - 1];
    const dtSec = (position.timestamp - lastPos.timestamp) / 1000;
    if (dtSec > 0 && dtSec < 60) {
      const distance = calculateDistance(
        lastPos.lat,
        lastPos.lng,
        position.coords.latitude,
        position.coords.longitude
      );
      const mps = distance / dtSec;
      if (mps > 100) {
        checks.push('Perpindahan lokasi tidak wajar (teleportasi)');
        confidenceScore -= 40;
        hardMock = true;
      } else if (mps > 50 && accuracy < 10) {
        checks.push('Kecepatan tinggi dengan akurasi sempurna');
        confidenceScore -= 15;
      }
    }
  }

  // 5. Static coords with unrealistically high accuracy across readings.
  //    Only penalise on Android (iOS static readings while stationary are normal).
  if (platform === 'android' && positionHistory.length >= 3) {
    const recent = positionHistory.slice(-3);
    const allSame = recent.every(
      (p) => p.lat === position.coords.latitude && p.lng === position.coords.longitude
    );
    if (allSame && accuracy < 5) {
      checks.push('Posisi tidak berubah dengan akurasi tinggi');
      confidenceScore -= 10;
    }
  }

  // 6. Speed sanity — HARD if negative.
  if (speed !== null) {
    if (speed < 0) {
      checks.push('Kecepatan GPS negatif');
      confidenceScore -= 30;
      hardMock = true;
    } else if (speed > 100) {
      checks.push('Kecepatan GPS tidak wajar');
      confidenceScore -= 15;
    }
  }

  addPositionToHistory(position);

  const isMocked = hardMock || confidenceScore < MOCK_THRESHOLD;

  setLastGpsSnapshot({
    accuracy: position.coords.accuracy ?? null,
    altitude: position.coords.altitude ?? null,
    speed: position.coords.speed ?? null,
    confidence_score: confidenceScore,
    is_mocked: isMocked,
    reason: checks.length > 0 ? checks.join(', ') : null,
    platform,
    low_confidence: !isMocked && confidenceScore < LOW_CONFIDENCE_THRESHOLD,
  });

  return {
    isValid: !isMocked,
    isMocked,
    reason: checks.length > 0 ? checks.join(', ') : undefined,
    confidenceScore,
    platform,
  };
};

// Quick check for kiosk (no history dependency).
export const quickValidateGPS = (position: GeolocationPosition): boolean => {
  const platform = detectPlatform();
  const accuracy = position.coords.accuracy;
  const timeDiff = Date.now() - position.timestamp;
  // Only reject truly impossible readings.
  if (platform === 'android' && accuracy < 2) return false;
  if (platform !== 'android' && accuracy < 1) return false;
  if (timeDiff > 90000) return false;
  return true;
};
