import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, QrCode, Loader2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface QRCodeDisplayProps {
  uid: string;
  name: string;
  size?: number;
  showDownload?: boolean;
  className?: string;
}

const QRCodeDisplay: React.FC<QRCodeDisplayProps> = ({
  uid,
  name,
  size = 200,
  showDownload = true,
  className,
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(uid)}&format=png&margin=10`;

  const handleDownload = async () => {
    try {
      const response = await fetch(qrCodeUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = `QR_${uid}_${name.replace(/\s+/g, '_')}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      toast({
        title: "Berhasil",
        description: "QR Code berhasil diunduh"
      });
    } catch (error) {
      console.error('Error downloading QR code:', error);
      toast({
        title: "Gagal",
        description: "Gagal mengunduh QR Code",
        variant: "destructive"
      });
    }
  };

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <QrCode className="h-5 w-5" />
          QR Code Absensi
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-4">
        <div className="relative bg-white p-4 rounded-lg border shadow-sm">
          {isLoading && !hasError && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/80">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          )}
          {hasError ? (
            <div className="flex flex-col items-center justify-center p-8 text-muted-foreground">
              <QrCode className="h-12 w-12 mb-2 opacity-50" />
              <p className="text-sm">Gagal memuat QR Code</p>
            </div>
          ) : (
            <img
              src={qrCodeUrl}
              alt={`QR Code untuk ${name}`}
              width={size}
              height={size}
              onLoad={() => setIsLoading(false)}
              onError={() => {
                setIsLoading(false);
                setHasError(true);
              }}
              className={isLoading ? 'opacity-0' : 'opacity-100 transition-opacity'}
            />
          )}
        </div>
        
        <div className="text-center">
          <p className="text-sm font-medium">{name}</p>
          <p className="text-xs text-muted-foreground font-mono">{uid}</p>
        </div>
        
        {showDownload && !hasError && (
          <Button onClick={handleDownload} variant="outline" className="w-full">
            <Download className="h-4 w-4 mr-2" />
            Download QR Code
          </Button>
        )}
      </CardContent>
    </Card>
  );
};

export default QRCodeDisplay;
