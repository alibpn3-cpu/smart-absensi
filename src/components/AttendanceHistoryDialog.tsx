import React, { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { Calendar, Clock, MapPin, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  staffUid: string;
}

interface Row {
  id: string;
  date: string;
  check_in_time: string | null;
  check_out_time: string | null;
  status: string | null;
  attendance_type: string | null;
  work_area: string | null;
}

const PAGE_SIZE = 10;

function fmtDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function fmtTime(t: string | null): string {
  if (!t) return '—';
  // t may be "HH:MM:SS" or ISO
  if (/^\d{2}:\d{2}/.test(t)) return t.slice(0, 5);
  try {
    const d = new Date(t);
    return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  } catch { return t; }
}

function labelDate(dateStr: string): string {
  try {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  } catch { return dateStr; }
}

const AttendanceHistoryDialog: React.FC<Props> = ({ open, onOpenChange, staffUid }) => {
  const today = useMemo(() => new Date(), []);
  const defaultFrom = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 6);
    return fmtDate(d);
  }, []);

  const [from, setFrom] = useState<string>(defaultFrom);
  const [to, setTo] = useState<string>(fmtDate(today));
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);

  const applyPreset = (preset: 'today' | '7d' | '30d' | 'month') => {
    const now = new Date();
    if (preset === 'today') {
      const s = fmtDate(now);
      setFrom(s); setTo(s);
    } else if (preset === '7d') {
      const d = new Date(); d.setDate(d.getDate() - 6);
      setFrom(fmtDate(d)); setTo(fmtDate(now));
    } else if (preset === '30d') {
      const d = new Date(); d.setDate(d.getDate() - 29);
      setFrom(fmtDate(d)); setTo(fmtDate(now));
    } else {
      const d = new Date(now.getFullYear(), now.getMonth(), 1);
      setFrom(fmtDate(d)); setTo(fmtDate(now));
    }
    setPage(1);
  };

  useEffect(() => {
    if (!open || !staffUid) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('attendance_records')
        .select('id,date,check_in_time,check_out_time,status,attendance_type,work_area')
        .eq('staff_uid', staffUid)
        .gte('date', from)
        .lte('date', to)
        .order('date', { ascending: false })
        .order('check_in_time', { ascending: false })
        .limit(500);
      if (cancelled) return;
      if (error) {
        console.error('History fetch error', error);
        setRows([]);
      } else {
        setRows((data as any) || []);
      }
      setPage(1);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [open, staffUid, from, to]);

  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const pageRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            Riwayat Absensi
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => applyPreset('today')}>Hari Ini</Button>
            <Button size="sm" variant="outline" onClick={() => applyPreset('7d')}>7 Hari</Button>
            <Button size="sm" variant="outline" onClick={() => applyPreset('30d')}>30 Hari</Button>
            <Button size="sm" variant="outline" onClick={() => applyPreset('month')}>Bulan Ini</Button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Dari</Label>
              <Input type="date" value={from} max={to} onChange={(e) => { setFrom(e.target.value); setPage(1); }} />
            </div>
            <div>
              <Label className="text-xs">Sampai</Label>
              <Input type="date" value={to} min={from} onChange={(e) => { setTo(e.target.value); setPage(1); }} />
            </div>
          </div>

          <div className="min-h-[240px]">
            {loading ? (
              <div className="flex items-center justify-center py-10 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin mr-2" /> Memuat...
              </div>
            ) : rows.length === 0 ? (
              <div className="text-center py-10 text-sm text-muted-foreground">
                Tidak ada data pada rentang ini.
              </div>
            ) : (
              <div className="space-y-2">
                {pageRows.map((r) => {
                  const noOut = !!r.check_in_time && !r.check_out_time;
                  return (
                    <div key={r.id} className="rounded-lg border border-border/60 bg-card/50 p-3">
                      <div className="flex items-center justify-between mb-1">
                        <div className="text-sm font-semibold">{labelDate(r.date)}</div>
                        <div className="flex gap-1">
                          {r.status && (
                            <Badge variant="secondary" className="text-[10px] uppercase">{r.status}</Badge>
                          )}
                          {r.attendance_type && r.attendance_type !== 'regular' && (
                            <Badge variant="outline" className="text-[10px]">{r.attendance_type}</Badge>
                          )}
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                          <Clock className="h-3 w-3" /> In: <span className="font-medium">{fmtTime(r.check_in_time)}</span>
                        </div>
                        <div className={`flex items-center gap-1 ${noOut ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'}`}>
                          <Clock className="h-3 w-3" /> Out: <span className="font-medium">{fmtTime(r.check_out_time)}</span>
                        </div>
                      </div>
                      {r.work_area && (
                        <div className="flex items-center gap-1 text-[11px] text-muted-foreground mt-1">
                          <MapPin className="h-3 w-3" />
                          <span className="truncate">{r.work_area}</span>
                        </div>
                      )}
                      {noOut && (
                        <div className="mt-1">
                          <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-500/50">
                            Belum Clock Out
                          </Badge>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {rows.length > PAGE_SIZE && (
            <div className="flex items-center justify-between pt-1">
              <Button size="sm" variant="ghost" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                <ChevronLeft className="h-4 w-4" /> Sebelumnya
              </Button>
              <span className="text-xs text-muted-foreground">Hal {page} / {totalPages} · {rows.length} data</span>
              <Button size="sm" variant="ghost" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
                Berikutnya <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AttendanceHistoryDialog;
