import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { CalendarIcon, Loader2, ClipboardList } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { notifyRequestSubmitted, notifyApproverNewRequest } from '@/utils/notificationHelper';

interface UserSession {
  uid: string;
  name: string;
  position: string;
  work_area: string;
  division?: string;
  supervisor_uid?: string;
  hcga_approver_uid?: string;
  join_date?: string;
  phone_number?: string;
}

interface PermissionRequestFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmitted: () => void;
}

const PermissionRequestForm: React.FC<PermissionRequestFormProps> = ({ isOpen, onClose, onSubmitted }) => {
  const [loading, setLoading] = useState(false);
  const [userSession, setUserSession] = useState<UserSession | null>(null);
  const [permissionDate, setPermissionDate] = useState<Date>();
  const [duration, setDuration] = useState('');
  const [reason, setReason] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [joinDateStr, setJoinDateStr] = useState('');
  const [supervisorName, setSupervisorName] = useState('');
  const [hcgaName, setHcgaName] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    const sessionData = localStorage.getItem('userSession');
    if (sessionData) {
      const session = JSON.parse(sessionData) as UserSession;
      setUserSession(session);
      setPhoneNumber(session.phone_number || '');
      setJoinDateStr(session.join_date || '');
      fetchApproverNames(session.supervisor_uid, session.hcga_approver_uid);
    }
    setPermissionDate(undefined);
    setDuration('');
    setReason('');
  }, [isOpen]);

  const fetchApproverNames = async (supervisorUid?: string, hcgaUid?: string) => {
    const uids = [supervisorUid, hcgaUid].filter(Boolean) as string[];
    if (uids.length === 0) return;
    const { data } = await supabase.from('staff_users').select('uid, name').in('uid', uids);
    if (data) {
      const sup = data.find(d => d.uid === supervisorUid);
      const hcga = data.find(d => d.uid === hcgaUid);
      if (sup) setSupervisorName(sup.name);
      if (hcga) setHcgaName(hcga.name);
    }
  };

  const canSubmit = permissionDate && duration.trim() && reason.trim() && userSession?.supervisor_uid;

  const handleSubmit = async () => {
    if (!userSession || !canSubmit || !permissionDate) return;
    setLoading(true);

    try {
      const requestNumber = `IJN-${format(new Date(), 'yyyyMMdd')}-${Date.now().toString(36).toUpperCase()}`;

      const { error } = await supabase.from('permission_requests').insert({
        request_number: requestNumber,
        staff_uid: userSession.uid,
        staff_name: userSession.name,
        department: userSession.division || null,
        position: userSession.position,
        join_date: joinDateStr || null,
        permission_duration: duration.trim(),
        permission_date: format(permissionDate, 'yyyy-MM-dd'),
        phone_number: phoneNumber || null,
        reason: reason.trim(),
        supervisor_uid: userSession.supervisor_uid || null,
        hcga_approver_uid: userSession.hcga_approver_uid || null,
      });

      if (error) throw error;

      toast({ title: "Berhasil", description: "Permintaan ijin berhasil diajukan" });

      // Send notifications
      const detailStr = `⏱️ Durasi: ${duration.trim()}\n📅 Tanggal: ${format(permissionDate, 'dd MMM yyyy', { locale: idLocale })}\n📝 ${reason.trim()}`;

      notifyRequestSubmitted({
        requestNumber, requestType: 'Ijin',
        staffUid: userSession.uid, staffName: userSession.name,
        details: detailStr,
      });

      if (userSession.supervisor_uid) {
        notifyApproverNewRequest({
          requestId: '', requestNumber, requestType: 'Ijin',
          creatorName: userSession.name,
          approverUid: userSession.supervisor_uid,
          details: detailStr,
        });
      }

      onSubmitted();
      onClose();
    } catch (error: any) {
      console.error('Error submitting permission request:', error);
      toast({ title: "Gagal", description: error.message || "Gagal mengajukan ijin", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-primary" />
            Permintaan Ijin
          </DialogTitle>
        </DialogHeader>

        {userSession && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2 text-sm bg-muted/50 p-3 rounded-lg">
              <div><span className="text-muted-foreground">Nama:</span> <strong>{userSession.name}</strong></div>
              <div><span className="text-muted-foreground">UID:</span> <strong>{userSession.uid}</strong></div>
              <div><span className="text-muted-foreground">Jabatan:</span> {userSession.position}</div>
              <div><span className="text-muted-foreground">Dept:</span> {userSession.division || '-'}</div>
              {supervisorName && <div><span className="text-muted-foreground">Atasan:</span> {supervisorName}</div>}
              {hcgaName && <div><span className="text-muted-foreground">HC&GA:</span> {hcgaName}</div>}
            </div>

            {!userSession.supervisor_uid && (
              <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-lg">
                ⚠️ Anda belum memiliki atasan yang di-assign. Hubungi admin.
              </div>
            )}

            <div className="space-y-2">
              <Label>Mulai Menjadi Karyawan</Label>
              <Input type="date" value={joinDateStr} onChange={(e) => setJoinDateStr(e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label>Ijin yang Dimohon (jam/hari)</Label>
              <Input value={duration} onChange={(e) => setDuration(e.target.value)} placeholder="Misal: 2 jam, 1 hari" />
            </div>

            <div className="space-y-2">
              <Label>Tanggal Ijin Dilaksanakan</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !permissionDate && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {permissionDate ? format(permissionDate, 'dd MMMM yyyy', { locale: idLocale }) : 'Pilih tanggal'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={permissionDate} onSelect={setPermissionDate} className="pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label>Nomor HP yang Bisa Dihubungi</Label>
              <Input value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} placeholder="08xxxxxxxxxx" />
            </div>

            <div className="space-y-2">
              <Label>Alasan Ijin</Label>
              <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Jelaskan alasan ijin..." rows={3} />
            </div>
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={loading}>Batal</Button>
          <Button onClick={handleSubmit} disabled={!canSubmit || loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Ajukan Ijin
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default PermissionRequestForm;
