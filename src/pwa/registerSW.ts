// Guarded PWA service-worker registration.
// Refuses to register in dev, iframe previews, and Lovable preview hosts.
// Also honors ?sw=off as a manual kill-switch.
//
// Uses `virtual:pwa-register` from vite-plugin-pwa; we intentionally set
// `injectRegister: null` in vite.config so this wrapper is the ONLY registrar.

export async function registerServiceWorker(): Promise<void> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

  const host = window.location.hostname;
  const inIframe = window.self !== window.top;
  const params = new URLSearchParams(window.location.search);
  const killSwitch = params.get("sw") === "off";

  const isPreviewHost =
    host.startsWith("id-preview--") ||
    host.startsWith("preview--") ||
    host === "lovableproject.com" ||
    host.endsWith(".lovableproject.com") ||
    host === "lovableproject-dev.com" ||
    host.endsWith(".lovableproject-dev.com") ||
    host === "beta.lovable.dev" ||
    host.endsWith(".beta.lovable.dev");

  const shouldRefuse = !import.meta.env.PROD || inIframe || isPreviewHost || killSwitch;

  if (shouldRefuse) {
    try {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(
        regs
          .filter((r) => r.active?.scriptURL?.endsWith("/sw.js"))
          .map((r) => r.unregister())
      );
    } catch {
      /* noop */
    }
    return;
  }

  try {
    const { registerSW } = await import("virtual:pwa-register");
    registerSW({
      immediate: true,
      onRegisteredSW(swUrl) {
        console.info("✅ SW registered:", swUrl);
      },
      onRegisterError(err) {
        console.error("❌ SW registration failed:", err);
      },
    });
  } catch (err) {
    console.warn("PWA registration wrapper unavailable:", err);
  }
}
