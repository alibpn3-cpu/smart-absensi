// Anti-joki context enrichment for attendance inserts/updates.
// Calls the `attendance-context` edge function to capture server-side IP
// and compute a device flag. Silent and non-blocking: if the call fails,
// returns minimal client-side context so the attendance flow continues.

import { supabase } from '@/integrations/supabase/client';
import { getOrCreateDeviceId } from './deviceId';

export interface AttendanceContext {
  client_ip: string | null;
  user_agent: string;
  device_id: string;
  device_label: string;
  device_flag: string | null;
}

export async function getAttendanceContext(
  staffUid: string,
  action: 'check_in' | 'check_out'
): Promise<AttendanceContext> {
  const device_id = getOrCreateDeviceId();
  const user_agent = typeof navigator !== 'undefined' ? navigator.userAgent : '';

  try {
    const { data, error } = await supabase.functions.invoke('attendance-context', {
      body: { staff_uid: staffUid, action, device_id, user_agent },
    });

    if (error || !data) {
      return {
        client_ip: null,
        user_agent,
        device_id,
        device_label: parseUserAgentFallback(user_agent),
        device_flag: null,
      };
    }

    return {
      client_ip: data.client_ip ?? null,
      user_agent,
      device_id,
      device_label: data.device_label || parseUserAgentFallback(user_agent),
      device_flag: data.device_flag ?? null,
    };
  } catch {
    return {
      client_ip: null,
      user_agent,
      device_id,
      device_label: parseUserAgentFallback(user_agent),
      device_flag: null,
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
