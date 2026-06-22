import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface ReqBody {
  staff_uid?: string;
  action?: 'check_in' | 'check_out';
  device_id?: string;
  user_agent?: string;
}

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

  // Device model (Android), iPhone, generic
  let model = '';
  const androidModel = /;\s*([^;)]+)\s+Build\//i.exec(ua);
  if (androidModel) model = androidModel[1].trim();
  else if (/iPhone/i.test(ua)) model = 'iPhone';
  else if (/iPad/i.test(ua)) model = 'iPad';
  else if (/Macintosh/i.test(ua)) model = 'Mac';
  else if (/Windows/i.test(ua)) model = 'Windows PC';
  else if (/Linux/i.test(ua)) model = 'Linux';

  // Browser
  let browser = 'Browser';
  const edg = /Edg\/([0-9.]+)/.exec(ua);
  const chr = /Chrome\/([0-9.]+)/.exec(ua);
  const fox = /Firefox\/([0-9.]+)/.exec(ua);
  const saf = /Version\/([0-9.]+).*Safari/.exec(ua);
  if (edg) browser = `Edge ${edg[1].split('.')[0]}`;
  else if (chr) browser = `Chrome ${chr[1].split('.')[0]}`;
  else if (fox) browser = `Firefox ${fox[1].split('.')[0]}`;
  else if (saf) browser = `Safari ${saf[1].split('.')[0]}`;

  // OS version
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

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  let device_flag: string | null = null;

  try {
    // 1) Has this staff used this device_id before?
    const { data: sameUserDevice } = await supabase
      .from('attendance_records')
      .select('id')
      .eq('staff_uid', staff_uid)
      .eq('device_id', device_id)
      .limit(1);

    const isNewForUser = !sameUserDevice || sameUserDevice.length === 0;

    if (isNewForUser) {
      device_flag = 'new_device';
    }

    // 2) Has another staff used this same device_id in last 30 days?
    const since30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
    const { data: otherUsers } = await supabase
      .from('attendance_records')
      .select('staff_uid')
      .eq('device_id', device_id)
      .gte('date', since30)
      .neq('staff_uid', staff_uid)
      .limit(1);

    if (otherUsers && otherUsers.length > 0) {
      device_flag = 'device_shared_with_other_user';
    }

    // 3) Has THIS staff used a DIFFERENT device in last 7 days?
    if (!device_flag || device_flag === 'new_device') {
      const since7 = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 10);
      const { data: recentDevices } = await supabase
        .from('attendance_records')
        .select('device_id')
        .eq('staff_uid', staff_uid)
        .gte('date', since7)
        .not('device_id', 'is', null)
        .neq('device_id', device_id)
        .limit(1);

      if (recentDevices && recentDevices.length > 0) {
        // user-on-other-device is stronger signal than new_device
        device_flag = 'user_on_other_device';
      }
    }
  } catch (e) {
    console.error('flag computation failed:', e);
  }

  return new Response(
    JSON.stringify({ client_ip, device_label, device_flag }),
    {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  );
});
