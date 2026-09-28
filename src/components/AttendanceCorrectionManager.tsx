import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { hhmm } from './AttendanceCorrectionDialog';

interface Props { siteArea?: string | null; reviewerUid: string; reviewerName: string; }

// Build "YYYY-MM-DD HH:mm:00+HH:MM" using the offset of an existing timestamp when available
const offsetOf = (ts?: string | null) => {
  const m = ts?.match(/([+-]\d{2}:?\d{2})$/);
  if (m) return m[1].includes(':') ? m[1] : `${m[1].slice(0, 3)}:${m[1].slice(3)}`;
  const o = -new Date().getTimezoneOffset();
  const s = o >= 0 ? '+' : '-';
  return `${s}${String(Math.floor(Math.abs(o) / 60)).padStart(2, '0')}:${String(Math.abs(o) % 60).padStart(2, '0')}`;
};
const nextDay = (d: string) => { const x = new Date(d + 'T00:00:00'); x.setDate(x.getDate() + 1); return x.toISOString().slice(0, 10); };

const AttendanceCorrectionManager: React.FC<Props> = ({ siteArea, reviewerUid, reviewerName }) => {
  const [rows, setRows] = useState<any[]>([]);
  const [status, setStatus] = useState('pending');
  const [edits, setEdits] = useState<Record<string, { in: string; out: string; comment: string }>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => {
    let q = supabase.from('attendance_correction_requests' as any).select('*').order('created_at', { ascending: false }).limit(200);
    if (status !== 'all') q = q.eq('status', status);
    if (siteArea) q = q.eq('work_area', siteArea);
    const { data } = await q;
    const list = (data as any[]) || [];
    setRows(list);
    const e: any = {};
    list.forEach((r) => { e[r.id] = { in: r.requested_check_in || '', out: r.requested_check_out || '', comment: '' }; });
    setEdits(e);
  };
  useEffect(() => { load(); }, [status, siteArea]);

  const notify = async (r: any, ok: boolean, comment: string) => {
    await supabase.from('notifications').insert({
      staff_uid: r.staff_uid, type: 'attendance_correction',
      title: ok ? 'Koreksi absensi disetujui' : 'Koreksi absensi ditolak',
      body: `${r.request_date}${comment ? ` — ${comment}` : ''}`,
    });
  };

  const decide = async (r: any, ok: boolean) => {
    const e = edits[r.id];
    if (!e.comment.trim()) { toast({ title: 'Komentar wajib diisi', variant: 'destructive' }); return; }
    setBusy(r.id);
    try {
      if (ok) {
        const off = offsetOf(r.original_check_in);
        const inTs = e.in ? `${r.request_date} ${e.in}:00${off}` : null;
        const outDate = e.in && e.out && e.out < e.in ? nextDay(r.request_date) : r.request_date;
        const outTs = e.out ? `${outDate} ${e.out}:00${off}` : null;
        if (r.attendance_record_id) {
          const upd: any = {};
          if (inTs) upd.check_in_time = inTs;
          if (outTs) upd.check_out_time = outTs;
          const { error } = await supabase.from('attendance_records').update(upd).eq('id', r.attendance_record_id);
          if (error) throw error;
        } else {
          if (!inTs) throw new Error('Absen susulan butuh jam clock in');
          const { data: dup } = await supabase.from('attendance_records').select('id').eq('staff_uid', r.staff_uid).eq('date', r.request_date).neq('attendance_type', 'overtime').limit(1);
          if (dup && dup.length) throw new Error('Sudah ada absen di tanggal ini, minta user ajukan ulang sebagai koreksi');
          const { error } = await supabase.from('attendance_records').insert({
            staff_uid: r.staff_uid, staff_name: r.staff_name, date: r.request_date,
            status: 'wfo', attendance_type: 'regular',
            check_in_time: inTs, check_out_time: outTs,
            checkin_reason: `Koreksi admin: ${r.reason}`,
          } as any);
          if (error) throw error;
        }
      }
      const { error } = await supabase.from('attendance_correction_requests' as any).update({
        status: ok ? 'approved' : 'rejected',
        requested_check_in: e.in || null, requested_check_out: e.out || null,
        reviewer_uid: reviewerUid, reviewer_name: reviewerName,
        reviewer_comment: e.comment.trim(), reviewed_at: new Date().toISOString(),
      }).eq('id', r.id);
      if (error) throw error;
      await notify(r, ok, e.comment.trim());
      toast({ title: ok ? 'Disetujui' : 'Ditolak' });
      load();
    } catch (err: any) {
      toast({ title: 'Gagal', description: err.message, variant: 'destructive' });
    } finally { setBusy(null); }
  };

  const setE = (id: string, k: 'in' | 'out' | 'comment', v: string) => setEdits((p) => ({ ...p, [id]: { ...p[id], [k]: v } }));

  return (
    <Card className="bg-card border-border">
      <CardHeader className="flex flex-row items-center justify-between gap-2 flex-wrap">
        <CardTitle>Pengajuan Koreksi Clock In/Out</CardTitle>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="pending">Menunggu</SelectItem>
            <SelectItem value="approved">Disetujui</SelectItem>
            <SelectItem value="rejected">Ditolak</SelectItem>
            <SelectItem value="all">Semua</SelectItem>
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent className="space-y-3">
        {rows.length === 0 && <p className="text-sm text-muted-foreground">Tidak ada pengajuan.</p>}
        {rows.map((r) => {
          const e = edits[r.id] || { in: '', out: '', comment: '' };
          const pending = r.status === 'pending';
          return (
            <div key={r.id} className="p-3 rounded-lg border border-border space-y-2 text-sm">
              <div className="flex justify-between flex-wrap gap-2">
                <div>
                  <p className="font-semibold">{r.staff_name} <span className="font-mono text-xs text-muted-foreground">{r.staff_uid}</span></p>
                  <p className="text-xs text-muted-foreground">{r.work_area} · {r.request_date} {r.request_kind === 'missing' && <Badge variant="outline" className="ml-1">Susulan</Badge>}</p>
                </div>
                <Badge variant={r.status === 'rejected' ? 'destructive' : r.status === 'approved' ? 'default' : 'secondary'}>
                  {r.status === 'pending' ? 'Menunggu' : r.status === 'approved' ? 'Disetujui' : 'Ditolak'}
                </Badge>
              </div>
              <p className="text-xs">Tercatat: in {hhmm(r.original_check_in) || '—'} · out {hhmm(r.original_check_out) || '—'}</p>
              <p className="text-xs">Alasan: {r.reason}</p>
              {pending ? (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <Input type="time" value={e.in} onChange={(ev) => setE(r.id, 'in', ev.target.value)} />
                    <Input type="time" value={e.out} onChange={(ev) => setE(r.id, 'out', ev.target.value)} />
                  </div>
                  <Textarea placeholder="Komentar admin (wajib)" value={e.comment} onChange={(ev) => setE(r.id, 'comment', ev.target.value)} />
                  <div className="flex gap-2">
                    <Button size="sm" disabled={busy === r.id} onClick={() => decide(r, true)}>Setujui & Ubah</Button>
                    <Button size="sm" variant="destructive" disabled={busy === r.id} onClick={() => decide(r, false)}>Tolak</Button>
                  </div>
                </>
              ) : (
                <p className="text-xs text-muted-foreground">Diajukan in {r.requested_check_in || '—'} · out {r.requested_check_out || '—'} — {r.reviewer_name}: {r.reviewer_comment}</p>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};

export default AttendanceCorrectionManager;
