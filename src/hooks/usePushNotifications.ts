import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

// Public VAPID key (safe to expose)
export const VAPID_PUBLIC_KEY =
  "BMOzfNj6NJss2WsPqe22nMjfgbksB-1cwz3DTe_cmBHjAlXLpvhh7ts4cRSNlGubnEh0EeEJXNU9y8BWsHnk9O0";

const SW_URL = "/push-sw.js";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; ++i) arr[i] = raw.charCodeAt(i);
  return arr;
}

function isSupported() {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export function usePushNotifications(staffUid?: string | null) {
  const [supported] = useState(isSupported());
  const [permission, setPermission] = useState<NotificationPermission>(
    isSupported() ? Notification.permission : "default"
  );
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);

  const getRegistration = useCallback(async () => {
    if (!supported) return null;
    const existing = await navigator.serviceWorker.getRegistration(SW_URL);
    if (existing) return existing;
    return await navigator.serviceWorker.register(SW_URL, { scope: "/" });
  }, [supported]);

  const checkSubscription = useCallback(async () => {
    if (!supported) return;
    try {
      const reg = await navigator.serviceWorker.getRegistration(SW_URL);
      const sub = await reg?.pushManager.getSubscription();
      setSubscribed(!!sub);
    } catch (_) {
      setSubscribed(false);
    }
  }, [supported]);

  useEffect(() => {
    checkSubscription();
  }, [checkSubscription]);

  // Auto-recover: if permission is granted but no active subscription (browser dropped it,
  // service worker updated, or subscription expired), silently re-subscribe so notifications
  // keep working without the user having to re-toggle.
  useEffect(() => {
    if (!supported || !staffUid) return;
    if (permission !== "granted") return;
    let cancelled = false;
    (async () => {
      try {
        const reg = await navigator.serviceWorker.getRegistration(SW_URL);
        const existing = await reg?.pushManager.getSubscription();
        if (cancelled || existing) return;
        // Silently resubscribe
        await subscribe();
      } catch (_) { /* noop */ }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supported, staffUid, permission]);

  const subscribe = useCallback(async () => {
    if (!supported || !staffUid) return false;
    setLoading(true);
    try {
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== "granted") return false;

      const reg = await getRegistration();
      if (!reg) return false;

      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
        });
      }

      const json: any = sub.toJSON();
      const { error } = await supabase.from("push_subscriptions").upsert(
        {
          staff_uid: staffUid,
          endpoint: sub.endpoint,
          p256dh: json.keys?.p256dh,
          auth: json.keys?.auth,
          user_agent: navigator.userAgent,
          last_seen_at: new Date().toISOString(),
        },
        { onConflict: "endpoint" }
      );
      if (error) {
        console.error("Failed to save subscription:", error);
        return false;
      }
      setSubscribed(true);
      return true;
    } catch (e) {
      console.error("subscribe error:", e);
      return false;
    } finally {
      setLoading(false);
    }
  }, [supported, staffUid, getRegistration]);

  const unsubscribe = useCallback(async () => {
    if (!supported) return;
    setLoading(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration(SW_URL);
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
        await sub.unsubscribe();
      }
      setSubscribed(false);
    } finally {
      setLoading(false);
    }
  }, [supported]);

  return { supported, permission, subscribed, loading, subscribe, unsubscribe };
}
