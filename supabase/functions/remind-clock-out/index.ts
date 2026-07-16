import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// WIB (UTC+7) covers Head Office / Jakarta / Cikarang.
// WITA (UTC+8) covers Balikpapan / Handil / Muara Badak / all site areas.
function tzOffsetHours(tz: string): number {
  const t = tz.toUpperCase();
  if (t === 'WITA') return 8;
  if (t === 'WIT') return 9;
  return 7; // WIB default
}

function isWibArea(area: string | null | undefined): boolean {
  if (!area) return true; // default WIB
  const u = area.toUpperCase();
  return u.includes('HEAD OFFICE') || u.includes('JAKARTA') || u.includes('CIKARANG');
}

function matchTz(area: string | null | undefined, tz: string): boolean {
  const t = tz.toUpperCase();
  if (t === 'WITA') return !isWibArea(area);
  return isWibArea(area); // WIB
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const tzParam = (url.searchParams.get('tz') || 'WIB').toUpperCase();
    let bodyTz: string | null = null;
    try {
      if (req.method === 'POST') {
        const b = await req.json();
        if (b && typeof b.tz === 'string') bodyTz = b.tz.toUpperCase();
      }
    } catch { /* body optional */ }
    const tz = (bodyTz || tzParam).toUpperCase();
    const offsetHours = tzOffsetHours(tz);

    const META_TOKEN = Deno.env.get('META_TOKEN');
    const META_PHONE_ID = Deno.env.get('META_PHONE_ID');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Local date for this timezone.
    const now = new Date();
    const local = new Date(now.getTime() + offsetHours * 60 * 60 * 1000);
    const todayStr = local.toISOString().split('T')[0];

    console.log(`🔍 [${tz}] Checking not-clocked-out for ${todayStr}`);

    const { data: records, error } = await supabase
      .from('attendance_records')
      .select('staff_uid, staff_name')
      .eq('date', todayStr)
      .not('check_in_time', 'is', null)
      .is('check_out_time', null);

    if (error) {
      console.error('❌ Query error:', error);
      return new Response(JSON.stringify({ success: false, error: error.message }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500,
      });
    }

    if (!records || records.length === 0) {
      return new Response(JSON.stringify({ success: true, tz, reminded: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const staffUids = records.map(r => r.staff_uid);
    const { data: staffUsers } = await supabase
      .from('staff_users')
      .select('uid, name, phone_number, work_area, evening_reminder_enabled')
      .in('uid', staffUids)
      .neq('evening_reminder_enabled', false);

    // Filter by timezone (work_area).
    const tzUsers = (staffUsers || []).filter((s: any) => matchTz(s.work_area, tz));

    // Fire web push in parallel for ALL timezone-matched users.
    const pushTargets = tzUsers.map((s: any) => s.uid);
    if (pushTargets.length > 0) {
      try {
        await supabase.functions.invoke('send-push-notification', {
          body: {
            staff_uids: pushTargets,
            title: '⏰ Reminder Clock Out',
            body: 'Anda belum melakukan clock out hari ini. Buka aplikasi untuk clock out sekarang.',
            type: 'reminder',
            link: '/dashboard',
            tag: `clockout-reminder-${tz}-${todayStr}`,
            requireInteraction: true,
            renotify: true,
            vibrate: [300, 150, 300, 150, 300],
            data: { kind: 'clockout-reminder', date: todayStr, tz },
          },
        });
      } catch (e) {
        console.warn('push reminder failed:', e);
      }
    }

    if (!META_TOKEN || !META_PHONE_ID) {
      return new Response(JSON.stringify({
        success: true, tz, reminded_push: pushTargets.length,
        reason: 'WhatsApp API not configured',
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const smsTargets = tzUsers.filter((s: any) => s.phone_number);
    let sentCount = 0;
    let failCount = 0;

    for (const staff of smsTargets) {
      let phone = staff.phone_number!.replace(/[\s\-\+]/g, '');
      if (phone.startsWith('0')) phone = '62' + phone.substring(1);

      const message = `⏰ *Reminder Clock Out*\n\nHalo ${staff.name},\n\nAnda belum melakukan clock out hari ini.\nSilakan segera clock out melalui aplikasi:\nhttps://absensi.petrolog.my.id\n\n_Pesan otomatis dari Digital Presensi_`;

      try {
        const resp = await fetch(`https://graph.facebook.com/v21.0/${META_PHONE_ID}/messages`, {
          method: "POST",
          headers: { "Authorization": `Bearer ${META_TOKEN}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            messaging_product: "whatsapp",
            to: phone,
            type: "text",
            text: { body: message },
          }),
        });
        const result = await resp.json();
        if (result.messages && result.messages.length > 0) {
          sentCount++;
        } else {
          failCount++;
          console.warn(`⚠️ Failed for ${staff.name}:`, JSON.stringify(result));
        }
      } catch (e) {
        failCount++;
        console.warn(`⚠️ Error sending to ${staff.name}:`, e);
      }
      await new Promise(r => setTimeout(r, 3000));
    }

    console.log(`📊 [${tz}] Summary: push=${pushTargets.length}, wa_sent=${sentCount}, wa_failed=${failCount}, total_not_clocked_out=${records.length}`);

    return new Response(JSON.stringify({
      success: true,
      tz,
      reminded_push: pushTargets.length,
      reminded_whatsapp: sentCount,
      failed_whatsapp: failCount,
      total_not_clocked_out: records.length,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('Error in remind-clock-out:', error);
    return new Response(JSON.stringify({ success: false, error: (error as Error).message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500,
    });
  }
});
