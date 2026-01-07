import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { CheckCircle, Clock, AlertCircle, LogIn, LogOut, MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AttendanceStatusCardProps {
  checkInTime: string | null;
  checkOutTime: string | null;
  status: 'wfo' | 'wfh' | 'dinas' | null;
  checkinLocationAddress?: string | null;
  checkoutLocationAddress?: string | null;
  className?: string;
}

const AttendanceStatusCard: React.FC<AttendanceStatusCardProps> = ({
  checkInTime,
  checkOutTime,
  status,
  checkinLocationAddress,
  checkoutLocationAddress,
  className,
}) => {
  // Determine current state
  const hasCheckedIn = !!checkInTime;
  const hasCheckedOut = !!checkOutTime;
  const isComplete = hasCheckedIn && hasCheckedOut;

  // Format time for display
  const formatTime = (timeString: string | null) => {
    if (!timeString) return '-';
    try {
      const date = new Date(timeString);
      return date.toLocaleTimeString('id-ID', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: false 
      });
    } catch {
      return timeString;
    }
  };

  // Shorten address for display (get first meaningful part)
  const shortenAddress = (address: string | null | undefined): string | null => {
    if (!address) return null;
    // Get first part before comma, max 30 chars
    const parts = address.split(',');
    const firstPart = parts[0].trim();
    return firstPart.length > 30 ? firstPart.substring(0, 27) + '...' : firstPart;
  };

  // Get status label
  const getStatusLabel = (s: 'wfo' | 'wfh' | 'dinas' | null) => {
    if (!s) return '';
    const labels = {
      wfo: 'WFO',
      wfh: 'WFH',
      dinas: 'Dinas'
    };
    return labels[s];
  };

  // Determine display config based on state
  const getConfig = () => {
    if (isComplete) {
      return {
        icon: <CheckCircle className="h-6 w-6 text-blue-500" />,
        title: 'Selesai',
        subtitle: `${getStatusLabel(status)} - Sudah In & Out`,
        bgClass: 'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800',
        textClass: 'text-blue-700 dark:text-blue-300',
        showTimes: true,
      };
    }
    
    if (hasCheckedIn) {
      return {
        icon: <Clock className="h-6 w-6 text-green-500 animate-pulse" />,
        title: 'Sudah Clock-In',
        subtitle: `${getStatusLabel(status)} - Menunggu Clock-Out`,
        bgClass: 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800',
        textClass: 'text-green-700 dark:text-green-300',
        showTimes: true,
      };
    }

    return {
      icon: <AlertCircle className="h-6 w-6 text-amber-500" />,
      title: 'Belum Clock-In',
      subtitle: 'Silakan lakukan presensi',
      bgClass: 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800',
      textClass: 'text-amber-700 dark:text-amber-300',
      showTimes: false,
    };
  };

  const config = getConfig();
  const shortCheckinLocation = shortenAddress(checkinLocationAddress);
  const shortCheckoutLocation = shortenAddress(checkoutLocationAddress);

  return (
    <Card className={cn('border-0 shadow-md rounded-xl', config.bgClass, className)}>
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          {/* Status Icon */}
          <div className="shrink-0 mt-1">
            {config.icon}
          </div>

          {/* Status Info */}
          <div className="flex-1 min-w-0 space-y-2">
            <div>
              <h3 className={cn('font-semibold text-base', config.textClass)}>
                {config.title}
              </h3>
              <p className="text-sm text-muted-foreground truncate">
                {config.subtitle}
              </p>
            </div>

            {/* Times and Locations */}
            {config.showTimes && (
              <div className="flex flex-col gap-1.5 text-sm">
                {/* Clock In */}
                <div className="flex items-center gap-2">
                  <LogIn className="h-4 w-4 text-green-500 shrink-0" />
                  <span className="font-medium">{formatTime(checkInTime)}</span>
                  {shortCheckinLocation && (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground truncate">
                      <MapPin className="h-3 w-3 shrink-0" />
                      <span className="truncate">{shortCheckinLocation}</span>
                    </span>
                  )}
                </div>
                
                {/* Clock Out */}
                {hasCheckedOut && (
                  <div className="flex items-center gap-2">
                    <LogOut className="h-4 w-4 text-red-500 shrink-0" />
                    <span className="font-medium">{formatTime(checkOutTime)}</span>
                    {shortCheckoutLocation && (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground truncate">
                        <MapPin className="h-3 w-3 shrink-0" />
                        <span className="truncate">{shortCheckoutLocation}</span>
                      </span>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default AttendanceStatusCard;
