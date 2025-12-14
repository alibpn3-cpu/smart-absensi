import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import { Camera, X } from 'lucide-react';

interface QRCodeScannerProps {
  isOpen: boolean;
  onClose: () => void;
  onScanSuccess: (staffUid: string) => void;
}

const QRCodeScanner: React.FC<QRCodeScannerProps> = ({ isOpen, onClose, onScanSuccess }) => {
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const scannerId = useRef(`qr-reader-${Date.now()}`);

  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        startScanner();
      }, 200);
    
    return () => {
      clearTimeout(timer);
      stopScanner();
    };
    }
  }, [isOpen]);

  const startScanner = async () => {
    if (!containerRef.current) return;
    
    try {
      setError(null);
      setIsScanning(true);
      
      // Create scanner instance
      const html5QrCode = new Html5Qrcode(scannerId.current);
      scannerRef.current = html5QrCode;
        
      await html5QrCode.start(
        { facingMode: 'user' }, // 🟢 KAMERA DEPAN (KIOSK)
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1,
          disableFlip: false,
        },
        (decodedText) => {
          console.log('📱 QR Code scanned:', decodedText);
          
          // Extract UID from QR code
          // QR code format could be just UID or JSON with uid field
          let staffUid = decodedText;
          
          try {
            const parsed = JSON.parse(decodedText);
            if (parsed.uid) {
              staffUid = parsed.uid;
            }
          } catch {
            // Not JSON, use as-is (direct UID)
            staffUid = decodedText.trim();
          }
          
          // Stop scanning and notify parent
          stopScanner();
          onScanSuccess(staffUid);
          onClose();
          
          toast({
            title: "✅ QR Code Terdeteksi",
            description: `UID: ${staffUid}`
          });
        },
        (errorMessage) => {
          // Ignore decode errors during scanning
        }
      );
      
    } catch (err: any) {
      console.error('QR Scanner error:', err);
      setIsScanning(false);
      
      let errorMsg = 'Gagal mengakses kamera';
      if (err.message?.includes('Permission')) {
        errorMsg = 'Izin kamera ditolak. Silakan izinkan akses kamera.';
      } else if (err.message?.includes('NotFound')) {
        errorMsg = 'Kamera tidak ditemukan.';
      } else if (err.message) {
        errorMsg = err.message;
      }
      
      setError(errorMsg);
    }
  };

  const stopScanner = async () => {
    if (scannerRef.current) {
      try {
        const state = scannerRef.current.getState();
        if (state === 2) { // 2 = SCANNING state
          await scannerRef.current.stop();
        }
        scannerRef.current.clear();
      } catch (err) {
        console.log('Scanner already stopped');
      }
      scannerRef.current = null;
    }
    setIsScanning(false);
  };

  const handleClose = () => {
    stopScanner();
    onClose();
  };

  return (
    <Dialog
  open={isOpen}
  onOpenChange={(open) => {
    if (!open) handleClose();
  }}
>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5" />
            Scan QR Code
          </DialogTitle>
          <DialogDescription>
            Arahkan QR Code pada ID Card ke kamera
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex flex-col items-center gap-4">
          {error ? (
            <div className="text-center space-y-4">
              <p className="text-destructive text-sm">{error}</p>
              <Button onClick={startScanner} variant="outline">
                Coba Lagi
              </Button>
            </div>
          ) : (
            <>
              <div 
                id={scannerId.current} 
                ref={containerRef}
                className="w-full aspect-square max-w-[300px] rounded-lg overflow-hidden bg-muted"
              />
              {isScanning && (
                <p className="text-sm text-muted-foreground animate-pulse">
                  🔍 Mencari QR Code...
                </p>
              )}
            </>
          )}
          
          <Button 
            onClick={handleClose} 
            variant="outline" 
            className="w-full"
          >
            <X className="h-4 w-4 mr-2" />
            Tutup
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default QRCodeScanner;
