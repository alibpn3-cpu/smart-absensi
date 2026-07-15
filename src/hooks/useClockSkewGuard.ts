import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { setTimeSyncVerifiedNow, getTimeSyncVerifiedAt } from '@/utils/antiJokiCache';

/**
 * Clock skew guard (timezone-agnostic).
 *
 * Compares device epoch (UTC ms) with server epoch from the `time-sync` edge
 * function. If the skew exceeds the threshold, surface `isClockInvalid = true`
 * so the UI can hard-block attendance actions and show a modal.
 *
 * Fail-open behavior: if the server is unreachable (offline / network error),
 * we deliberately set `isClockInvalid = false` so users in the field are not
 * locked out of the app.
 *
 * We ALSO honor a persisted "last known good" verification: if the previous
 * time-sync succeeded within the grace window, we don't hard-flag the user
 * just because the current request timed out on a weak network. This is the
 * root cause of the false-positive `clock_manipulated_hard` flood.
 */

const THRESHOLD_SECONDS = 120; // 2 minutes
const MAX_ACCEPTABLE_RTT_MS = 8000; // relaxed for slow networks (mining/field areas)
const POLL_INTERVAL_MS = 5 * 60 * 1000; // re-check every 5 minutes
const LAST_KNOWN_GOOD_GRACE_MS = 6 * 60 * 60 * 1000; // 6h grace
const RETRY_DELAYS_MS = [400, 900, 1800];

interface SkewState {
  isClockInvalid: boolean;
  skewSeconds: number | null;
  lastCheckedAt: number | null;
  checking: boolean;
}

export interface ClockSkewGuard extends SkewState {
  /** Force a fresh check. Returns whether the clock is invalid AFTER the check. */
  recheck: () => Promise<boolean>;
}

async function callTimeSync(): Promise<{ serverMs: number; rtt: number } | null> {
  const t0 = Date.now();
  try {
    const { data, error } = await supabase.functions.invoke('time-sync', { method: 'GET' });
    const t1 = Date.now();
    if (error || !data || typeof (data as any).server_epoch_ms !== 'number') return null;
    return { serverMs: (data as any).server_epoch_ms as number, rtt: t1 - t0 };
  } catch {
    return null;
  }
}

export function useClockSkewGuard(): ClockSkewGuard {
  const [state, setState] = useState<SkewState>({
    isClockInvalid: false,
    skewSeconds: null,
    lastCheckedAt: null,
    checking: false,
  });
  const inflight = useRef<Promise<boolean> | null>(null);

  const doCheck = useCallback(async (): Promise<boolean> => {
    if (inflight.current) return inflight.current;

    const p = (async () => {
      setState((s) => ({ ...s, checking: true }));

      // Retry a few times on transient failures before declaring the server unreachable.
      let sync = await callTimeSync();
      for (let i = 0; !sync && i < RETRY_DELAYS_MS.length; i++) {
        await new Promise((r) => setTimeout(r, RETRY_DELAYS_MS[i]));
        sync = await callTimeSync();
      }

      const now = Date.now();

      if (!sync) {
        // Server unreachable. Honor last-known-good so anti-joki doesn't
        // hard-flag a user just because the network dropped momentarily.
        const lastGoodIso = getTimeSyncVerifiedAt();
        if (lastGoodIso) {
          const t = Date.parse(lastGoodIso);
          if (!isNaN(t) && now - t < LAST_KNOWN_GOOD_GRACE_MS) {
            // Refresh the cached verification so the server also sees it as fresh.
            setTimeSyncVerifiedNow();
          }
        }
        setState({
          isClockInvalid: false,
          skewSeconds: null,
          lastCheckedAt: now,
          checking: false,
        });
        return false;
      }

      const { serverMs, rtt } = sync;

      if (rtt > MAX_ACCEPTABLE_RTT_MS) {
        // Slow network: server responded but RTT is too large to trust skew.
        // Server contact alone proves the device isn't offline-manipulating the clock.
        setTimeSyncVerifiedNow();
        setState((s) => ({ ...s, checking: false, lastCheckedAt: now }));
        return false;
      }

      // Estimate device time at the midpoint of the request.
      const deviceMidMs = now - rtt / 2;
      const skewMs = Math.abs(serverMs - deviceMidMs);
      const skewSec = Math.round(skewMs / 1000);
      const invalid = skewSec > THRESHOLD_SECONDS;
      if (!invalid) setTimeSyncVerifiedNow();

      setState({
        isClockInvalid: invalid,
        skewSeconds: skewSec,
        lastCheckedAt: now,
        checking: false,
      });
      return invalid;
    })().finally(() => {
      inflight.current = null;
    });

    inflight.current = p;
    return p;
  }, []);

  useEffect(() => {
    doCheck();
    const id = setInterval(() => {
      doCheck();
    }, POLL_INTERVAL_MS);

    const onVisible = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        doCheck();
      }
    };
    const onOnline = () => doCheck();
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', onVisible);
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('online', onOnline);
    }

    return () => {
      clearInterval(id);
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', onVisible);
      }
      if (typeof window !== 'undefined') {
        window.removeEventListener('online', onOnline);
      }
    };
  }, [doCheck]);

  return {
    ...state,
    recheck: doCheck,
  };
}
