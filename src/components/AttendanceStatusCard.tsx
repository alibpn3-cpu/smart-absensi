import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { CheckCircle, Clock, AlertCircle, LogIn, LogOut } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AttendanceStatusCardProps {
  checkInTime: string | null;
  checkOutTime: string | null;
  status: 'wfo' | 'wfh' | 'dinas' | null;
  className?: string;
}

const AttendanceStatusCard: React.FC<AttendanceStatusCardProps> = ({
  checkInTime,
  checkOutTime,
  status,
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
        title: 'Sudah Check-In',
        subtitle: `${getStatusLabel(status)} - Menunggu Check-Out`,
        bgClass: 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800',
        textClass: 'text-green-700 dark:text-green-300',
        showTimes: true,
      };
    }

    return {
      icon: <AlertCircle className="h-6 w-6 text-amber-500" />,
      title: 'Belum Check-In',
      subtitle: 'Silakan lakukan presensi',
      bgClass: 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800',
      textClass: 'text-amber-700 dark:text-amber-300',
      showTimes: false,
    };
  };

  const config = getConfig();

  return (
    <Card className={cn('border shadow-lg', config.bgClass, className)}>
      <CardContent className="p-4">
        <div className="flex items-center gap-4">
          {/* Status Icon */}
          <div className="shrink-0">
            {config.icon}
          </div>

          {/* Status Info */}
          <div className="flex-1 min-w-0">
            <h3 className={cn('font-semibold text-base', config.textClass)}>
              {config.title}
            </h3>
            <p className="text-sm text-muted-foreground truncate">
              {config.subtitle}
            </p>
          </div>

          {/* Times */}
          {config.showTimes && (
            <div className="flex items-center gap-3 text-sm shrink-0">
              <div className="flex items-center gap-1.5">
                <LogIn className="h-4 w-4 text-green-500" />
                <span className="font-medium">{formatTime(checkInTime)}</span>
              </div>
              {hasCheckedOut && (
                <div className="flex items-center gap-1.5">
                  <LogOut className="h-4 w-4 text-red-500" />
                  <span className="font-medium">{formatTime(checkOutTime)}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default AttendanceStatusCard;
