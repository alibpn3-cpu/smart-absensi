import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { setTimeSyncVerifiedNow } from '@/utils/antiJokiCache';

/**
 * Clock skew guard (timezone-agnostic).
 *
 * Compares device epoch (UTC ms) with server epoch from the `time-sync` edge
 * function. If the skew exceeds the threshold, surface `isClockInvalid = true`
 * so the UI can hard-block attendance actions and show a modal.
 *
 * Fail-open behavior: if the server is unreachable (offline / network error),
 * we deliberately set `isClockInvalid = false` so users in the field are not
 * locked out of the app. The server still records `now()` for the actual
 * attendance row, so this guard is a UX deterrent on top of the existing
 * server-side flag.
 */

const THRESHOLD_SECONDS = 120; // 2 minutes
const MAX_ACCEPTABLE_RTT_MS = 8000; // relaxed for slow networks (mining/field areas)
const POLL_INTERVAL_MS = 5 * 60 * 1000; // re-check every 5 minutes

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
      const t0 = Date.now();
      try {
        const { data, error } = await supabase.functions.invoke('time-sync', {
          method: 'GET',
        });
        const t1 = Date.now();
        const rtt = t1 - t0;

        if (error || !data || typeof (data as any).server_epoch_ms !== 'number') {
          // Network/server error → fail open.
          setState({
            isClockInvalid: false,
            skewSeconds: null,
            lastCheckedAt: t1,
            checking: false,
          });
          return false;
        }

        if (rtt > MAX_ACCEPTABLE_RTT_MS) {
          // Slow network: RTT too large to accurately compute skew, but the
          // server responded — that's enough to prove the device isn't offline
          // manipulating its clock. Mark verified so anti-joki doesn't hard-flag.
          setTimeSyncVerifiedNow();
          setState((s) => ({ ...s, checking: false, lastCheckedAt: t1 }));
          return false;
        }

        const serverMs = (data as any).server_epoch_ms as number;
        // Estimate device time at the midpoint of the request.
        const deviceMidMs = t0 + rtt / 2;
        const skewMs = Math.abs(serverMs - deviceMidMs);
        const skewSec = Math.round(skewMs / 1000);
        const invalid = skewSec > THRESHOLD_SECONDS;
        if (!invalid) setTimeSyncVerifiedNow();


        setState({
          isClockInvalid: invalid,
          skewSeconds: skewSec,
          lastCheckedAt: t1,
          checking: false,
        });
        return invalid;
      } catch {
        setState({
          isClockInvalid: false,
          skewSeconds: null,
          lastCheckedAt: Date.now(),
          checking: false,
        });
        return false;
      } finally {
        inflight.current = null;
      }
    })();

    inflight.current = p;
    return p;
  }, []);

  useEffect(() => {
    doCheck();
    const id = setInterval(() => {
      doCheck();
    }, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [doCheck]);

  return {
    ...state,
    recheck: doCheck,
  };
}
