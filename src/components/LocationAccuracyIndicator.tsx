import React from 'react';
import { Loader2, MapPin, AlertTriangle, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface LocationAccuracyIndicatorProps {
  accuracy: number | null;
  isLoading: boolean;
  onRetry: () => void;
  className?: string;
}

const LocationAccuracyIndicator: React.FC<LocationAccuracyIndicatorProps> = ({
  accuracy,
  isLoading,
  onRetry,
  className,
}) => {
  if (isLoading) {
    return (
      <div className={cn('flex items-center gap-2 p-3 rounded-lg bg-muted', className)}>
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
        <div>
          <p className="text-sm font-medium">Mengambil lokasi...</p>
          <p className="text-xs text-muted-foreground">Pastikan GPS aktif</p>
        </div>
      </div>
    );
  }

  if (accuracy === null) {
    return null;
  }

  const getAccuracyConfig = () => {
    if (accuracy <= 10) {
      return {
        level: 'excellent' as const,
        color: 'text-green-600',
        bgColor: 'bg-green-50 border-green-200',
        icon: <CheckCircle className="h-5 w-5 text-green-600" />,
        label: 'Sangat Akurat',
        description: `Akurasi: ${accuracy.toFixed(0)} meter`,
        showRetry: false,
      };
    }
    if (accuracy <= 30) {
      return {
        level: 'good' as const,
        color: 'text-yellow-600',
        bgColor: 'bg-yellow-50 border-yellow-200',
        icon: <MapPin className="h-5 w-5 text-yellow-600" />,
        label: 'Cukup Akurat',
        description: `Akurasi: ${accuracy.toFixed(0)} meter`,
        showRetry: false,
      };
    }
    return {
      level: 'poor' as const,
      color: 'text-red-600',
      bgColor: 'bg-red-50 border-red-200',
      icon: <AlertTriangle className="h-5 w-5 text-red-600" />,
      label: 'Kurang Akurat',
      description: `Akurasi: ${accuracy.toFixed(0)} meter - Sinyal GPS lemah`,
      showRetry: true,
    };
  };

  const config = getAccuracyConfig();

  return (
    <div className={cn('p-3 rounded-lg border', config.bgColor, className)}>
      <div className="flex items-start gap-3">
        {config.icon}
        <div className="flex-1">
          <p className={cn('text-sm font-medium', config.color)}>{config.label}</p>
          <p className="text-xs text-muted-foreground">{config.description}</p>
        </div>
        {config.showRetry && (
          <Button
            variant="outline"
            size="sm"
            onClick={onRetry}
            className="shrink-0"
          >
            Coba Lagi
          </Button>
        )}
      </div>
    </div>
  );
};

export default LocationAccuracyIndicator;
