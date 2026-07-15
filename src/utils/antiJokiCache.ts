// Lightweight cache for the last successful time-sync and the latest GPS
// validation snapshot. `time_sync_verified_at` is also persisted to
// localStorage so it survives PWA restarts / reloads. This is used only as a
// last-known-good grace window when the server is unreachable.

import type { GpsSnapshot } from './attendanceContext';

const TIME_SYNC_LS_KEY = 'last_time_sync_ok';
// How long we accept the persisted value if the server is temporarily
// unreachable. 6h matches the server-side TIME_SYNC_MAX_AGE_MS.
const TIME_SYNC_GRACE_MS = 6 * 60 * 60 * 1000;

let lastTimeSyncVerifiedAt: string | null = null;
let lastGpsSnapshot: GpsSnapshot | null = null;

// Hydrate from localStorage on module load (browser only).
try {
  if (typeof localStorage !== 'undefined') {
    const persisted = localStorage.getItem(TIME_SYNC_LS_KEY);
    if (persisted) {
      const t = Date.parse(persisted);
      if (!isNaN(t) && Date.now() - t < TIME_SYNC_GRACE_MS) {
        lastTimeSyncVerifiedAt = persisted;
      } else if (!isNaN(t)) {
        // stale but keep it — server can decide via its own max-age window
        lastTimeSyncVerifiedAt = persisted;
      }
    }
  }
} catch {
  // ignore storage errors (private mode, quota, etc.)
}

export function setTimeSyncVerifiedNow() {
  const iso = new Date().toISOString();
  lastTimeSyncVerifiedAt = iso;
  try {
    localStorage.setItem(TIME_SYNC_LS_KEY, iso);
  } catch {
    // ignore
  }
}

export function getTimeSyncVerifiedAt(): string | null {
  return lastTimeSyncVerifiedAt;
}

export function setLastGpsSnapshot(snap: GpsSnapshot | null) {
  lastGpsSnapshot = snap;
}

export function getLastGpsSnapshot(): GpsSnapshot | null {
  return lastGpsSnapshot;
}
