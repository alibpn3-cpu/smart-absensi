import React from 'react';
import { CloudOff, Cloud, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useOfflineSync } from '@/hooks/useOfflineSync';

/**
 * Small badge shown at the top of AttendanceForm when there are queued
 * offline attendance entries OR the device is currently offline. Provides
 * a manual sync trigger.
 */
export default function OfflineQueueBadge() {
  const { count, isOnline, syncing, runSync } = useOfflineSync();

  if (count === 0 && isOnline) return null;

  return (
    <div
      className={
        'flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm ' +
        (isOnline
          ? 'border-amber-500/40 bg-amber-500/10 text-amber-100'
          : 'border-red-500/40 bg-red-500/10 text-red-100')
      }
      role="status"
    >
      <div className="flex items-center gap-2 min-w-0">
        {isOnline ? <Cloud className="h-4 w-4 shrink-0" /> : <CloudOff className="h-4 w-4 shrink-0" />}
        <span className="truncate">
          {isOnline
            ? `${count} absensi offline menunggu sync`
            : count > 0
              ? `Offline — ${count} absensi tersimpan lokal`
              : 'Sedang offline'}
        </span>
      </div>
      {count > 0 && isOnline && (
        <Button
          size="sm"
          variant="outline"
          disabled={syncing}
          onClick={() => runSync().catch(() => {})}
          className="h-7 px-2"
        >
          <RefreshCw className={'h-3.5 w-3.5 mr-1 ' + (syncing ? 'animate-spin' : '')} />
          Sync
        </Button>
      )}
    </div>
  );
}
