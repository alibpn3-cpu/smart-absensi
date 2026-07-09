// Offline attendance queue backed by IndexedDB (via idb-keyval).
//
// Design constraints (be honest about limitations):
// - Web PWA cannot detect mock GPS reliably. Offline entries also cannot
//   validate time against the server. Every entry synced from this queue
//   is force-flagged with `offline_queued` + `clock_manipulated_hard` (no
//   time-sync at submission time) so admins can review them.
// - Photos are stored as Blobs inside IndexedDB. Cap the queue to keep
//   storage bounded on low-end devices.
// - Sync is best-effort: `online` event + periodic tick + manual trigger.
//   Failures move the entry to a "failed" tail so the queue does not stall.

import { get, set, del, keys } from 'idb-keyval';
import { supabase } from '@/integrations/supabase/client';
import { contextToColumns, getAttendanceContext } from './attendanceContext';

const QUEUE_PREFIX = 'atd-offline-';
const FAILED_PREFIX = 'atd-failed-';
export const MAX_QUEUE_ENTRIES = 20;

export interface OfflineAttendanceEntry {
  id: string;
  action: 'check_in' | 'check_out';
  staff_uid: string;
  staff_name: string;
  date: string; // yyyy-MM-dd (client-computed work date)
  status: 'wfo' | 'wfh' | 'dinas';
  attendance_type: 'regular' | 'overtime';
  shift_type?: string | null;
  timestamp_client: string; // formatted timestamp string used as check_in_time / check_out_time
  location: {
    lat: number | null;
    lng: number | null;
    address: string | null;
    accuracy?: number | null;
  };
  photo_blob?: Blob | null;
  photo_kind?: 'checkin' | 'checkout' | null;
  reason?: string | null;
  existing_record_id?: string | null; // for check_out that updates an existing check_in row
  queued_at: string;
}

export async function enqueueOfflineAttendance(entry: Omit<OfflineAttendanceEntry, 'id' | 'queued_at'>): Promise<string> {
  const current = await listQueue();
  if (current.length >= MAX_QUEUE_ENTRIES) {
    throw new Error(`Antrian offline penuh (max ${MAX_QUEUE_ENTRIES}). Sinkronkan dulu.`);
  }
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const full: OfflineAttendanceEntry = {
    ...entry,
    id,
    queued_at: new Date().toISOString(),
  };
  await set(QUEUE_PREFIX + id, full);
  return id;
}

export async function listQueue(): Promise<OfflineAttendanceEntry[]> {
  const allKeys = await keys();
  const queueKeys = allKeys.filter((k) => typeof k === 'string' && (k as string).startsWith(QUEUE_PREFIX));
  const entries: OfflineAttendanceEntry[] = [];
  for (const k of queueKeys) {
    const v = await get<OfflineAttendanceEntry>(k as string);
    if (v) entries.push(v);
  }
  return entries.sort((a, b) => (a.queued_at < b.queued_at ? -1 : 1));
}

export async function queueCount(): Promise<number> {
  return (await listQueue()).length;
}

export async function removeFromQueue(id: string): Promise<void> {
  await del(QUEUE_PREFIX + id);
}

async function moveToFailed(entry: OfflineAttendanceEntry, reason: string): Promise<void> {
  await set(FAILED_PREFIX + entry.id, { ...entry, failed_reason: reason, failed_at: new Date().toISOString() });
  await removeFromQueue(entry.id);
}

async function uploadPhoto(entry: OfflineAttendanceEntry): Promise<string | null> {
  if (!entry.photo_blob) return null;
  const ext = 'jpg';
  const path = `${entry.staff_uid}/${entry.date}/${entry.photo_kind || 'checkin'}_${entry.id}.${ext}`;
  const { error } = await supabase.storage
    .from('attendance-photos')
    .upload(path, entry.photo_blob, { contentType: 'image/jpeg', upsert: true });
  if (error) throw error;
  return path;
}

async function processEntry(entry: OfflineAttendanceEntry): Promise<void> {
  const ctx = await getAttendanceContext(entry.staff_uid, entry.action);
  // Force offline flags on top of anything the edge function computed.
  const flags = new Set(
    [ctx.device_flag, 'offline_queued', 'clock_manipulated_hard']
      .filter(Boolean)
      .flatMap((s) => (s as string).split(','))
      .map((s) => s.trim())
  );
  const mergedCtx = { ...ctx, device_flag: Array.from(flags).join(',') };
  const cols = contextToColumns(mergedCtx, entry.action);

  const photoPath = await uploadPhoto(entry);

  if (entry.action === 'check_in') {
    const row: any = {
      staff_uid: entry.staff_uid,
      staff_name: entry.staff_name,
      date: entry.date,
      status: entry.status,
      attendance_type: entry.attendance_type,
      shift_type: entry.shift_type ?? null,
      check_in_time: entry.timestamp_client,
      checkin_location_address: entry.location.address,
      checkin_location_lat: entry.location.lat,
      checkin_location_lng: entry.location.lng,
      checkin_reason: entry.reason || null,
      offline_queued: true,
      offline_queued_at: entry.queued_at,
      ...cols,
    };
    if (photoPath) row.selfie_checkin_url = photoPath;
    const { error } = await supabase.from('attendance_records').insert(row);
    if (error) throw error;
  } else {
    const patch: any = {
      check_out_time: entry.timestamp_client,
      checkout_location_address: entry.location.address,
      checkout_location_lat: entry.location.lat,
      checkout_location_lng: entry.location.lng,
      checkout_reason: entry.reason || null,
      offline_queued: true,
      offline_queued_at: entry.queued_at,
      ...cols,
    };
    if (photoPath) patch.selfie_checkout_url = photoPath;
    if (!entry.existing_record_id) throw new Error('existing_record_id missing for offline check_out');
    const { error } = await supabase.from('attendance_records').update(patch).eq('id', entry.existing_record_id);
    if (error) throw error;
  }
}

export interface SyncResult {
  succeeded: number;
  failed: number;
  remaining: number;
}

let syncInflight = false;

export async function syncOfflineQueue(): Promise<SyncResult> {
  if (syncInflight) return { succeeded: 0, failed: 0, remaining: await queueCount() };
  syncInflight = true;
  let succeeded = 0;
  let failed = 0;
  try {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      return { succeeded: 0, failed: 0, remaining: await queueCount() };
    }
    const queue = await listQueue();
    for (const entry of queue) {
      try {
        await processEntry(entry);
        await removeFromQueue(entry.id);
        succeeded++;
      } catch (e: any) {
        failed++;
        await moveToFailed(entry, e?.message || 'unknown error');
      }
    }
  } finally {
    syncInflight = false;
  }
  return { succeeded, failed, remaining: await queueCount() };
}
