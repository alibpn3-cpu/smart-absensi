// Morning reminder for users who haven't clocked in yet today.
// Push-first; WhatsApp fallback only for users WITHOUT an active push subscription.
// Skips users who are on approved leave/permission today.

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const now = new Date();
    const wibNow = new Date(now.getTime() + 7 * 60 * 60 * 1000);
    const todayStr = wibNow.toISOString().split("T")[0];

    // Active staff
    const { data: allStaff } = await supabase
      .from("staff_users")
      .select("uid, name, phone_number, is_active, morning_reminder_enabled")
      .eq("is_active", true)
      .neq("morning_reminder_enabled", false);

    if (!allStaff || allStaff.length === 0) {
      return new Response(JSON.stringify({ success: true, reminded: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Already clocked in today
    const { data: checkedIn } = await supabase
      .from("attendance_records")
      .select("staff_uid")
      .eq("date", todayStr)
      .not("check_in_time", "is", null);
    const checkedInSet = new Set((checkedIn || []).map((r: any) => r.staff_uid));

    // On approved leave/permission today (best-effort; ignore if tables differ)
    const onLeaveSet = new Set<string>();
    try {
      const { data: leaves } = await supabase
        .from("leave_requests")
        .select("staff_uid, start_date, end_date, status")
        .lte("start_date", todayStr).gte("end_date", todayStr)
        .eq("status", "approved");
      (leaves || []).forEach((l: any) => onLeaveSet.add(l.staff_uid));
    } catch (_) {}
    try {
      const { data: perms } = await supabase
        .from("permission_requests")
        .select("staff_uid, permission_date, status")
        .eq("permission_date", todayStr).eq("status", "approved");
      (perms || []).forEach((p: any) => onLeaveSet.add(p.staff_uid));
    } catch (_) {}

    const targets = allStaff.filter(
      (s: any) => !checkedInSet.has(s.uid) && !onLeaveSet.has(s.uid),
    );

    if (targets.length === 0) {
      return new Response(JSON.stringify({ success: true, reminded: 0, total_targets: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const targetUids = targets.map((s: any) => s.uid);

    // Find who has push subscription
    const { data: subs } = await supabase
      .from("push_subscriptions")
      .select("staff_uid")
      .in("staff_uid", targetUids);
    const pushUids = Array.from(new Set((subs || []).map((s: any) => s.staff_uid)));
    const pushUidSet = new Set(pushUids);

    // 1) PUSH to subscribers
    let pushed = 0;
    if (pushUids.length) {
      try {
        const { data: pushResp } = await supabase.functions.invoke("send-push-notification", {
          body: {
            staff_uids: pushUids,
            title: "⏰ Belum Clock In",
            body: "Selamat pagi! Jangan lupa clock in melalui aplikasi.",
            type: "reminder",
            link: "/",
            tag: `clockin-${todayStr}`,
          },
        });
        pushed = (pushResp as any)?.pushed || 0;
      } catch (e) {
        console.warn("push invoke failed:", e);
      }
    }

    // 2) WhatsApp fallback only for those WITHOUT push
    const META_TOKEN = Deno.env.get("META_TOKEN");
    const META_PHONE_ID = Deno.env.get("META_PHONE_ID");
    let waSent = 0, waFailed = 0;

    if (META_TOKEN && META_PHONE_ID) {
      const waTargets = targets.filter(
        (s: any) => !pushUidSet.has(s.uid) && s.phone_number,
      );
      for (const staff of waTargets) {
        let phone = staff.phone_number!.replace(/[\s\-\+]/g, "");
        if (phone.startsWith("0")) phone = "62" + phone.substring(1);
        const message = `⏰ *Reminder Clock In*\n\nHalo ${staff.name},\n\nAnda belum clock in hari ini.\nSilakan segera clock in:\nhttps://absensi.petrolog.my.id\n\n_Pesan otomatis dari Digital Presensi_`;
        try {
          const resp = await fetch(`https://graph.facebook.com/v21.0/${META_PHONE_ID}/messages`, {
            method: "POST",
            headers: { "Authorization": `Bearer ${META_TOKEN}`, "Content-Type": "application/json" },
            body: JSON.stringify({ messaging_product: "whatsapp", to: phone, type: "text", text: { body: message } }),
          });
          const result = await resp.json();
          if (result.messages?.length) waSent++; else waFailed++;
        } catch (_) { waFailed++; }
        await new Promise((r) => setTimeout(r, 3000));
      }
    }

    return new Response(JSON.stringify({
      success: true,
      total_targets: targets.length,
      pushed, wa_sent: waSent, wa_failed: waFailed,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    console.error("remind-clock-in error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
