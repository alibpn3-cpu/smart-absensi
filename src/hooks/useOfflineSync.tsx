import { useEffect, useState, useCallback } from 'react';
import { syncOfflineQueue, queueCount, type SyncResult } from '@/utils/offlineAttendanceQueue';
import { toast } from '@/hooks/use-toast';

/**
 * Auto-sync queued offline attendance entries when the browser regains
 * connectivity, plus a periodic tick while the tab is active, plus a manual
 * sync trigger for a UI button.
 */
export function useOfflineSync() {
  const [count, setCount] = useState<number>(0);
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator === 'undefined' ? true : navigator.onLine
  );
  const [syncing, setSyncing] = useState(false);

  const refreshCount = useCallback(async () => {
    setCount(await queueCount());
  }, []);

  const runSync = useCallback(async (): Promise<SyncResult> => {
    setSyncing(true);
    try {
      const res = await syncOfflineQueue();
      if (res.succeeded > 0) {
        toast({
          title: '✅ Sinkronisasi offline',
          description: `${res.succeeded} absensi offline berhasil dikirim ke server.`,
        });
      }
      if (res.failed > 0) {
        toast({
          title: '⚠️ Sebagian gagal sync',
          description: `${res.failed} absensi offline gagal dan dipindahkan ke daftar gagal. Cek dengan admin.`,
          variant: 'destructive',
        });
      }
      await refreshCount();
      return res;
    } finally {
      setSyncing(false);
    }
  }, [refreshCount]);

  useEffect(() => {
    refreshCount();
    const onOnline = () => {
      setIsOnline(true);
      runSync().catch(() => {});
    };
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);

    // periodic tick every 30s while tab visible
    const tick = setInterval(() => {
      if (document.visibilityState === 'visible' && navigator.onLine) {
        runSync().catch(() => {});
      } else {
        refreshCount();
      }
    }, 30_000);

    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      clearInterval(tick);
    };
  }, [refreshCount, runSync]);

  return { count, isOnline, syncing, runSync, refreshCount };
}
