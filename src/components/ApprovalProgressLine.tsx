import React from 'react';
import { CheckCircle, Clock, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ApprovalProgressLineProps {
  supervisorStatus: string;
  hcgaStatus: string;
  supervisorName?: string;
  hcgaName?: string;
  compact?: boolean;
}

const ApprovalProgressLine: React.FC<ApprovalProgressLineProps> = ({
  supervisorStatus,
  hcgaStatus,
  supervisorName,
  hcgaName,
  compact = false
}) => {
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved':
        return <CheckCircle className={cn("text-green-500", compact ? "h-4 w-4" : "h-5 w-5")} />;
      case 'rejected':
        return <XCircle className={cn("text-destructive", compact ? "h-4 w-4" : "h-5 w-5")} />;
      default:
        return <Clock className={cn("text-muted-foreground", compact ? "h-4 w-4" : "h-5 w-5")} />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'bg-green-500';
      case 'rejected': return 'bg-destructive';
      default: return 'bg-muted-foreground/30';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'approved': return 'Disetujui';
      case 'rejected': return 'Ditolak';
      default: return 'Menunggu';
    }
  };

  return (
    <div className="flex items-center gap-1 w-full">
      {/* Step 1: Pengajuan */}
      <div className="flex flex-col items-center">
        <div className={cn("rounded-full bg-primary flex items-center justify-center", compact ? "h-5 w-5" : "h-7 w-7")}>
          <CheckCircle className={cn("text-primary-foreground", compact ? "h-3 w-3" : "h-4 w-4")} />
        </div>
        {!compact && <span className="text-[10px] text-muted-foreground mt-1">Diajukan</span>}
      </div>

      {/* Line */}
      <div className={cn("flex-1 h-0.5", getStatusColor(supervisorStatus))} />

      {/* Step 2: Atasan */}
      <div className="flex flex-col items-center">
        <div className={cn("rounded-full border-2 flex items-center justify-center",
          compact ? "h-5 w-5" : "h-7 w-7",
          supervisorStatus === 'approved' ? 'border-green-500 bg-green-50' :
          supervisorStatus === 'rejected' ? 'border-destructive bg-destructive/10' :
          'border-muted-foreground/30 bg-muted'
        )}>
          {getStatusIcon(supervisorStatus)}
        </div>
        {!compact && (
          <div className="text-center">
            <span className="text-[10px] text-muted-foreground block">Atasan</span>
            {supervisorName && <span className="text-[9px] text-muted-foreground/70 block truncate max-w-[60px]">{supervisorName}</span>}
            <span className={cn("text-[9px] font-medium",
              supervisorStatus === 'approved' ? 'text-green-600' :
              supervisorStatus === 'rejected' ? 'text-destructive' : 'text-muted-foreground'
            )}>{getStatusLabel(supervisorStatus)}</span>
          </div>
        )}
      </div>

      {/* Line */}
      <div className={cn("flex-1 h-0.5", getStatusColor(hcgaStatus))} />

      {/* Step 3: HC&GA */}
      <div className="flex flex-col items-center">
        <div className={cn("rounded-full border-2 flex items-center justify-center",
          compact ? "h-5 w-5" : "h-7 w-7",
          hcgaStatus === 'approved' ? 'border-green-500 bg-green-50' :
          hcgaStatus === 'rejected' ? 'border-destructive bg-destructive/10' :
          'border-muted-foreground/30 bg-muted'
        )}>
          {getStatusIcon(hcgaStatus)}
        </div>
        {!compact && (
          <div className="text-center">
            <span className="text-[10px] text-muted-foreground block">HC&GA</span>
            {hcgaName && <span className="text-[9px] text-muted-foreground/70 block truncate max-w-[60px]">{hcgaName}</span>}
            <span className={cn("text-[9px] font-medium",
              hcgaStatus === 'approved' ? 'text-green-600' :
              hcgaStatus === 'rejected' ? 'text-destructive' : 'text-muted-foreground'
            )}>{getStatusLabel(hcgaStatus)}</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default ApprovalProgressLine;
