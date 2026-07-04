import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { notifyStatusUpdate, notifyApproverNewRequest } from '@/utils/notificationHelper';

interface RequestApprovalDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onApproved: () => void;
  requestId: string;
  requestNumber: string;
  requestType: 'leave' | 'permission';
  approverRole: 'supervisor' | 'hcga';
  staffName: string;
}

const RequestApprovalDialog: React.FC<RequestApprovalDialogProps> = ({
  isOpen, onClose, onApproved, requestId, requestNumber, requestType, approverRole, staffName
}) => {
  const [notes, setNotes] = useState('');
  const [recommendation, setRecommendation] = useState('');
  const [otherDecisions, setOtherDecisions] = useState('');
  const [loading, setLoading] = useState(false);

  const handleAction = async (action: 'approved' | 'rejected') => {
    setLoading(true);
    try {
      const table = requestType === 'leave' ? 'leave_requests' : 'permission_requests';
      const statusField = approverRole === 'supervisor' ? 'supervisor_status' : 'hcga_status';
      const notesField = approverRole === 'supervisor' ? 'supervisor_notes' : 'hcga_notes';
      const approvedAtField = approverRole === 'supervisor' ? 'supervisor_approved_at' : 'hcga_approved_at';

      const userSession = JSON.parse(localStorage.getItem('userSession') || '{}');
      const approverUidField = approverRole === 'supervisor' ? 'supervisor_uid' : 'hcga_approver_uid';

      const updateData: Record<string, any> = {
        [statusField]: action,
        [notesField]: notes || null,
        [approvedAtField]: new Date().toISOString(),
        [approverUidField]: userSession.uid || null,
        updated_at: new Date().toISOString(),
      };

      if (requestType === 'leave' && approverRole === 'supervisor') {
        updateData.supervisor_recommendation = recommendation || null;
      }
      if (requestType === 'leave' && approverRole === 'hcga') {
        updateData.other_decisions = otherDecisions || null;
      }

      // Check if both approvals are done
      const { data: currentReq } = await supabase.from(table).select('*').eq('id', requestId).single() as { data: any };

      if (currentReq) {
        const supervisorFinal = approverRole === 'supervisor' ? action : currentReq.supervisor_status;
        const hcgaFinal = approverRole === 'hcga' ? action : currentReq.hcga_status;
        // Supervisor-only mode: if no HC&GA approver assigned on the request,
        // supervisor's decision finalizes the request.
        const supervisorOnly = !currentReq.hcga_approver_uid;

        const finalizeApproved = supervisorOnly
          ? supervisorFinal === 'approved'
          : (supervisorFinal === 'approved' && hcgaFinal === 'approved');

        if (finalizeApproved) {
          updateData.status = 'approved';
          // In supervisor-only mode, mark hcga_status as skipped for clarity
          if (supervisorOnly && approverRole === 'supervisor') {
            updateData.hcga_status = 'skipped';
          }
          // Update leave balance
          if (requestType === 'leave') {
            const { data: balance } = await supabase.from('leave_balances')
              .select('used_days')
              .eq('staff_uid', currentReq.staff_uid)
              .eq('year', currentReq.leave_year)
              .single();
            if (balance) {
              await supabase.from('leave_balances')
                .update({ used_days: balance.used_days + currentReq.days_requested })
                .eq('staff_uid', currentReq.staff_uid)
                .eq('year', currentReq.leave_year);
            }
          }
        } else if (supervisorFinal === 'rejected' || hcgaFinal === 'rejected') {
          updateData.status = 'rejected';
        }

        const { error } = await supabase.from(table).update(updateData).eq('id', requestId);
        if (error) throw error;

        // Send notifications
        const reqTypeName = requestType === 'leave' ? 'Cuti' : 'Ijin';
        const approverName = userSession.name || approverRole;

        // Notify the staff about status
        notifyStatusUpdate({
          requestNumber,
          requestType: reqTypeName,
          staffUid: currentReq.staff_uid,
          staffName: currentReq.staff_name,
          status: action,
          approverName,
          notes: notes || undefined,
        });

        // If supervisor approved AND HC&GA approver exists, notify HC&GA for next approval
        if (approverRole === 'supervisor' && action === 'approved' && currentReq.hcga_approver_uid) {
          notifyApproverNewRequest({
            requestId,
            requestNumber,
            requestType: reqTypeName,
            creatorName: currentReq.staff_name,
            approverUid: currentReq.hcga_approver_uid,
            details: `Sudah disetujui oleh atasan (${approverName})`,
          });
        }
      }

      toast({
        title: action === 'approved' ? "Disetujui" : "Ditolak",
        description: `Permintaan ${requestNumber} telah ${action === 'approved' ? 'disetujui' : 'ditolak'}`
      });
      setNotes('');
      setRecommendation('');
      setOtherDecisions('');
      onApproved();
      onClose();
    } catch (error: any) {
      toast({ title: "Gagal", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Review Permintaan {requestType === 'leave' ? 'Cuti' : 'Ijin'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="text-sm bg-muted/50 p-3 rounded-lg">
            <p><strong>No:</strong> {requestNumber}</p>
            <p><strong>Staff:</strong> {staffName}</p>
          </div>

          <div className="space-y-2">
            <Label>Catatan {approverRole === 'supervisor' ? 'Atasan' : 'HC&GA Site'}</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Catatan (opsional)" rows={2} />
          </div>

          {requestType === 'leave' && approverRole === 'supervisor' && (
            <div className="space-y-2">
              <Label>Rekomendasi Atasan</Label>
              <Textarea value={recommendation} onChange={(e) => setRecommendation(e.target.value)} placeholder="Rekomendasi (opsional)" rows={2} />
            </div>
          )}

          {requestType === 'leave' && approverRole === 'hcga' && (
            <div className="space-y-2">
              <Label>Keputusan Lainnya</Label>
              <Textarea value={otherDecisions} onChange={(e) => setOtherDecisions(e.target.value)} placeholder="Keputusan lainnya (opsional)" rows={2} />
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="destructive" onClick={() => handleAction('rejected')} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <XCircle className="h-4 w-4 mr-1" />}
            Tolak
          </Button>
          <Button onClick={() => handleAction('approved')} disabled={loading} className="bg-green-600 hover:bg-green-700">
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <CheckCircle className="h-4 w-4 mr-1" />}
            Setujui
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default RequestApprovalDialog;
