// Lightweight in-memory cache for the last successful time-sync and the
// latest GPS validation snapshot. Consumers (attendance form, offline queue)
// read from here so we don't have to plumb these values through every layer.

import type { GpsSnapshot } from './attendanceContext';

let lastTimeSyncVerifiedAt: string | null = null;
let lastGpsSnapshot: GpsSnapshot | null = null;

export function setTimeSyncVerifiedNow() {
  lastTimeSyncVerifiedAt = new Date().toISOString();
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
