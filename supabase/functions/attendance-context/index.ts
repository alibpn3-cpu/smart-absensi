import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface GpsSnapshot {
  accuracy?: number | null;
  altitude?: number | null;
  speed?: number | null;
  confidence_score?: number | null;
  is_mocked?: boolean;
  reason?: string | null;
}

interface ReqBody {
  staff_uid?: string;
  action?: 'check_in' | 'check_out';
  device_id?: string;
  user_agent?: string;
  client_timestamp?: string;
  gps?: GpsSnapshot | null;
  time_sync_verified_at?: string | null;
}

const CLOCK_SKEW_THRESHOLD_SECONDS = 120;
const TIME_SYNC_MAX_AGE_MS = 6 * 60 * 60 * 1000; // 6 hours (relaxed for weak networks)


function getClientIp(req: Request): string | null {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  return (
    req.headers.get('cf-connecting-ip') ||
    req.headers.get('x-real-ip') ||
    null
  );
}

function parseUserAgent(ua: string): string {
  if (!ua) return 'Unknown';
  let model = '';
  const androidModel = /;\s*([^;)]+)\s+Build\//i.exec(ua);
  if (androidModel) model = androidModel[1].trim();
  else if (/iPhone/i.test(ua)) model = 'iPhone';
  else if (/iPad/i.test(ua)) model = 'iPad';
  else if (/Macintosh/i.test(ua)) model = 'Mac';
  else if (/Windows/i.test(ua)) model = 'Windows PC';
  else if (/Linux/i.test(ua)) model = 'Linux';

  let browser = 'Browser';
  const edg = /Edg\/([0-9.]+)/.exec(ua);
  const chr = /Chrome\/([0-9.]+)/.exec(ua);
  const fox = /Firefox\/([0-9.]+)/.exec(ua);
  const saf = /Version\/([0-9.]+).*Safari/.exec(ua);
  if (edg) browser = `Edge ${edg[1].split('.')[0]}`;
  else if (chr) browser = `Chrome ${chr[1].split('.')[0]}`;
  else if (fox) browser = `Firefox ${fox[1].split('.')[0]}`;
  else if (saf) browser = `Safari ${saf[1].split('.')[0]}`;

  let os = '';
  const andOs = /Android\s+([0-9.]+)/.exec(ua);
  const iOs = /iPhone OS\s+([0-9_]+)/.exec(ua);
  const win = /Windows NT\s+([0-9.]+)/.exec(ua);
  const mac = /Mac OS X\s+([0-9_]+)/.exec(ua);
  if (andOs) os = `Android ${andOs[1]}`;
  else if (iOs) os = `iOS ${iOs[1].replace(/_/g, '.')}`;
  else if (win) os = `Windows ${win[1]}`;
  else if (mac) os = `macOS ${mac[1].replace(/_/g, '.')}`;

  return [model, browser, os].filter(Boolean).join(' • ');
}

function detectMockGps(gps: GpsSnapshot | null | undefined): boolean {
  if (!gps) return false;
  // client already computed a confidence score (0-100); <50 = suspicious
  if (typeof gps.confidence_score === 'number' && gps.confidence_score < 50) return true;
  if (gps.is_mocked) return true;
  // classic fake-gps signature: perfect accuracy, no altitude, no speed
  const accuracy = gps.accuracy ?? null;
  const altitude = gps.altitude ?? null;
  const speed = gps.speed ?? null;
  if (accuracy !== null && accuracy < 3 && altitude === null && speed === null) return true;
  return false;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  let body: ReqBody;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const staff_uid = (body.staff_uid || '').toString().trim();
  const device_id = (body.device_id || '').toString().trim();
  const user_agent = (body.user_agent || '').toString();
  const client_timestamp_raw = (body.client_timestamp || '').toString();
  const gps = body.gps || null;
  const time_sync_verified_at_raw = body.time_sync_verified_at || null;

  if (!staff_uid || !device_id) {
    return new Response(
      JSON.stringify({ error: 'staff_uid and device_id required' }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }

  const client_ip = getClientIp(req);
  const device_label = parseUserAgent(user_agent);
  const ip_country = req.headers.get('cf-ipcountry') || null;

  // Clock skew
  let clock_skew_seconds: number | null = null;
  let clock_warning = false;
  if (client_timestamp_raw) {
    const clientMs = Date.parse(client_timestamp_raw);
    if (!isNaN(clientMs)) {
      clock_skew_seconds = Math.round(Math.abs(Date.now() - clientMs) / 1000);
      if (clock_skew_seconds > CLOCK_SKEW_THRESHOLD_SECONDS) clock_warning = true;
    }
  }

  // Time-sync freshness: prior policy hard-flagged any missing/stale sync.
  // That produced false positives on weak networks. Now:
  //   - "time_sync_stale"           = soft flag (no recent server verification)
  //   - "clock_manipulated_hard"    = ONLY when we measured skew > threshold
  //                                   AND the client couldn't prove a fresh sync
  let time_sync_stale = false;
  if (!time_sync_verified_at_raw) {
    time_sync_stale = true;
  } else {
    const ts = Date.parse(time_sync_verified_at_raw);
    if (isNaN(ts) || Date.now() - ts > TIME_SYNC_MAX_AGE_MS) {
      time_sync_stale = true;
    }
  }
  const clock_manipulated_hard =
    time_sync_stale && clock_skew_seconds != null && clock_skew_seconds > CLOCK_SKEW_THRESHOLD_SECONDS;


  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const flags: string[] = [];

  try {
    // 1) Has this staff used this device_id before? (check both new + legacy columns)
    const { data: sameUserDevice } = await supabase
      .from('attendance_records')
      .select('id')
      .eq('staff_uid', staff_uid)
      .or(`device_id.eq.${device_id},device_id_in.eq.${device_id},device_id_out.eq.${device_id}`)
      .limit(1);

    const isNewForUser = !sameUserDevice || sameUserDevice.length === 0;

    // 2) Has another staff used this device in the last 30 days?
    const since30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
    const { data: otherUsers } = await supabase
      .from('attendance_records')
      .select('staff_uid, staff_name')
      .or(`device_id.eq.${device_id},device_id_in.eq.${device_id},device_id_out.eq.${device_id}`)
      .gte('date', since30)
      .neq('staff_uid', staff_uid)
      .limit(1);

    if (otherUsers && otherUsers.length > 0) {
      // include the other staff name in the flag for easy admin scanning
      const other = otherUsers[0] as any;
      const otherName = (other?.staff_name || other?.staff_uid || 'unknown').toString();
      flags.push(`device_shared_with_other_user:${otherName}`);
    } else if (isNewForUser) {
      // 3) Has THIS staff used a DIFFERENT device in last 7 days?
      const since7 = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 10);
      const { data: recentDevices } = await supabase
        .from('attendance_records')
        .select('device_id, device_id_in, device_id_out')
        .eq('staff_uid', staff_uid)
        .gte('date', since7)
        .limit(20);

      const hasOtherDevice = (recentDevices || []).some((r: any) =>
        [r.device_id, r.device_id_in, r.device_id_out]
          .filter(Boolean)
          .some((d: string) => d !== device_id)
      );

      if (hasOtherDevice) flags.push('user_on_other_device');
      else flags.push('new_device');
    }

    if (clock_warning) flags.push('clock_manipulated');
    if (clock_manipulated_hard) flags.push('clock_manipulated_hard');
    else if (time_sync_stale) flags.push('time_sync_stale');
    if (detectMockGps(gps)) flags.push('suspected_mock_gps');

    // IP vs GPS mismatch (only when we have a country code from CF)
    if (ip_country && ip_country !== 'ID' && ip_country !== 'XX') {
      flags.push(`ip_gps_mismatch:${ip_country}`);
    }
  } catch (e) {

    console.error('flag computation failed:', e);
  }

  const device_flag = flags.length > 0 ? flags.join(',') : null;

  return new Response(
    JSON.stringify({
      client_ip,
      device_label,
      device_flag,
      clock_skew_seconds,
      clock_warning,
      clock_manipulated_hard,
      ip_country,
    }),
    {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  );
});
