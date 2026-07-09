// Anti-joki context enrichment for attendance inserts/updates.
// Calls the `attendance-context` edge function to capture server-side IP,
// compute device flag, and detect clock manipulation (skew vs server time).
// Silent and non-blocking: if the call fails, returns minimal client-side
// context so the attendance flow continues.

import { supabase } from '@/integrations/supabase/client';
import { getOrCreateDeviceId } from './deviceId';
import { getLastGpsSnapshot, getTimeSyncVerifiedAt } from './antiJokiCache';

export interface GpsSnapshot {
  accuracy: number | null;
  altitude: number | null;
  speed: number | null;
  confidence_score: number | null;
  is_mocked: boolean;
  reason?: string | null;
}

export interface AttendanceContext {
  client_ip: string | null;
  user_agent: string;
  device_id: string;
  device_label: string;
  device_flag: string | null;
  client_timestamp: string;
  clock_skew_seconds: number | null;
  clock_warning: boolean;
  // GPS + time-sync (may be null when unavailable)
  gps: GpsSnapshot | null;
  time_sync_verified_at: string | null;
}

export interface AttendanceContextExtras {
  gps?: GpsSnapshot | null;
  time_sync_verified_at?: string | null;
}

export async function getAttendanceContext(
  staffUid: string,
  action: 'check_in' | 'check_out',
  extras: AttendanceContextExtras = {}
): Promise<AttendanceContext> {
  const device_id = getOrCreateDeviceId();
  const user_agent = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const client_timestamp = new Date().toISOString();
  const gps = extras.gps ?? null;
  const time_sync_verified_at = extras.time_sync_verified_at ?? null;

  try {
    const { data, error } = await supabase.functions.invoke('attendance-context', {
      body: {
        staff_uid: staffUid,
        action,
        device_id,
        user_agent,
        client_timestamp,
        gps,
        time_sync_verified_at,
      },
    });

    if (error || !data) {
      return {
        client_ip: null,
        user_agent,
        device_id,
        device_label: parseUserAgentFallback(user_agent),
        device_flag: null,
        client_timestamp,
        clock_skew_seconds: null,
        clock_warning: false,
        gps,
        time_sync_verified_at,
      };
    }

    return {
      client_ip: data.client_ip ?? null,
      user_agent,
      device_id,
      device_label: data.device_label || parseUserAgentFallback(user_agent),
      device_flag: data.device_flag ?? null,
      client_timestamp,
      clock_skew_seconds: typeof data.clock_skew_seconds === 'number' ? data.clock_skew_seconds : null,
      clock_warning: !!data.clock_warning,
      gps,
      time_sync_verified_at,
    };
  } catch {
    return {
      client_ip: null,
      user_agent,
      device_id,
      device_label: parseUserAgentFallback(user_agent),
      device_flag: null,
      client_timestamp,
      clock_skew_seconds: null,
      clock_warning: false,
      gps,
      time_sync_verified_at,
    };
  }
}

/**
 * Map an AttendanceContext into the DB column shape.
 * - Legacy columns (device_id, device_flag, ...) are always mirrored for
 *   backward compatibility with existing reports.
 * - Per-action columns (device_id_in / device_id_out, etc.) are written to
 *   the correct side so a later check-out never overwrites check-in evidence.
 */
export function contextToColumns(
  ctx: AttendanceContext,
  action: 'check_in' | 'check_out'
): Record<string, any> {
  const suffix = action === 'check_in' ? 'in' : 'out';
  return {
    // legacy mirror (kept for old code paths / reports)
    client_ip: ctx.client_ip,
    user_agent: ctx.user_agent,
    device_id: ctx.device_id,
    device_label: ctx.device_label,
    device_flag: ctx.device_flag,
    client_timestamp: ctx.client_timestamp,
    clock_skew_seconds: ctx.clock_skew_seconds,
    // per-action
    [`client_ip_${suffix}`]: ctx.client_ip,
    [`device_id_${suffix}`]: ctx.device_id,
    [`device_label_${suffix}`]: ctx.device_label,
    [`device_flag_${suffix}`]: ctx.device_flag,
    [`clock_skew_seconds_${suffix}`]: ctx.clock_skew_seconds,
    [`gps_accuracy_${suffix}`]: ctx.gps?.accuracy ?? null,
    [`gps_altitude_${suffix}`]: ctx.gps?.altitude ?? null,
    [`gps_speed_${suffix}`]: ctx.gps?.speed ?? null,
    [`gps_confidence_${suffix}`]: ctx.gps?.confidence_score ?? null,
    [`time_sync_verified_at_${suffix}`]: ctx.time_sync_verified_at,
  };
}

function parseUserAgentFallback(ua: string): string {
  if (!ua) return 'Unknown';
  const browser =
    /Edg\/(\d+)/.exec(ua)?.[0] ||
    /Chrome\/(\d+)/.exec(ua)?.[0] ||
    /Firefox\/(\d+)/.exec(ua)?.[0] ||
    /Safari\/(\d+)/.exec(ua)?.[0] ||
    'Browser';
  const os =
    (/Android\s([0-9.]+)/.exec(ua) || [])[0] ||
    (/iPhone OS ([0-9_]+)/.exec(ua) || [])[0] ||
    (/Windows NT ([0-9.]+)/.exec(ua) || [])[0] ||
    (/Mac OS X ([0-9_]+)/.exec(ua) || [])[0] ||
    'OS';
  return `${browser} • ${os}`.replace(/_/g, '.');
}

/**
 * Show a non-blocking toast warning when device clock is out of sync.
 * Caller should pass the toast function (sonner or use-toast) to avoid coupling.
 */
export function showClockWarning(
  ctx: AttendanceContext,
  toastFn: (opts: any) => any
) {
  if (!ctx.clock_warning || ctx.clock_skew_seconds == null) return;
  const mins = Math.round(ctx.clock_skew_seconds / 60);
  toastFn({
    title: 'Jam perangkat tidak sinkron',
    description: `Jam HP Anda berbeda ~${mins} menit dari jam server. Mohon aktifkan "Tanggal & Waktu Otomatis" di pengaturan. Absensi tetap diproses dengan jam server.`,
    variant: 'destructive',
    duration: 7000,
  });
}
