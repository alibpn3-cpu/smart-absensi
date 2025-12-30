import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Building2, Home, Car, Loader2 } from 'lucide-react';

interface StatusPresensiDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (status: 'wfo' | 'wfh' | 'dinas', reason: string) => void;
  actionType: 'check-in' | 'check-out' | 'in-extend' | 'out-extend';
  defaultStatus?: 'wfo' | 'wfh' | 'dinas';
  loading?: boolean;
  checkInStatus?: 'wfo' | 'wfh' | 'dinas' | null; // Status saat check-in untuk membatasi pilihan checkout
}

const StatusPresensiDialog: React.FC<StatusPresensiDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  actionType,
  defaultStatus = 'wfo',
  loading = false,
  checkInStatus = null
}) => {
  const [status, setStatus] = useState<'wfo' | 'wfh' | 'dinas'>(defaultStatus);
  const [reason, setReason] = useState('');

  // Determine allowed statuses based on check-in status for checkout
  const isCheckout = actionType === 'check-out' || actionType === 'out-extend';
  
  const getAllowedStatuses = (): ('wfo' | 'wfh' | 'dinas')[] => {
    // Semua status tersedia untuk check-in DAN check-out
    // User bebas memilih status apapun
    return ['wfo', 'wfh', 'dinas'];
  };
  
  const allowedStatuses = getAllowedStatuses();

  // Reset form when dialog opens
  useEffect(() => {
    if (isOpen) {
      // Set default status based on allowed statuses
      if (isCheckout && checkInStatus && allowedStatuses.includes(checkInStatus)) {
        setStatus(checkInStatus);
      } else if (allowedStatuses.includes(defaultStatus)) {
        setStatus(defaultStatus);
      } else {
        setStatus(allowedStatuses[0]);
      }
      setReason('');
    }
  }, [isOpen, defaultStatus, checkInStatus, isCheckout]);

  const handleConfirm = () => {
    onConfirm(status, reason);
  };

  const getActionLabel = () => {
    switch (actionType) {
      case 'check-in':
        return 'Clock In';
      case 'check-out':
        return 'Clock Out';
      case 'in-extend':
        return 'In Extend (Lembur)';
      case 'out-extend':
        return 'Out Extend (Lembur)';
      default:
        return 'Presensi';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && !loading && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold">
            Status Presensi - {getActionLabel()}
          </DialogTitle>
          <DialogDescription>
            Pilih status presensi dan tambahkan alasan jika diperlukan.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Info Status Check-In saat Checkout */}
          {isCheckout && checkInStatus && (
            <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
              <p className="text-sm text-blue-700 dark:text-blue-300">
                <span className="font-medium">Status saat Clock-In:</span>{' '}
                <span className="font-bold uppercase">{checkInStatus}</span>
              </p>
              <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                Anda dapat memilih status berbeda untuk Clock-Out
              </p>
            </div>
          )}

          {/* Status Selection */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">
              Status Presensi
            </Label>
            <RadioGroup
              value={status}
              onValueChange={(value) => setStatus(value as 'wfo' | 'wfh' | 'dinas')}
              className={`grid gap-3 ${allowedStatuses.length === 1 ? 'grid-cols-1' : allowedStatuses.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}
              disabled={loading}
            >
              {allowedStatuses.includes('wfo') && (
                <div>
                  <RadioGroupItem value="wfo" id="wfo" className="peer sr-only" />
                  <Label
                    htmlFor="wfo"
                    className="flex flex-col items-center justify-center rounded-lg border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/10 cursor-pointer transition-all"
                  >
                    <Building2 className="h-6 w-6 mb-2 text-primary" />
                    <span className="text-sm font-medium">WFO</span>
                    <span className="text-xs text-muted-foreground">Di Kantor</span>
                  </Label>
                </div>
              )}

              {allowedStatuses.includes('wfh') && (
                <div>
                  <RadioGroupItem value="wfh" id="wfh" className="peer sr-only" />
                  <Label
                    htmlFor="wfh"
                    className="flex flex-col items-center justify-center rounded-lg border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/10 cursor-pointer transition-all"
                  >
                    <Home className="h-6 w-6 mb-2 text-blue-500" />
                    <span className="text-sm font-medium">WFH</span>
                    <span className="text-xs text-muted-foreground">Di Rumah</span>
                  </Label>
                </div>
              )}

              {allowedStatuses.includes('dinas') && (
                <div>
                  <RadioGroupItem value="dinas" id="dinas" className="peer sr-only" />
                  <Label
                    htmlFor="dinas"
                    className="flex flex-col items-center justify-center rounded-lg border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/10 cursor-pointer transition-all"
                  >
                    <Car className="h-6 w-6 mb-2 text-orange-500" />
                    <span className="text-sm font-medium">Dinas</span>
                    <span className="text-xs text-muted-foreground">Luar Kantor</span>
                  </Label>
                </div>
              )}
            </RadioGroup>
          </div>

          {/* Reason Input */}
          <div className="space-y-2">
            <Label htmlFor="reason" className="text-sm font-medium">
              Alasan Presensi <span className="text-muted-foreground">(Opsional)</span>
            </Label>
            <Textarea
              id="reason"
              placeholder="Contoh: Meeting dengan klien di lokasi X"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={loading}
              rows={3}
              className="resize-none"
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={loading}
            className="flex-1"
          >
            Batal
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={loading}
            className="flex-1"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Memproses...
              </>
            ) : (
              'Konfirmasi'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default StatusPresensiDialog;
