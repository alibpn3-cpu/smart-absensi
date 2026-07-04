import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loader2, CalendarClock, Pencil, Search } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface StaffRow {
  uid: string;
  name: string;
  work_area: string;
  division: string | null;
  position: string;
}

interface BalanceRow {
  id?: string;
  staff_uid: string;
  year: number;
  total_days: number;
  used_days: number;
}

interface Props {
  siteAdminArea?: string | null; // when set, restrict to this work area
}

const LeaveBalanceManager: React.FC<Props> = ({ siteAdminArea }) => {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState<number>(currentYear);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [balances, setBalances] = useState<Record<string, BalanceRow>>({});
  const [search, setSearch] = useState('');
  const [workAreaFilter, setWorkAreaFilter] = useState<string>(siteAdminArea || 'all');
  const [editRow, setEditRow] = useState<StaffRow | null>(null);
  const [editTotal, setEditTotal] = useState<string>('');
  const [editUsed, setEditUsed] = useState<string>('');

  const workAreas = useMemo(
    () => Array.from(new Set(staff.map(s => s.work_area).filter(Boolean))).sort(),
    [staff]
  );

  const load = async () => {
    setLoading(true);
    try {
      let q = supabase
        .from('staff_users')
        .select('uid, name, work_area, division, position')
        .eq('is_active', true)
        .order('name');
      if (siteAdminArea) q = q.eq('work_area', siteAdminArea);
      const { data: staffData, error: sErr } = await q;
      if (sErr) throw sErr;
      const list = (staffData || []) as StaffRow[];
      setStaff(list);

      if (list.length > 0) {
        const uids = list.map(s => s.uid);
        const { data: balData, error: bErr } = await supabase
          .from('leave_balances')
          .select('id, staff_uid, year, total_days, used_days')
          .eq('year', year)
          .in('staff_uid', uids);
        if (bErr) throw bErr;
        const map: Record<string, BalanceRow> = {};
        (balData || []).forEach((b: any) => { map[b.staff_uid] = b; });
        setBalances(map);
      } else {
        setBalances({});
      }
    } catch (e: any) {
      toast({ title: 'Gagal', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [year, siteAdminArea]);

  const openEdit = (row: StaffRow) => {
    const b = balances[row.uid];
    setEditRow(row);
    setEditTotal(String(b?.total_days ?? 12));
    setEditUsed(String(b?.used_days ?? 0));
  };

  const saveEdit = async () => {
    if (!editRow) return;
    const total = Number(editTotal);
    const used = Number(editUsed);
    if (isNaN(total) || isNaN(used) || total < 0 || used < 0) {
      toast({ title: 'Input tidak valid', description: 'Jumlah harus angka >= 0', variant: 'destructive' });
      return;
    }
    if (used > total) {
      toast({ title: 'Input tidak valid', description: 'Terpakai tidak boleh > Total', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const existing = balances[editRow.uid];
      if (existing?.id) {
        const { error } = await supabase
          .from('leave_balances')
          .update({ total_days: total, used_days: used })
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('leave_balances')
          .insert({ staff_uid: editRow.uid, year, total_days: total, used_days: used });
        if (error) throw error;
      }
      toast({ title: 'Tersimpan', description: `Sisa cuti ${editRow.name} diperbarui` });
      setEditRow(null);
      load();
    } catch (e: any) {
      toast({ title: 'Gagal', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const filtered = staff.filter(s => {
    if (!siteAdminArea && workAreaFilter !== 'all' && s.work_area !== workAreaFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return s.name.toLowerCase().includes(q) || s.uid.toLowerCase().includes(q);
    }
    return true;
  });

  const years = [currentYear - 1, currentYear, currentYear + 1];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarClock className="h-5 w-5 text-primary" />
          Kelola Sisa Cuti Karyawan
          {siteAdminArea && <span className="text-sm text-muted-foreground">({siteAdminArea})</span>}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2 items-end">
          <div className="space-y-1">
            <Label className="text-xs">Tahun</Label>
            <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
              <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
              <SelectContent>
                {years.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {!siteAdminArea && (
            <div className="space-y-1">
              <Label className="text-xs">Work Area</Label>
              <Select value={workAreaFilter} onValueChange={setWorkAreaFilter}>
                <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Area</SelectItem>
                  {workAreas.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-1 flex-1 min-w-[200px]">
            <Label className="text-xs">Cari nama / UID</Label>
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari..." className="pl-8" />
            </div>
          </div>
        </div>

        <div className="rounded-lg border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nama</TableHead>
                <TableHead>UID</TableHead>
                <TableHead>Jabatan</TableHead>
                <TableHead>Area</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Terpakai</TableHead>
                <TableHead className="text-right">Sisa</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={8} className="text-center py-6"><Loader2 className="h-4 w-4 animate-spin inline mr-2" />Memuat...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center py-6 text-muted-foreground">Tidak ada data</TableCell></TableRow>
              ) : filtered.map(s => {
                const b = balances[s.uid];
                const total = b?.total_days ?? 12;
                const used = b?.used_days ?? 0;
                const remaining = total - used;
                return (
                  <TableRow key={s.uid}>
                    <TableCell className="font-medium">{s.name}</TableCell>
                    <TableCell className="text-xs">{s.uid}</TableCell>
                    <TableCell className="text-xs">{s.position}</TableCell>
                    <TableCell className="text-xs">{s.work_area}</TableCell>
                    <TableCell className="text-right">{total}</TableCell>
                    <TableCell className="text-right">{used}</TableCell>
                    <TableCell className="text-right font-semibold">{remaining}</TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="outline" onClick={() => openEdit(s)}>
                        <Pencil className="h-3 w-3 mr-1" /> Edit
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>

      <Dialog open={!!editRow} onOpenChange={(o) => !o && setEditRow(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Edit Sisa Cuti — {year}</DialogTitle>
          </DialogHeader>
          {editRow && (
            <div className="space-y-3">
              <div className="text-sm bg-muted/50 p-2 rounded">
                <div><strong>{editRow.name}</strong></div>
                <div className="text-xs text-muted-foreground">{editRow.uid} • {editRow.work_area}</div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Total Hari Cuti (per tahun)</Label>
                <Input type="number" min={0} value={editTotal} onChange={(e) => setEditTotal(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Hari Terpakai</Label>
                <Input type="number" min={0} value={editUsed} onChange={(e) => setEditUsed(e.target.value)} />
                <p className="text-[11px] text-muted-foreground">
                  Sisa: <strong>{Math.max(0, (Number(editTotal) || 0) - (Number(editUsed) || 0))} hari</strong>
                </p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditRow(null)} disabled={saving}>Batal</Button>
            <Button onClick={saveEdit} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default LeaveBalanceManager;
