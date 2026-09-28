import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

interface Props { open: boolean; onOpenChange: (v: boolean) => void; }

const pad = (n: number) => String(n).padStart(2, '0');
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const hhmm = (t?: string | null) => {
  if (!t) return '';
  const m = t.match(/(\d{2}):(\d{2})/);
  return m ? `${m[1]}:${m[2]}` : '';
};

const statusBadge = (s: string) =>
  s === 'approved' ? <Badge className="bg-primary text-primary-foreground">Disetujui</Badge>
  : s === 'rejected' ? <Badge variant="destructive">Ditolak</Badge>
  : <Badge variant="secondary">Menunggu</Badge>;

const AttendanceCorrectionDialog: React.FC<Props> = ({ open, onOpenChange }) => {
  const session = (() => { try { return JSON.parse(localStorage.getItem('userSession') || 'null'); } catch { return null; } })();
  const now = new Date();
  const minDate = ymd(new Date(now.getFullYear(), now.getMonth(), 1));
  const maxDate = ymd(now);

  const [date, setDate] = useState(maxDate);
  const [record, setRecord] = useState<any>(null);
  const [inTime, setInTime] = useState('');
  const [outTime, setOutTime] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState<any[]>([]);

  const loadHistory = async () => {
    if (!session?.uid) return;
    const { data } = await supabase.from('attendance_correction_requests' as any)
      .select('*').eq('staff_uid', session.uid).order('created_at', { ascending: false }).limit(20);
    setHistory((data as any[]) || []);
  };

  useEffect(() => { if (open) loadHistory(); }, [open]);

  useEffect(() => {
    if (!open || !session?.uid || !date) return;
    supabase.from('attendance_records').select('id, check_in_time, check_out_time, attendance_type')
      .eq('staff_uid', session.uid).eq('date', date).neq('attendance_type', 'overtime')
      .order('created_at', { ascending: true }).limit(1).maybeSingle()
      .then(({ data }) => {
        setRecord(data);
        setInTime(hhmm(data?.check_in_time));
        setOutTime(hhmm(data?.check_out_time));
      });
  }, [open, date]);

  const submit = async () => {
    if (!session?.uid) return;
    if (date < minDate || date > maxDate) {
      toast({ title: 'Tanggal tidak valid', description: 'Hanya tanggal di bulan berjalan.', variant: 'destructive' }); return;
    }
    if (!inTime && !outTime) { toast({ title: 'Isi jam clock in atau clock out', variant: 'destructive' }); return; }
    if (!record && !inTime) { toast({ title: 'Absen susulan wajib ada jam clock in', variant: 'destructive' }); return; }
    if (reason.trim().length < 10) { toast({ title: 'Alasan minimal 10 karakter', variant: 'destructive' }); return; }
    setSaving(true);
    const { error } = await supabase.from('attendance_correction_requests' as any).insert({
      staff_uid: session.uid,
      staff_name: session.name,
      work_area: session.work_area,
      division: session.division || null,
      request_date: date,
      request_kind: record ? 'correction' : 'missing',
      attendance_record_id: record?.id || null,
      original_check_in: record?.check_in_time || null,
      original_check_out: record?.check_out_time || null,
      requested_check_in: inTime || null,
      requested_check_out: outTime || null,
      reason: reason.trim(),
    });
    setSaving(false);
    if (error) {
      toast({ title: 'Gagal', description: error.code === '23505' ? 'Sudah ada pengajuan menunggu untuk tanggal ini.' : error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Terkirim', description: 'Pengajuan menunggu persetujuan admin.' });
    setReason('');
    loadHistory();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Koreksi Clock In/Out</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Tanggal</Label>
            <Input type="date" min={minDate} max={maxDate} value={date} onChange={(e) => setDate(e.target.value)} />
            <p className="text-xs text-muted-foreground">
              {record
                ? `Tercatat: clock in ${hhmm(record.check_in_time) || '—'} · clock out ${hhmm(record.check_out_time) || '—'}`
                : 'Tidak ada absen di tanggal ini — akan diajukan sebagai absen susulan.'}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1"><Label>Clock in</Label><Input type="time" value={inTime} onChange={(e) => setInTime(e.target.value)} /></div>
            <div className="space-y-1"><Label>Clock out</Label><Input type="time" value={outTime} onChange={(e) => setOutTime(e.target.value)} /></div>
          </div>
          <div className="space-y-1">
            <Label>Alasan</Label>
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Contoh: lupa clock out karena HP mati" />
          </div>
          <Button className="w-full" onClick={submit} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Kirim Pengajuan
          </Button>

          <div className="pt-2 space-y-2">
            <p className="text-sm font-medium">Riwayat Pengajuan</p>
            {history.length === 0 && <p className="text-xs text-muted-foreground">Belum ada pengajuan.</p>}
            {history.map((h) => (
              <div key={h.id} className="p-2 rounded-md bg-muted/50 text-xs space-y-1">
                <div className="flex justify-between items-center">
                  <span className="font-medium">{h.request_date}{h.request_kind === 'missing' ? ' (susulan)' : ''}</span>
                  {statusBadge(h.status)}
                </div>
                <div>In {h.requested_check_in || '—'} · Out {h.requested_check_out || '—'}</div>
                {h.reviewer_comment && <div className="text-muted-foreground">Admin: {h.reviewer_comment}</div>}
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AttendanceCorrectionDialog;
