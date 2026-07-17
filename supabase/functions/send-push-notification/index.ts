// Send Web Push notification to one or many staff_uids.
// Also inserts a row in `notifications` table (in-app bell history).
//
// Body:
// {
//   staff_uids: string[],         // required, who to notify
//   title: string,                // required
//   body: string,                 // required
//   type?: string,                // info | reminder | leave | etc.
//   link?: string,                // deep link path
//   tag?: string,                 // dedupe tag
//   data?: object,                // extra payload
//   store_only?: boolean,         // if true, only insert row (no push)
// }

import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const VAPID_PUBLIC = Deno.env.get("VAPID_PUBLIC_KEY")!;
const VAPID_PRIVATE = Deno.env.get("VAPID_PRIVATE_KEY")!;
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") || "mailto:admin@petrolog.my.id";

if (VAPID_PUBLIC && VAPID_PRIVATE) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json();
    const staff_uids: string[] = Array.isArray(body.staff_uids) ? body.staff_uids : [];
    const title: string = body.title;
    const messageBody: string = body.body;

    if (!staff_uids.length || !title || !messageBody) {
      return new Response(JSON.stringify({ error: "staff_uids, title, body required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // 1) Insert in-app notification rows (bell history)
    const rows = staff_uids.map((uid) => ({
      staff_uid: uid,
      title,
      body: messageBody,
      type: body.type || "info",
      link: body.link || null,
      data: body.data || {},
    }));
    const { error: insertErr } = await supabase.from("notifications").insert(rows);
    if (insertErr) console.warn("notifications insert error:", insertErr.message);

    if (body.store_only) {
      return new Response(JSON.stringify({ success: true, stored: rows.length, pushed: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2) Send web push to all subscriptions for these users
    const { data: subs } = await supabase
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth, staff_uid")
      .in("staff_uid", staff_uids);

    if (!subs || subs.length === 0) {
      return new Response(JSON.stringify({ success: true, pushed: 0, reason: "no_subscriptions" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload = JSON.stringify({
      title, body: messageBody,
      link: body.link || "/",
      tag: body.tag,
      requireInteraction: body.requireInteraction,
      renotify: body.renotify,
      vibrate: body.vibrate,
      data: body.data || {},
    });

    let sent = 0, failed = 0;
    const deadEndpoints: string[] = [];

    await Promise.all(subs.map(async (s: any) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          payload,
        );
        sent++;
      } catch (e: any) {
        failed++;
        if (e?.statusCode === 404 || e?.statusCode === 410) {
          deadEndpoints.push(s.endpoint);
        } else {
          console.warn("push error:", e?.statusCode, e?.body);
        }
      }
    }));

    // 3) Cleanup expired subscriptions
    if (deadEndpoints.length) {
      await supabase.from("push_subscriptions").delete().in("endpoint", deadEndpoints);
    }

    return new Response(JSON.stringify({
      success: true, stored: rows.length, pushed: sent, failed, cleaned: deadEndpoints.length,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (e: any) {
    console.error("send-push-notification error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
