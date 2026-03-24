import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Loader2, FileText } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
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
}

interface LeaveBalance {
  year: number;
  total_days: number;
  used_days: number;
  remaining: number;
}

interface LeaveRequestFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmitted: () => void;
}

const LeaveRequestForm: React.FC<LeaveRequestFormProps> = ({ isOpen, onClose, onSubmitted }) => {
  const [loading, setLoading] = useState(false);
  const [userSession, setUserSession] = useState<UserSession | null>(null);
  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const [selectedYear, setSelectedYear] = useState<string>('');
  const [selectedDates, setSelectedDates] = useState<Date[]>([]);
  const [supervisorName, setSupervisorName] = useState('');
  const [hcgaName, setHcgaName] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    const sessionData = localStorage.getItem('userSession');
    if (sessionData) {
      const session = JSON.parse(sessionData) as UserSession;
      setUserSession(session);
      fetchBalances(session.uid);
      fetchApproverNames(session.supervisor_uid, session.hcga_approver_uid);
    }
  }, [isOpen]);

  const fetchBalances = async (staffUid: string) => {
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;
    const years = [currentYear];
    if (currentMonth <= 6) years.unshift(currentYear - 1);

    const { data } = await supabase
      .from('leave_balances')
      .select('*')
      .eq('staff_uid', staffUid)
      .in('year', years);

    const result: LeaveBalance[] = [];
    for (const yr of years) {
      const existing = data?.find(d => d.year === yr);
      if (existing) {
        const remaining = existing.total_days - existing.used_days;
        if (yr < currentYear && (currentMonth > 6 || remaining <= 0)) continue;
        result.push({ year: yr, total_days: existing.total_days, used_days: existing.used_days, remaining });
      } else if (yr === currentYear) {
        await supabase.from('leave_balances').insert({ staff_uid: staffUid, year: yr, total_days: 12, used_days: 0 });
        result.push({ year: yr, total_days: 12, used_days: 0, remaining: 12 });
      }
    }

    setBalances(result);
    if (result.length === 1) setSelectedYear(String(result[0].year));
    else if (result.length > 0) setSelectedYear(String(result[result.length - 1].year));
  };

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

  const selectedBalance = balances.find(b => b.year === Number(selectedYear));
  const canSubmit = selectedDates.length > 0 && selectedBalance && selectedDates.length <= selectedBalance.remaining && userSession?.supervisor_uid;

  const handleSubmit = async () => {
    if (!userSession || !selectedBalance || !canSubmit) return;
    setLoading(true);

    try {
      const requestNumber = `CUT-${format(new Date(), 'yyyyMMdd')}-${Date.now().toString(36).toUpperCase()}`;
      const leaveDates = selectedDates.map(d => format(d, 'yyyy-MM-dd')).sort();

      const { error } = await supabase.from('leave_requests').insert({
        request_number: requestNumber,
        staff_uid: userSession.uid,
        staff_name: userSession.name,
        department: userSession.division || null,
        position: userSession.position,
        join_date: userSession.join_date || null,
        leave_year: Number(selectedYear),
        days_requested: selectedDates.length,
        leave_dates: leaveDates,
        remaining_balance: selectedBalance.remaining - selectedDates.length,
        previous_year_balance: Number(selectedYear) < new Date().getFullYear() ? selectedBalance.remaining : null,
        supervisor_uid: userSession.supervisor_uid || null,
        hcga_approver_uid: userSession.hcga_approver_uid || null,
      });

      if (error) throw error;

      toast({ title: "Berhasil", description: "Permintaan cuti berhasil diajukan" });

      // Send notifications (fire-and-forget)
      const detailStr = `📅 ${selectedDates.length} hari cuti - Tahun ${selectedYear}\n📆 ${leaveDates.map(d => format(new Date(d), 'dd MMM', { locale: idLocale })).join(', ')}`;

      notifyRequestSubmitted({
        requestNumber, requestType: 'Cuti',
        staffUid: userSession.uid, staffName: userSession.name,
        details: detailStr,
      });

      if (userSession.supervisor_uid) {
        notifyApproverNewRequest({
          requestId: '', requestNumber, requestType: 'Cuti',
          creatorName: userSession.name,
          approverUid: userSession.supervisor_uid,
          details: detailStr,
        });
      }

      setSelectedDates([]);
      onSubmitted();
      onClose();
    } catch (error: any) {
      console.error('Error submitting leave request:', error);
      toast({ title: "Gagal", description: error.message || "Gagal mengajukan cuti", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Permintaan Cuti
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
                ⚠️ Anda belum memiliki atasan yang di-assign. Hubungi admin untuk mengatur atasan Anda.
              </div>
            )}

            {balances.length > 0 && (
              <div className="space-y-2">
                <Label>Periode Cuti (Tahun)</Label>
                <Select value={selectedYear} onValueChange={setSelectedYear}>
                  <SelectTrigger><SelectValue placeholder="Pilih tahun" /></SelectTrigger>
                  <SelectContent>
                    {balances.map(b => (
                      <SelectItem key={b.year} value={String(b.year)}>
                        {b.year} — Sisa: {b.remaining} hari (dari {b.total_days})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {selectedBalance && (
              <div className="space-y-2">
                <Label>Tanggal Cuti ({selectedDates.length} hari dipilih, maks {selectedBalance.remaining})</Label>
                <div className="border rounded-lg p-1">
                  <Calendar
                    mode="multiple"
                    selected={selectedDates}
                    onSelect={(dates) => setSelectedDates(dates || [])}
                    disabled={(date) => date < new Date()}
                    className="pointer-events-auto"
                  />
                </div>
                {selectedDates.length > selectedBalance.remaining && (
                  <p className="text-sm text-destructive">Melebihi sisa cuti ({selectedBalance.remaining} hari)</p>
                )}
              </div>
            )}

            {selectedDates.length > 0 && selectedBalance && (
              <div className="bg-muted/50 p-3 rounded-lg text-sm space-y-1">
                <p><strong>Jumlah hari:</strong> {selectedDates.length} hari</p>
                <p><strong>Tanggal:</strong> {selectedDates.map(d => format(d, 'dd MMM yyyy', { locale: idLocale })).join(', ')}</p>
                <p><strong>Sisa cuti setelah approved:</strong> {selectedBalance.remaining - selectedDates.length} hari</p>
              </div>
            )}
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={loading}>Batal</Button>
          <Button onClick={handleSubmit} disabled={!canSubmit || loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Ajukan Cuti
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default LeaveRequestForm;
