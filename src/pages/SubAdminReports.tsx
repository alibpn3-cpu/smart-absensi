import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ArrowLeft, Download, MapPin, Filter, AlertTriangle, FileSpreadsheet } from 'lucide-react';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

interface StaffUser {
  uid: string;
  name: string;
  position?: string;
  work_area?: string;
  division?: string;
  is_active?: boolean;
}

interface AttendanceRow {
  id: string;
  staff_uid: string;
  staff_name: string;
  date: string;
  status: string | null;
  attendance_type: string | null;
  check_in_time: string | null;
  check_out_time: string | null;
  checkin_location_address: string | null;
  checkout_location_address: string | null;
  checkin_location_lat: number | null;
  checkin_location_lng: number | null;
  checkout_location_lat: number | null;
  checkout_location_lng: number | null;
  selfie_checkin_url: string | null;
  selfie_checkout_url: string | null;
  client_ip: string | null;
  user_agent: string | null;
  device_id: string | null;
  device_label: string | null;
  device_flag: string | null;
}

const PAGE_SIZE = 50;
const BATCH = 1000;

const flagLabel = (f: string | null) => {
  switch (f) {
    case 'new_device': return 'Perangkat Baru';
    case 'device_shared_with_other_user': return 'Perangkat Dipakai User Lain';
    case 'user_on_other_device': return 'User Pindah Perangkat';
    default: return '-';
  }
};

const fmtTime = (s: string | null) => {
  if (!s) return '-';
  try {
    const d = new Date(s.replace(' ', 'T'));
    if (isNaN(d.getTime())) {
      const m = s.match(/(\d{2}[:.]\d{2}[:.]\d{2})/);
      return m ? m[1].replace(/\./g, ':') : '-';
    }
    return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  } catch { return '-'; }
};

const SubAdminReports: React.FC = () => {
  const navigate = useNavigate();
  const [me, setMe] = useState<{ uid: string; name: string; work_area: string; division: string } | null>(null);
  const [staff, setStaff] = useState<StaffUser[]>([]);
  const [records, setRecords] = useState<AttendanceRow[]>([]);
  const [loading, setLoading] = useState(false);

  // Filters
  const today = new Date();
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
  const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().slice(0, 10);
  const [startDate, setStartDate] = useState(firstDay);
  const [endDate, setEndDate] = useState(lastDay);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [employeeFilter, setEmployeeFilter] = useState<string>('all');
  const [nameSearch, setNameSearch] = useState('');
  const [page, setPage] = useState(1);

  // Photo lightbox
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);

  // Load current user + staff in same area+division
  useEffect(() => {
    const raw = localStorage.getItem('userSession');
    if (!raw) return;
    const s = JSON.parse(raw);
    (async () => {
      const { data: meRow } = await supabase
        .from('staff_users')
        .select('uid, name, work_area, division')
        .eq('uid', s.uid)
        .maybeSingle();
      if (!meRow?.work_area || !meRow?.division) {
        toast({ title: 'Profil tidak lengkap', description: 'Area kerja & divisi Anda belum diatur.', variant: 'destructive' });
        return;
      }
      setMe({ uid: meRow.uid, name: meRow.name, work_area: meRow.work_area, division: meRow.division });

      const { data: staffRows } = await supabase
        .from('staff_users')
        .select('uid, name, position, work_area, division, is_active')
        .eq('work_area', meRow.work_area)
        .eq('division', meRow.division)
        .order('name');
      setStaff(staffRows || []);
    })();
  }, []);

  const fetchRecords = async () => {
    if (!me) return;
    setLoading(true);
    try {
      const uids = staff.map((x) => x.uid);
      if (uids.length === 0) {
        setRecords([]);
        return;
      }

      let all: AttendanceRow[] = [];
      let from = 0;
      let more = true;
      while (more) {
        let q = supabase
          .from('attendance_records')
          .select('id, staff_uid, staff_name, date, status, attendance_type, check_in_time, check_out_time, checkin_location_address, checkout_location_address, checkin_location_lat, checkin_location_lng, checkout_location_lat, checkout_location_lng, selfie_checkin_url, selfie_checkout_url, client_ip, user_agent, device_id, device_label, device_flag')
          .in('staff_uid', uids)
          .gte('date', startDate)
          .lte('date', endDate)
          .order('date', { ascending: false })
          .order('id', { ascending: false })
          .range(from, from + BATCH - 1);

        if (statusFilter !== 'all') q = q.eq('status', statusFilter);
        if (employeeFilter !== 'all') q = q.eq('staff_uid', employeeFilter);

        const { data, error } = await q;
        if (error) throw error;
        if (data && data.length) {
          all = [...all, ...(data as AttendanceRow[])];
          from += BATCH;
          if (data.length < BATCH) more = false;
        } else {
          more = false;
        }
      }

      setRecords(all);
      setPage(1);
    } catch (e: any) {
      toast({ title: 'Gagal memuat', description: e.message || 'Coba lagi.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (me && staff.length) fetchRecords(); /* eslint-disable-next-line */ }, [me, staff.length]);

  const filtered = useMemo(() => {
    const q = nameSearch.trim().toLowerCase();
    if (!q) return records;
    return records.filter((r) => (r.staff_name || '').toLowerCase().includes(q));
  }, [records, nameSearch]);

  // Detect device_ids shared by >1 staff_uid in the filtered dataset (joki suspect)
  const sharedDeviceMap = useMemo(() => {
    const m = new Map<string, Set<string>>();
    filtered.forEach((r) => {
      if (!r.device_id) return;
      if (!m.has(r.device_id)) m.set(r.device_id, new Set());
      m.get(r.device_id)!.add(r.staff_uid);
    });
    const shared = new Map<string, string[]>();
    m.forEach((users, devId) => {
      if (users.size > 1) shared.set(devId, Array.from(users));
    });
    return shared;
  }, [filtered]);

  const isJokiSuspect = (r: AttendanceRow) =>
    !!(r.device_id && sharedDeviceMap.has(r.device_id));
  const jokiOtherUsers = (r: AttendanceRow) =>
    r.device_id && sharedDeviceMap.has(r.device_id)
      ? sharedDeviceMap.get(r.device_id)!.filter((u) => u !== r.staff_uid)
      : [];

  const paged = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, page]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));


  const openPhoto = async (path: string | null) => {
    if (!path) return;
    const { data } = await supabase.storage.from('attendance-photos').createSignedUrl(path, 60 * 60);
    if (data?.signedUrl) setPhotoUrl(data.signedUrl);
  };

  const exportExcel = async () => {
    if (!me) return;
    if (filtered.length === 0) {
      toast({ title: 'Tidak ada data', variant: 'destructive' });
      return;
    }

    // Sign all photos
    const signed = await Promise.all(filtered.map(async (r) => {
      const sign = async (p: string | null) => {
        if (!p) return null;
        try {
          const { data } = await supabase.storage.from('attendance-photos').createSignedUrl(p, 60 * 60 * 24 * 14);
          return data?.signedUrl || null;
        } catch { return null; }
      };
      return { checkin: await sign(r.selfie_checkin_url), checkout: await sign(r.selfie_checkout_url) };
    }));

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Laporan Sub-Admin');
    ws.columns = [
      { header: 'No', key: 'no', width: 5 },
      { header: 'Tanggal', key: 'tanggal', width: 12 },
      { header: 'UID', key: 'uid', width: 10 },
      { header: 'Nama', key: 'nama', width: 22 },
      { header: 'Status', key: 'status', width: 10 },
      { header: 'Jenis', key: 'jenis', width: 10 },
      { header: 'Clock In', key: 'in', width: 10 },
      { header: 'Clock Out', key: 'out', width: 10 },
      { header: 'Lokasi In', key: 'locIn', width: 32 },
      { header: 'Lokasi Out', key: 'locOut', width: 32 },
      { header: 'Foto In', key: 'fIn', width: 12 },
      { header: 'Foto Out', key: 'fOut', width: 12 },
      { header: 'IP', key: 'ip', width: 14 },
      { header: 'Device', key: 'device', width: 30 },
      { header: 'Device ID', key: 'devId', width: 22 },
      { header: 'Flag Audit', key: 'flag', width: 22 },
    ];

    filtered.forEach((r, i) => {
      const suspect = isJokiSuspect(r);
      const others = jokiOtherUsers(r);
      const flagText = suspect
        ? `⚠ JOKI SUSPECT: device juga dipakai oleh ${others.join(', ')}`
        : flagLabel(r.device_flag);

      const row = ws.addRow({
        no: i + 1,
        tanggal: new Date(r.date).toLocaleDateString('id-ID'),
        uid: r.staff_uid,
        nama: r.staff_name,
        status: (r.status || '-').toUpperCase(),
        jenis: r.attendance_type === 'overtime' ? 'LEMBUR' : 'REGULAR',
        in: fmtTime(r.check_in_time),
        out: fmtTime(r.check_out_time),
        locIn: r.checkin_location_address || '-',
        locOut: r.checkout_location_address || '-',
        fIn: signed[i].checkin ? 'Lihat Foto' : '-',
        fOut: signed[i].checkout ? 'Lihat Foto' : '-',
        ip: r.client_ip || '-',
        device: r.device_label || '-',
        devId: r.device_id || '-',
        flag: flagText,
      });
      if (signed[i].checkin) {
        const c = row.getCell('fIn');
        c.value = { text: 'Lihat Foto', hyperlink: signed[i].checkin! };
        c.font = { color: { argb: 'FF0000FF' }, underline: true };
      }
      if (signed[i].checkout) {
        const c = row.getCell('fOut');
        c.value = { text: 'Lihat Foto', hyperlink: signed[i].checkout! };
        c.font = { color: { argb: 'FF0000FF' }, underline: true };
      }
      if (suspect) {
        row.eachCell((cell) => {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFCDD2' } };
        });
      } else if (r.device_flag) {
        row.eachCell((cell) => {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF3CD' } };
        });
      }
    });


    const header = ws.getRow(1);
    header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF3B82F6' } };
    header.alignment = { vertical: 'middle', horizontal: 'center' };
    ws.eachRow((row) => row.eachCell((c) => {
      c.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
    }));
    ws.views = [{ state: 'frozen', ySplit: 1 }];

    const buf = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const safe = (s: string) => s.replace(/[^a-zA-Z0-9-_]/g, '-');
    saveAs(blob, `Laporan_${safe(me.work_area)}_${safe(me.division)}_${startDate}_${endDate}.xlsx`);
    toast({ title: 'Berhasil', description: `${filtered.length} baris diekspor.` });
  };

  return (
    <div className="min-h-screen bg-background text-foreground p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-4">
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="ghost" size="sm" onClick={() => navigate('/')}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Kembali
          </Button>
          <h1 className="text-xl md:text-2xl font-bold flex-1">Laporan Kehadiran Sub-Admin</h1>
          <Badge variant="secondary">Sub-Admin</Badge>
        </div>

        {me && (
          <Card>
            <CardContent className="p-4 text-sm flex flex-wrap gap-x-6 gap-y-1">
              <div><span className="opacity-70">Nama:</span> <b>{me.name}</b></div>
              <div><span className="opacity-70">Area:</span> <b>{me.work_area}</b></div>
              <div><span className="opacity-70">Divisi:</span> <b>{me.division}</b></div>
              <div><span className="opacity-70">Karyawan dalam scope:</span> <b>{staff.length}</b></div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Filter className="h-4 w-4" /> Filter
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-5 gap-3">
            <div>
              <Label>Tanggal Mulai</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div>
              <Label>Tanggal Akhir</Label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
            <div>
              <Label>Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua</SelectItem>
                  <SelectItem value="wfo">WFO</SelectItem>
                  <SelectItem value="wfh">WFH</SelectItem>
                  <SelectItem value="dinas">Dinas</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Karyawan</Label>
              <Select value={employeeFilter} onValueChange={setEmployeeFilter}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent className="max-h-60">
                  <SelectItem value="all">Semua</SelectItem>
                  {staff.map((s) => (
                    <SelectItem key={s.uid} value={s.uid}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Cari Nama</Label>
              <Input placeholder="Ketik nama…" value={nameSearch} onChange={(e) => { setNameSearch(e.target.value); setPage(1); }} />
            </div>
            <div className="md:col-span-5 flex gap-2">
              <Button onClick={fetchRecords} disabled={loading}>{loading ? 'Memuat…' : 'Terapkan'}</Button>
              <Button variant="outline" onClick={() => { setStatusFilter('all'); setEmployeeFilter('all'); setNameSearch(''); setStartDate(firstDay); setEndDate(lastDay); }}>Reset</Button>
              <Button variant="default" onClick={exportExcel} disabled={loading || filtered.length === 0}>
                <FileSpreadsheet className="h-4 w-4 mr-1" /> Export Excel
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Hasil ({filtered.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="p-2">Tanggal</th>
                    <th className="p-2">Nama</th>
                    <th className="p-2">Status</th>
                    <th className="p-2">In</th>
                    <th className="p-2">Out</th>
                    <th className="p-2">Lokasi In</th>
                    <th className="p-2">Lokasi Out</th>
                    <th className="p-2">Foto</th>
                    <th className="p-2">Flag</th>
                  </tr>
                </thead>
                <tbody>
                  {paged.map((r) => (
                    <tr key={r.id} className={`border-b ${r.device_flag ? 'bg-yellow-500/10' : ''}`}>
                      <td className="p-2 whitespace-nowrap">{new Date(r.date).toLocaleDateString('id-ID')}</td>
                      <td className="p-2">{r.staff_name}</td>
                      <td className="p-2 uppercase">{r.status || '-'}</td>
                      <td className="p-2 whitespace-nowrap">{fmtTime(r.check_in_time)}</td>
                      <td className="p-2 whitespace-nowrap">{fmtTime(r.check_out_time)}</td>
                      <td className="p-2 max-w-[200px] truncate">
                        {r.checkin_location_lat && r.checkin_location_lng ? (
                          <a className="text-blue-500 hover:underline inline-flex items-center gap-1" target="_blank" rel="noreferrer" href={`https://www.google.com/maps?q=${r.checkin_location_lat},${r.checkin_location_lng}`}>
                            <MapPin className="h-3 w-3" />{r.checkin_location_address || '-'}
                          </a>
                        ) : (r.checkin_location_address || '-')}
                      </td>
                      <td className="p-2 max-w-[200px] truncate">
                        {r.checkout_location_lat && r.checkout_location_lng ? (
                          <a className="text-blue-500 hover:underline inline-flex items-center gap-1" target="_blank" rel="noreferrer" href={`https://www.google.com/maps?q=${r.checkout_location_lat},${r.checkout_location_lng}`}>
                            <MapPin className="h-3 w-3" />{r.checkout_location_address || '-'}
                          </a>
                        ) : (r.checkout_location_address || '-')}
                      </td>
                      <td className="p-2 whitespace-nowrap">
                        {r.selfie_checkin_url && (
                          <button className="text-blue-500 underline mr-2" onClick={() => openPhoto(r.selfie_checkin_url)}>In</button>
                        )}
                        {r.selfie_checkout_url && (
                          <button className="text-blue-500 underline" onClick={() => openPhoto(r.selfie_checkout_url)}>Out</button>
                        )}
                        {!r.selfie_checkin_url && !r.selfie_checkout_url && '-'}
                      </td>
                      <td className="p-2 whitespace-nowrap">
                        {r.device_flag ? (
                          <Badge variant="outline" className="border-yellow-500 text-yellow-600">
                            <AlertTriangle className="h-3 w-3 mr-1" />{flagLabel(r.device_flag)}
                          </Badge>
                        ) : '-'}
                      </td>
                    </tr>
                  ))}
                  {paged.length === 0 && (
                    <tr><td colSpan={9} className="p-6 text-center opacity-60">Tidak ada data.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-3 text-sm">
                <span>Halaman {page} dari {totalPages}</span>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>Sebelumnya</Button>
                  <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Berikutnya</Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <p className="text-xs opacity-60 text-center">
          Data hanya untuk area & divisi Anda. Hanya tampilan, tidak bisa edit/hapus.
        </p>
      </div>

      <Dialog open={!!photoUrl} onOpenChange={(o) => !o && setPhotoUrl(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Foto Selfie</DialogTitle></DialogHeader>
          {photoUrl && <img src={photoUrl} alt="Selfie" className="w-full rounded" />}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SubAdminReports;
