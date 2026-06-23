// Anti-joki context enrichment for attendance inserts/updates.
// Calls the `attendance-context` edge function to capture server-side IP,
// compute device flag, and detect clock manipulation (skew vs server time).
// Silent and non-blocking: if the call fails, returns minimal client-side
// context so the attendance flow continues.

import { supabase } from '@/integrations/supabase/client';
import { getOrCreateDeviceId } from './deviceId';

export interface AttendanceContext {
  client_ip: string | null;
  user_agent: string;
  device_id: string;
  device_label: string;
  device_flag: string | null;
  client_timestamp: string;
  clock_skew_seconds: number | null;
  clock_warning: boolean;
}

export async function getAttendanceContext(
  staffUid: string,
  action: 'check_in' | 'check_out'
): Promise<AttendanceContext> {
  const device_id = getOrCreateDeviceId();
  const user_agent = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const client_timestamp = new Date().toISOString();

  try {
    const { data, error } = await supabase.functions.invoke('attendance-context', {
      body: { staff_uid: staffUid, action, device_id, user_agent, client_timestamp },
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
    };
  }
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

