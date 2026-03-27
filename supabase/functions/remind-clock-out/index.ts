import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const META_TOKEN = Deno.env.get('META_TOKEN');
    const META_PHONE_ID = Deno.env.get('META_PHONE_ID');

    if (!META_TOKEN || !META_PHONE_ID) {
      console.warn('⚠️ META_TOKEN or META_PHONE_ID not configured, skipping reminders');
      return new Response(JSON.stringify({ success: false, reason: 'Meta WhatsApp API not configured' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get today's date in WIB (UTC+7)
    const now = new Date();
    const wibOffset = 7 * 60 * 60 * 1000;
    const wibNow = new Date(now.getTime() + wibOffset);
    const todayStr = wibNow.toISOString().split('T')[0];

    console.log(`🔍 Checking for users who haven't clocked out on ${todayStr}`);

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
      console.log('✅ All users have clocked out today');
      return new Response(JSON.stringify({ success: true, reminded: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const staffUids = records.map(r => r.staff_uid);
    const { data: staffUsers } = await supabase
      .from('staff_users')
      .select('uid, name, phone_number')
      .in('uid', staffUids)
      .not('phone_number', 'is', null);

    if (!staffUsers || staffUsers.length === 0) {
      console.log('ℹ️ No users with phone numbers to remind');
      return new Response(JSON.stringify({ success: true, reminded: 0, total_not_clocked_out: records.length }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let sentCount = 0;
    let failCount = 0;

    for (const staff of staffUsers) {
      let phone = staff.phone_number!.replace(/[\s\-\+]/g, '');
      if (phone.startsWith('0')) {
        phone = '62' + phone.substring(1);
      }

      const message = `⏰ *Reminder Clock Out*\n\nHalo ${staff.name},\n\nAnda belum melakukan clock out hari ini.\nSilakan segera clock out melalui aplikasi:\nhttps://absensi.petrolog.my.id\n\n_Pesan otomatis dari Digital Presensi_`;

      try {
        const resp = await fetch(`https://graph.facebook.com/v21.0/${META_PHONE_ID}/messages`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${META_TOKEN}`,
            "Content-Type": "application/json",
          },
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
          console.log(`✅ Reminder sent to ${staff.name} (${phone})`);
        } else {
          failCount++;
          console.warn(`⚠️ Failed for ${staff.name}:`, JSON.stringify(result));
        }
      } catch (e) {
        failCount++;
        console.warn(`⚠️ Error sending to ${staff.name}:`, e);
      }

      // Delay 3 detik antar pesan
      await new Promise(r => setTimeout(r, 3000));
    }

    console.log(`📊 Reminder summary: ${sentCount} sent, ${failCount} failed, ${records.length} total not clocked out`);

    return new Response(JSON.stringify({
      success: true,
      reminded: sentCount,
      failed: failCount,
      total_not_clocked_out: records.length,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in remind-clock-out:', error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500,
    });
  }
});
