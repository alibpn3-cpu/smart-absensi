import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

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

      const updateData: Record<string, any> = {
        [statusField]: action,
        [notesField]: notes || null,
        [approvedAtField]: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // Add recommendation & other_decisions for leave requests supervisor
      if (requestType === 'leave' && approverRole === 'supervisor') {
        updateData.supervisor_recommendation = recommendation || null;
      }
      if (requestType === 'leave' && approverRole === 'hcga') {
        updateData.other_decisions = otherDecisions || null;
      }

      // Check if both approvals are done to set final status
      const { data: currentReq } = await supabase.from(table).select('supervisor_status, hcga_status').eq('id', requestId).single();

      if (currentReq) {
        const supervisorFinal = approverRole === 'supervisor' ? action : currentReq.supervisor_status;
        const hcgaFinal = approverRole === 'hcga' ? action : currentReq.hcga_status;

        if (supervisorFinal === 'approved' && hcgaFinal === 'approved') {
          updateData.status = 'approved';
          // Update leave balance if leave request approved
          if (requestType === 'leave') {
            const { data: leaveReq } = await supabase.from('leave_requests').select('staff_uid, leave_year, days_requested').eq('id', requestId).single();
            if (leaveReq) {
              await supabase.from('leave_balances')
                .update({ used_days: supabase.rpc as any })
                .eq('staff_uid', leaveReq.staff_uid)
                .eq('year', leaveReq.leave_year);
              // Simple increment
              const { data: balance } = await supabase.from('leave_balances')
                .select('used_days')
                .eq('staff_uid', leaveReq.staff_uid)
                .eq('year', leaveReq.leave_year)
                .single();
              if (balance) {
                await supabase.from('leave_balances')
                  .update({ used_days: balance.used_days + leaveReq.days_requested })
                  .eq('staff_uid', leaveReq.staff_uid)
                  .eq('year', leaveReq.leave_year);
              }
            }
          }
        } else if (supervisorFinal === 'rejected' || hcgaFinal === 'rejected') {
          updateData.status = 'rejected';
        }
      }

      const { error } = await supabase.from(table).update(updateData).eq('id', requestId);
      if (error) throw error;

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
