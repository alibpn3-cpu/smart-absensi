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
}

const StatusPresensiDialog: React.FC<StatusPresensiDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  actionType,
  defaultStatus = 'wfo',
  loading = false
}) => {
  const [status, setStatus] = useState<'wfo' | 'wfh' | 'dinas'>(defaultStatus);
  const [reason, setReason] = useState('');

  // Reset form when dialog opens
  useEffect(() => {
    if (isOpen) {
      setStatus(defaultStatus);
      setReason('');
    }
  }, [isOpen, defaultStatus]);

  const handleConfirm = () => {
    onConfirm(status, reason);
  };

  const getActionLabel = () => {
    switch (actionType) {
      case 'check-in':
        return 'Check In';
      case 'check-out':
        return 'Check Out';
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
          {/* Status Selection */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Status Presensi</Label>
            <RadioGroup
              value={status}
              onValueChange={(value) => setStatus(value as 'wfo' | 'wfh' | 'dinas')}
              className="grid grid-cols-3 gap-3"
              disabled={loading}
            >
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
