import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Clock, RefreshCw } from 'lucide-react';

interface Props {
  open: boolean;
  skewSeconds: number | null;
  checking: boolean;
  onRecheck: () => void;
  onDismiss: () => void;
}

function formatSkew(seconds: number | null): string {
  if (seconds == null) return '-';
  const abs = Math.abs(seconds);
  const m = Math.floor(abs / 60);
  const s = abs % 60;
  if (m === 0) return `${s} detik`;
  if (s === 0) return `${m} menit`;
  return `${m} menit ${s} detik`;
}

const ClockInvalidDialog: React.FC<Props> = ({
  open,
  skewSeconds,
  checking,
  onRecheck,
  onDismiss,
}) => {
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onDismiss(); }}>
      <DialogContent
        className="max-w-sm rounded-2xl"
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="text-lg font-bold flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Pengaturan waktu tidak valid
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col items-center text-center py-2 gap-4">
          <div className="relative">
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center border-2 border-purple-500/30">
              <Clock className="h-12 w-12 text-purple-500" />
            </div>
            <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-destructive flex items-center justify-center shadow-lg">
              <AlertTriangle className="h-4 w-4 text-white" />
            </div>
          </div>

          <p className="text-sm text-muted-foreground leading-relaxed">
            Aktifkan <span className="font-semibold text-foreground">Tanggal &amp; Waktu Otomatis</span>{' '}
            pada perangkat Anda agar dapat disinkronkan dengan server Digital Presensi.
          </p>

          {skewSeconds != null && (
            <div className="text-xs px-3 py-2 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive font-medium">
              Selisih jam: {formatSkew(skewSeconds)}
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            Setelah memperbaiki jam, tekan <strong>Cek ulang</strong>. Tombol presensi akan
            aktif kembali secara otomatis.
          </p>
        </div>

        <div className="flex flex-col gap-2 pt-2">
          <Button
            onClick={onRecheck}
            disabled={checking}
            className="w-full h-11 rounded-full font-semibold"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${checking ? 'animate-spin' : ''}`} />
            {checking ? 'Memeriksa...' : 'Cek ulang sekarang'}
          </Button>
          <Button
            onClick={onDismiss}
            variant="ghost"
            className="w-full h-10 rounded-full text-muted-foreground"
          >
            Kembali ke dasbor
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ClockInvalidDialog;
