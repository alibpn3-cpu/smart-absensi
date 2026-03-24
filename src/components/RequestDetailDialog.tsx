import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import ApprovalProgressLine from './ApprovalProgressLine';

interface RequestDetailDialogProps {
  isOpen: boolean;
  onClose: () => void;
  request: any;
  type: 'leave' | 'permission';
  approverNames: Record<string, string>;
}

const RequestDetailDialog: React.FC<RequestDetailDialogProps> = ({ isOpen, onClose, request, type, approverNames }) => {
  const isLeave = type === 'leave';
  const statusLabel = (s: string | null) => {
    switch (s) {
      case 'approved': return <Badge className="bg-green-100 text-green-800 border-green-300">Disetujui</Badge>;
      case 'rejected': return <Badge variant="destructive">Ditolak</Badge>;
      default: return <Badge variant="secondary">Menunggu</Badge>;
    }
  };

  const Row = ({ label, value }: { label: string; value: React.ReactNode }) => (
    <div className="flex justify-between text-sm py-1">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right max-w-[60%]">{value || '-'}</span>
    </div>
  );

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Detail Permintaan {isLeave ? 'Cuti' : 'Ijin'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-mono">{request.request_number}</span>
            {statusLabel(request.status)}
          </div>

          <Separator />

          <div>
            <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-2">Data Pemohon</h4>
            <Row label="Nama" value={request.staff_name} />
            <Row label="UID" value={request.staff_uid} />
            <Row label="Jabatan" value={request.position} />
            <Row label="Departemen" value={request.department} />
            {request.join_date && <Row label="Mulai Kerja" value={format(new Date(request.join_date), 'dd MMM yyyy', { locale: idLocale })} />}
          </div>

          <Separator />

          <div>
            <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-2">Detail Permintaan</h4>
            {isLeave ? (
              <>
                <Row label="Periode Cuti" value={`Tahun ${request.leave_year}`} />
                <Row label="Jumlah Hari" value={`${request.days_requested} hari`} />
                <Row label="Tanggal Cuti" value={
                  Array.isArray(request.leave_dates) 
                    ? (request.leave_dates as string[]).map((d: string) => {
                        try { return format(new Date(d), 'dd MMM yyyy', { locale: idLocale }); } catch { return d; }
                      }).join(', ')
                    : '-'
                } />
                <Row label="Sisa Cuti Setelah" value={request.remaining_balance != null ? `${request.remaining_balance} hari` : '-'} />
                {request.previous_year_balance != null && <Row label="Sisa Tahun Lalu" value={`${request.previous_year_balance} hari`} />}
              </>
            ) : (
              <>
                <Row label="Durasi" value={request.permission_duration} />
                <Row label="Tanggal" value={request.permission_date ? format(new Date(request.permission_date), 'dd MMM yyyy', { locale: idLocale }) : '-'} />
                <Row label="No. HP" value={request.phone_number} />
                <Row label="Alasan" value={request.reason} />
              </>
            )}
          </div>

          <Separator />

          <div>
            <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-2">Status Approval</h4>
            <ApprovalProgressLine
              supervisorStatus={request.supervisor_status || 'pending'}
              hcgaStatus={request.hcga_status || 'pending'}
              supervisorName={approverNames[request.supervisor_uid || '']}
              hcgaName={approverNames[request.hcga_approver_uid || '']}
            />
            {request.supervisor_notes && (
              <div className="mt-2 text-sm bg-muted/50 p-2 rounded">
                <span className="text-muted-foreground">Catatan Atasan:</span> {request.supervisor_notes}
              </div>
            )}
            {request.hcga_notes && (
              <div className="mt-1 text-sm bg-muted/50 p-2 rounded">
                <span className="text-muted-foreground">Catatan HC&GA:</span> {request.hcga_notes}
              </div>
            )}
            {request.supervisor_recommendation && (
              <div className="mt-1 text-sm bg-muted/50 p-2 rounded">
                <span className="text-muted-foreground">Rekomendasi Atasan:</span> {request.supervisor_recommendation}
              </div>
            )}
            {request.other_decisions && (
              <div className="mt-1 text-sm bg-muted/50 p-2 rounded">
                <span className="text-muted-foreground">Keputusan Lain:</span> {request.other_decisions}
              </div>
            )}
          </div>

          <div className="text-[10px] text-muted-foreground">
            Diajukan: {request.created_at ? format(new Date(request.created_at), 'dd MMM yyyy HH:mm', { locale: idLocale }) : '-'}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default RequestDetailDialog;
