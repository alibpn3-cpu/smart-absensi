import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Download, FileSpreadsheet, ClipboardCheck } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

const MONTHS = [
  'Januari','Februari','Maret','April','Mei','Juni',
  'Juli','Agustus','September','Oktober','November','Desember'
];

type Activity = 'both' | 'p2h' | 'toolbox';

const P2HToolboxExporter: React.FC = () => {
  const now = new Date();
  const [startMonth, setStartMonth] = useState<number>(now.getMonth() + 1);
  const [startYear, setStartYear] = useState<number>(now.getFullYear());
  const [endMonth, setEndMonth] = useState<number>(now.getMonth() + 1);
  const [endYear, setEndYear] = useState<number>(now.getFullYear());
  const [activity, setActivity] = useState<Activity>('both');
  const [workArea, setWorkArea] = useState<string>('all');
  const [staffUid, setStaffUid] = useState<string>('');
  const [workAreas, setWorkAreas] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('staff_users')
        .select('work_area')
        .eq('is_active', true);
      const areas = Array.from(new Set((data ?? []).map(d => d.work_area).filter(Boolean))) as string[];
      setWorkAreas(areas.sort());
    })();
  }, []);

  const handleExport = async () => {
    setLoading(true);
    try {
      // Validate range
      const startIdx = startYear * 12 + (startMonth - 1);
      const endIdx = endYear * 12 + (endMonth - 1);
      if (endIdx < startIdx) {
        toast({ title: 'Range tidak valid', description: 'Bulan/tahun akhir harus >= bulan/tahun awal.', variant: 'destructive' });
        setLoading(false);
        return;
      }

      const startDate = `${startYear}-${String(startMonth).padStart(2, '0')}-01`;
      const endDayObj = new Date(endYear, endMonth, 0);
      const endDate = `${endYear}-${String(endMonth).padStart(2, '0')}-${String(endDayObj.getDate()).padStart(2, '0')}`;

      let query = supabase
        .from('p2h_toolbox_checklist')
        .select('*')
        .gte('checklist_date', startDate)
        .lte('checklist_date', endDate)
        .order('checklist_date', { ascending: true });

      if (staffUid.trim()) query = query.eq('staff_uid', staffUid.trim());

      // Activity filter at DB level
      if (activity === 'p2h') query = query.eq('p2h_checked', true);
      else if (activity === 'toolbox') query = query.eq('toolbox_checked', true);

      const { data: rows, error } = await query;
      if (error) throw error;

      let filtered = rows ?? [];

      // Always fetch staff info for work_area & position columns
      const staffMap = new Map<string, { work_area?: string; position?: string }>();
      if (filtered.length > 0) {
        const uids = Array.from(new Set(filtered.map(r => r.staff_uid)));
        const { data: staffs } = await supabase
          .from('staff_users')
          .select('uid, work_area, position')
          .in('uid', uids);
        (staffs ?? []).forEach(s => staffMap.set(s.uid, { work_area: s.work_area, position: s.position }));

        if (workArea !== 'all') {
          filtered = filtered.filter(r => staffMap.get(r.staff_uid)?.work_area === workArea);
        }
      }

      if (filtered.length === 0) {
        toast({ title: 'Tidak ada data', description: 'Tidak ada checklist pada periode/filter ini.' });
        setLoading(false);
        return;
      }

      const wb = new ExcelJS.Workbook();
      const sheetName = activity === 'p2h' ? 'P2H' : activity === 'toolbox' ? 'Toolbox' : 'P2H_TBM';
      const ws = wb.addWorksheet(`${sheetName}_${startYear}${String(startMonth).padStart(2,'0')}-${endYear}${String(endMonth).padStart(2,'0')}`);

      // Build columns based on activity
      const baseCols: any[] = [
        { header: 'No', key: 'no', width: 6 },
        { header: 'Tanggal', key: 'date', width: 14 },
        { header: 'UID', key: 'uid', width: 14 },
        { header: 'Nama', key: 'name', width: 26 },
      ];
      const p2hCols: any[] = [
        { header: 'P2H Checked', key: 'p2h', width: 14 },
        { header: 'P2H Photo', key: 'p2h_photo', width: 40 },
      ];
      const tbCols: any[] = [
        { header: 'Toolbox Checked', key: 'tb', width: 16 },
        { header: 'Toolbox Photo', key: 'tb_photo', width: 40 },
      ];
      const tailCols: any[] = [
        { header: 'Created At', key: 'created', width: 22 },
      ];

      let cols = [...baseCols];
      if (activity === 'both' || activity === 'p2h') cols = cols.concat(p2hCols);
      if (activity === 'both' || activity === 'toolbox') cols = cols.concat(tbCols);
      cols = cols.concat(tailCols);
      ws.columns = cols;

      filtered.forEach((r, i) => {
        const rowData: any = {
          no: i + 1,
          date: r.checklist_date,
          uid: r.staff_uid,
          name: r.staff_name,
          created: r.created_at ? new Date(r.created_at).toLocaleString('id-ID') : '',
        };
        if (activity === 'both' || activity === 'p2h') {
          rowData.p2h = r.p2h_checked ? 'Ya' : 'Tidak';
          rowData.p2h_photo = r.p2h_photo_url || '';
        }
        if (activity === 'both' || activity === 'toolbox') {
          rowData.tb = r.toolbox_checked ? 'Ya' : 'Tidak';
          rowData.tb_photo = r.toolbox_photo_url || '';
        }
        const row = ws.addRow(rowData);
        if ((activity === 'both' || activity === 'p2h') && r.p2h_photo_url) {
          row.getCell('p2h_photo').value = { text: 'Lihat Foto', hyperlink: r.p2h_photo_url };
          row.getCell('p2h_photo').font = { color: { argb: 'FF1D4ED8' }, underline: true };
        }
        if ((activity === 'both' || activity === 'toolbox') && r.toolbox_photo_url) {
          row.getCell('tb_photo').value = { text: 'Lihat Foto', hyperlink: r.toolbox_photo_url };
          row.getCell('tb_photo').font = { color: { argb: 'FF1D4ED8' }, underline: true };
        }
      });

      const headerRow = ws.getRow(1);
      headerRow.eachCell(cell => {
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF3B82F6' } };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        cell.border = {
          top: { style: 'thin' }, left: { style: 'thin' },
          bottom: { style: 'thin' }, right: { style: 'thin' },
        };
      });
      ws.views = [{ state: 'frozen', ySplit: 1 }];
      ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: cols.length } };
      for (let r = 2; r <= ws.rowCount; r++) {
        ws.getRow(r).eachCell(cell => {
          cell.border = {
            top: { style: 'thin' }, left: { style: 'thin' },
            bottom: { style: 'thin' }, right: { style: 'thin' },
          };
        });
      }

      const buf = await wb.xlsx.writeBuffer();
      const fname = `${sheetName}_${startYear}-${String(startMonth).padStart(2,'0')}_to_${endYear}-${String(endMonth).padStart(2,'0')}.xlsx`;
      saveAs(new Blob([buf]), fname);
      toast({ title: 'Export berhasil', description: `${filtered.length} baris diexport.` });
    } catch (e: any) {
      console.error(e);
      toast({ title: 'Gagal export', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const years = Array.from({ length: 6 }, (_, i) => now.getFullYear() - 3 + i);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ClipboardCheck className="h-5 w-5" />
          Export P2H Prestart & Toolbox Meeting
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2 p-3 rounded-md border">
            <Label className="text-xs font-semibold text-muted-foreground">Dari</Label>
            <div className="grid grid-cols-2 gap-2">
              <Select value={String(startMonth)} onValueChange={(v) => setStartMonth(Number(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MONTHS.map((m, i) => <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={String(startYear)} onValueChange={(v) => setStartYear(Number(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {years.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2 p-3 rounded-md border">
            <Label className="text-xs font-semibold text-muted-foreground">Sampai</Label>
            <div className="grid grid-cols-2 gap-2">
              <Select value={String(endMonth)} onValueChange={(v) => setEndMonth(Number(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MONTHS.map((m, i) => <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={String(endYear)} onValueChange={(v) => setEndYear(Number(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {years.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label>Kegiatan</Label>
            <Select value={activity} onValueChange={(v) => setActivity(v as Activity)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="both">P2H & Toolbox</SelectItem>
                <SelectItem value="p2h">P2H Prestart saja</SelectItem>
                <SelectItem value="toolbox">Toolbox Meeting saja</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Work Area</Label>
            <Select value={workArea} onValueChange={setWorkArea}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua</SelectItem>
                {workAreas.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Staff UID (opsional)</Label>
            <Input value={staffUid} onChange={e => setStaffUid(e.target.value)} placeholder="cth: EMP001" />
          </div>
        </div>

        <Button onClick={handleExport} disabled={loading} className="gap-2">
          {loading ? <FileSpreadsheet className="h-4 w-4 animate-pulse" /> : <Download className="h-4 w-4" />}
          {loading ? 'Mengekspor...' : 'Export Excel'}
        </Button>
        <p className="text-xs text-muted-foreground">
          Pilih rentang bulan & jenis kegiatan. Kolom foto berupa hyperlink — klik di Excel untuk membuka foto evidence.
        </p>
      </CardContent>
    </Card>
  );
};

export default P2HToolboxExporter;
