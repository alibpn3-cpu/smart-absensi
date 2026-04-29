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

const P2HToolboxExporter: React.FC = () => {
  const now = new Date();
  const [month, setMonth] = useState<number>(now.getMonth() + 1);
  const [year, setYear] = useState<number>(now.getFullYear());
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
      const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
      const endDateObj = new Date(year, month, 0);
      const endDate = `${year}-${String(month).padStart(2, '0')}-${String(endDateObj.getDate()).padStart(2, '0')}`;

      let query = supabase
        .from('p2h_toolbox_checklist')
        .select('*')
        .gte('checklist_date', startDate)
        .lte('checklist_date', endDate)
        .order('checklist_date', { ascending: true });

      if (staffUid.trim()) query = query.eq('staff_uid', staffUid.trim());

      const { data: rows, error } = await query;
      if (error) throw error;

      let filtered = rows ?? [];

      // Optional work_area filter — join via staff_users
      if (workArea !== 'all' && filtered.length > 0) {
        const uids = Array.from(new Set(filtered.map(r => r.staff_uid)));
        const { data: staffs } = await supabase
          .from('staff_users')
          .select('uid, work_area')
          .in('uid', uids);
        const allowed = new Set((staffs ?? []).filter(s => s.work_area === workArea).map(s => s.uid));
        filtered = filtered.filter(r => allowed.has(r.staff_uid));
      }

      if (filtered.length === 0) {
        toast({ title: 'Tidak ada data', description: 'Tidak ada checklist pada periode ini.' });
        setLoading(false);
        return;
      }

      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet(`P2H_TBM_${year}_${month}`);
      ws.columns = [
        { header: 'No', key: 'no', width: 6 },
        { header: 'Tanggal', key: 'date', width: 14 },
        { header: 'UID', key: 'uid', width: 14 },
        { header: 'Nama', key: 'name', width: 26 },
        { header: 'P2H Checked', key: 'p2h', width: 14 },
        { header: 'P2H Photo', key: 'p2h_photo', width: 40 },
        { header: 'Toolbox Checked', key: 'tb', width: 16 },
        { header: 'Toolbox Photo', key: 'tb_photo', width: 40 },
        { header: 'Created At', key: 'created', width: 22 },
      ];

      filtered.forEach((r, i) => {
        const row = ws.addRow({
          no: i + 1,
          date: r.checklist_date,
          uid: r.staff_uid,
          name: r.staff_name,
          p2h: r.p2h_checked ? 'Ya' : 'Tidak',
          p2h_photo: r.p2h_photo_url || '',
          tb: r.toolbox_checked ? 'Ya' : 'Tidak',
          tb_photo: r.toolbox_photo_url || '',
          created: r.created_at ? new Date(r.created_at).toLocaleString('id-ID') : '',
        });
        if (r.p2h_photo_url) {
          row.getCell('p2h_photo').value = { text: 'Lihat Foto', hyperlink: r.p2h_photo_url };
          row.getCell('p2h_photo').font = { color: { argb: 'FF1D4ED8' }, underline: true };
        }
        if (r.toolbox_photo_url) {
          row.getCell('tb_photo').value = { text: 'Lihat Foto', hyperlink: r.toolbox_photo_url };
          row.getCell('tb_photo').font = { color: { argb: 'FF1D4ED8' }, underline: true };
        }
      });

      // Header styling
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
      ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: 9 } };
      // Cell borders
      for (let r = 2; r <= ws.rowCount; r++) {
        ws.getRow(r).eachCell(cell => {
          cell.border = {
            top: { style: 'thin' }, left: { style: 'thin' },
            bottom: { style: 'thin' }, right: { style: 'thin' },
          };
        });
      }

      const buf = await wb.xlsx.writeBuffer();
      saveAs(new Blob([buf]), `P2H_Toolbox_${year}_${String(month).padStart(2, '0')}.xlsx`);
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
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <Label>Bulan</Label>
            <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {MONTHS.map((m, i) => (
                  <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Tahun</Label>
            <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {years.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
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
          Kolom foto berupa hyperlink — klik di Excel untuk membuka foto evidence.
        </p>
      </CardContent>
    </Card>
  );
};

export default P2HToolboxExporter;
