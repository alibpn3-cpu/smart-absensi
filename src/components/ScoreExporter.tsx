import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Download, FileSpreadsheet, Calendar, Filter, FileText } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface ScoreFilters {
  startDate: string;
  endDate: string;
  employeeUid: string;
  workArea: string;
  employeeType: string;
}

interface StaffUser {
  uid: string;
  name: string;
  work_area?: string;
  employee_type?: string;
}

const ScoreExporter = () => {
  const [filters, setFilters] = useState<ScoreFilters>({
    startDate: '',
    endDate: '',
    employeeUid: 'all',
    workArea: 'all',
    employeeType: 'all'
  });
  const [employees, setEmployees] = useState<StaffUser[]>([]);
  const [allEmployees, setAllEmployees] = useState<StaffUser[]>([]);
  const [workAreas, setWorkAreas] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [exportFormat, setExportFormat] = useState<'excel' | 'pdf' | 'csv'>('excel');

  useEffect(() => {
    fetchEmployees();
    
    // Set default dates (current month)
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    
    setFilters(prev => ({
      ...prev,
      startDate: firstDay.toISOString().split('T')[0],
      endDate: lastDay.toISOString().split('T')[0]
    }));
  }, []);

  const fetchEmployees = async () => {
    const { data, error } = await supabase
      .from('staff_users')
      .select('uid, name, work_area, employee_type')
      .eq('is_active', true)
      .order('name');

    if (!error && data) {
      setEmployees(data);
      setAllEmployees(data);
      const areas = [...new Set(data.map(s => s.work_area).filter(Boolean))].sort();
      setWorkAreas(areas as string[]);
    }
  };

  const fetchScoreData = async () => {
    if (!filters.startDate || !filters.endDate) {
      toast({
        title: "Gagal",
        description: "Silakan pilih tanggal mulai dan akhir",
        variant: "destructive"
      });
      return null;
    }

    let query = supabase
      .from('daily_scores')
      .select('*')
      .gte('score_date', filters.startDate)
      .lte('score_date', filters.endDate)
      .order('score_date', { ascending: false })
      .order('staff_name', { ascending: true });

    if (filters.employeeUid !== 'all') {
      query = query.eq('staff_uid', filters.employeeUid);
    }

    if (filters.workArea !== 'all') {
      query = query.eq('work_area', filters.workArea);
    }

    if (filters.employeeType !== 'all') {
      query = query.eq('employee_type', filters.employeeType);
    }

    const { data, error } = await query;

    if (error) {
      toast({
        title: "Gagal",
        description: "Gagal memuat data score",
        variant: "destructive"
      });
      return null;
    }

    // Fetch P2H/Toolbox checklist data
    if (data && data.length > 0) {
      const dates = [...new Set(data.map((r: any) => r.score_date))];
      const uids = [...new Set(data.map((r: any) => r.staff_uid))];
      
      const { data: checklistData } = await supabase
        .from('p2h_toolbox_checklist')
        .select('*')
        .in('checklist_date', dates)
        .in('staff_uid', uids);
      
      // Create lookup map
      const checklistMap = new Map();
      checklistData?.forEach((c: any) => {
        checklistMap.set(`${c.staff_uid}_${c.checklist_date}`, c);
      });
      
      // Attach checklist data to each score record
      return data.map((record: any) => ({
        ...record,
        checklist: checklistMap.get(`${record.staff_uid}_${record.score_date}`) || null
      }));
    }

    return data;
  };

  const handleExport = async () => {
    setLoading(true);
    try {
      const data = await fetchScoreData();
      if (!data || data.length === 0) {
        toast({
          title: "Tidak Ada Data",
          description: "Tidak ada data score untuk filter yang dipilih",
          variant: "destructive"
        });
        return;
      }

      if (exportFormat === 'excel') {
        await exportToExcel(data);
      } else if (exportFormat === 'pdf') {
        exportToPDF(data);
      } else {
        exportToCSV(data);
      }
    } finally {
      setLoading(false);
    }
  };

  const exportToExcel = async (data: any[]) => {
    try {
      // Generate photo URLs for P2H/Toolbox
      const photoUrls = await Promise.all(
        data.map(async (record) => {
          let p2hUrl = null;
          let toolboxUrl = null;
          
          if (record.checklist?.p2h_photo_url) {
            const { data: urlData } = supabase.storage
              .from('p2h-photos')
              .getPublicUrl(record.checklist.p2h_photo_url);
            p2hUrl = urlData?.publicUrl || null;
          }
          
          if (record.checklist?.toolbox_photo_url) {
            const { data: urlData } = supabase.storage
              .from('p2h-photos')
              .getPublicUrl(record.checklist.toolbox_photo_url);
            toolboxUrl = urlData?.publicUrl || null;
          }
          
          return { p2h: p2hUrl, toolbox: toolboxUrl };
        })
      );

      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Laporan Score');

      // Define columns with headers and widths
      worksheet.columns = [
        { header: 'No', key: 'no', width: 5 },
        { header: 'UID', key: 'uid', width: 12 },
        { header: 'Nama', key: 'nama', width: 20 },
        { header: 'Tanggal', key: 'tanggal', width: 12 },
        { header: 'Tipe Karyawan', key: 'tipe', width: 12 },
        { header: 'Area Kerja', key: 'area', width: 15 },
        { header: 'Clock In', key: 'clockIn', width: 10 },
        { header: 'Clock Out', key: 'clockOut', width: 10 },
        { header: 'Score Clock In', key: 'scoreIn', width: 12 },
        { header: 'Score Clock Out', key: 'scoreOut', width: 12 },
        { header: 'Score P2H', key: 'p2h', width: 10 },
        { header: 'Score Toolbox', key: 'toolbox', width: 10 },
        { header: 'Final Score', key: 'final', width: 12 },
        { header: 'Terlambat', key: 'terlambat', width: 10 },
        { header: 'Foto P2H', key: 'fotoP2h', width: 12 },
        { header: 'Foto Toolbox', key: 'fotoToolbox', width: 12 },
        { header: 'Metode', key: 'metode', width: 12 }
      ];

      // Add data rows
      data.forEach((record, index) => {
        const row = worksheet.addRow({
          no: index + 1,
          uid: record.staff_uid,
          nama: record.staff_name,
          tanggal: new Date(record.score_date).toLocaleDateString('id-ID'),
          tipe: record.employee_type === 'primary' ? 'Primary' : 'Staff',
          area: record.work_area || '-',
          clockIn: record.check_in_time || '-',
          clockOut: record.check_out_time || '-',
          scoreIn: record.clock_in_score,
          scoreOut: record.clock_out_score,
          p2h: record.p2h_score,
          toolbox: record.toolbox_score,
          final: record.final_score,
          terlambat: record.is_late ? 'Ya' : 'Tidak',
          fotoP2h: photoUrls[index]?.p2h ? 'Lihat Foto' : '-',
          fotoToolbox: photoUrls[index]?.toolbox ? 'Lihat Foto' : '-',
          metode: record.calculation_method || 'manual'
        });

        // Add hyperlinks for photos
        if (photoUrls[index]?.p2h) {
          const cell = row.getCell('fotoP2h');
          cell.value = { text: 'Lihat Foto', hyperlink: photoUrls[index].p2h };
          cell.font = { color: { argb: 'FF0000FF' }, underline: true };
        }
        if (photoUrls[index]?.toolbox) {
          const cell = row.getCell('fotoToolbox');
          cell.value = { text: 'Lihat Foto', hyperlink: photoUrls[index].toolbox };
          cell.font = { color: { argb: 'FF0000FF' }, underline: true };
        }
      });

      // Style header row - BOLD + BLUE BACKGROUND + WHITE TEXT
      const headerRow = worksheet.getRow(1);
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF3B82F6' }
      };
      headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
      headerRow.height = 25;

      // Add borders to all cells
      worksheet.eachRow((row) => {
        row.eachCell((cell) => {
          cell.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' }
          };
        });
      });

      // Freeze header row
      worksheet.views = [{ state: 'frozen', ySplit: 1 }];

      // Add auto filter
      worksheet.autoFilter = {
        from: 'A1',
        to: `Q${data.length + 1}`
      };

      // Generate filename
      const startDate = new Date(filters.startDate).toLocaleDateString('id-ID').replace(/\//g, '-');
      const endDate = new Date(filters.endDate).toLocaleDateString('id-ID').replace(/\//g, '-');
      const filename = `Laporan-Score_${startDate}_${endDate}.xlsx`;

      // Save file
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      saveAs(blob, filename);

      toast({
        title: "Berhasil",
        description: `${data.length} data score berhasil diekspor`
      });
    } catch (error) {
      console.error('Export error:', error);
      toast({
        title: "Gagal",
        description: "Gagal mengekspor data score",
        variant: "destructive"
      });
    }
  };

  const exportToPDF = (data: any[]) => {
    const doc = new jsPDF('landscape', 'mm', 'a4');
    
    doc.setFontSize(16);
    doc.setTextColor(59, 130, 246);
    doc.text('Laporan Score Karyawan', 14, 15);
    
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Periode: ${new Date(filters.startDate).toLocaleDateString('id-ID')} - ${new Date(filters.endDate).toLocaleDateString('id-ID')}`, 14, 22);

    const tableData = data.map((record, index) => [
      index + 1,
      record.staff_uid,
      record.staff_name,
      new Date(record.score_date).toLocaleDateString('id-ID'),
      record.employee_type === 'primary' ? 'Primary' : 'Staff',
      record.clock_in_score,
      record.clock_out_score,
      record.p2h_score,
      record.toolbox_score,
      record.final_score,
      record.is_late ? 'Ya' : 'Tidak'
    ]);

    autoTable(doc, {
      head: [['No', 'UID', 'Nama', 'Tanggal', 'Tipe', 'In', 'Out', 'P2H', 'TBM', 'Final', 'Telat']],
      body: tableData,
      startY: 28,
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [59, 130, 246], textColor: 255 }
    });

    const startDate = new Date(filters.startDate).toLocaleDateString('id-ID').replace(/\//g, '-');
    const endDate = new Date(filters.endDate).toLocaleDateString('id-ID').replace(/\//g, '-');
    doc.save(`Laporan-Score_${startDate}_${endDate}.pdf`);

    toast({
      title: "Berhasil",
      description: `${data.length} data score berhasil diekspor ke PDF`
    });
  };

  const exportToCSV = (data: any[]) => {
    const headers = ['No', 'UID', 'Nama', 'Tanggal', 'Tipe', 'Area', 'Clock In', 'Clock Out', 'Score In', 'Score Out', 'P2H', 'Toolbox', 'Final', 'Terlambat'];
    const csvContent = [
      headers.join(','),
      ...data.map((record, index) => [
        index + 1,
        record.staff_uid,
        `"${record.staff_name}"`,
        new Date(record.score_date).toLocaleDateString('id-ID'),
        record.employee_type === 'primary' ? 'Primary' : 'Staff',
        `"${record.work_area || '-'}"`,
        record.check_in_time || '-',
        record.check_out_time || '-',
        record.clock_in_score,
        record.clock_out_score,
        record.p2h_score,
        record.toolbox_score,
        record.final_score,
        record.is_late ? 'Ya' : 'Tidak'
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
    const startDate = new Date(filters.startDate).toLocaleDateString('id-ID').replace(/\//g, '-');
    const endDate = new Date(filters.endDate).toLocaleDateString('id-ID').replace(/\//g, '-');
    saveAs(blob, `Laporan-Score_${startDate}_${endDate}.csv`);

    toast({
      title: "Berhasil",
      description: `${data.length} data score berhasil diekspor ke CSV`
    });
  };

  // Filter employees based on work area
  useEffect(() => {
    if (filters.workArea === 'all') {
      setEmployees(allEmployees);
    } else {
      setEmployees(allEmployees.filter(e => e.work_area === filters.workArea));
    }
  }, [filters.workArea, allEmployees]);

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-foreground">
          <FileSpreadsheet className="h-5 w-5" />
          Export Laporan Score
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Date Range */}
          <div className="space-y-2">
            <Label className="text-foreground">Tanggal Mulai</Label>
            <Input
              type="date"
              value={filters.startDate}
              onChange={(e) => setFilters(prev => ({ ...prev, startDate: e.target.value }))}
              className="bg-background border-border"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-foreground">Tanggal Akhir</Label>
            <Input
              type="date"
              value={filters.endDate}
              onChange={(e) => setFilters(prev => ({ ...prev, endDate: e.target.value }))}
              className="bg-background border-border"
            />
          </div>

          {/* Work Area */}
          <div className="space-y-2">
            <Label className="text-foreground">Area Kerja</Label>
            <Select value={filters.workArea} onValueChange={(v) => setFilters(prev => ({ ...prev, workArea: v, employeeUid: 'all' }))}>
              <SelectTrigger className="bg-background border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Area</SelectItem>
                {workAreas.map(area => (
                  <SelectItem key={area} value={area}>{area}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Employee Type */}
          <div className="space-y-2">
            <Label className="text-foreground">Tipe Karyawan</Label>
            <Select value={filters.employeeType} onValueChange={(v) => setFilters(prev => ({ ...prev, employeeType: v }))}>
              <SelectTrigger className="bg-background border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Tipe</SelectItem>
                <SelectItem value="primary">Primary</SelectItem>
                <SelectItem value="staff">Staff</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Employee */}
          <div className="space-y-2">
            <Label className="text-foreground">Karyawan</Label>
            <Select value={filters.employeeUid} onValueChange={(v) => setFilters(prev => ({ ...prev, employeeUid: v }))}>
              <SelectTrigger className="bg-background border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Karyawan</SelectItem>
                {employees.map(emp => (
                  <SelectItem key={emp.uid} value={emp.uid}>{emp.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Export Format */}
          <div className="space-y-2">
            <Label className="text-foreground">Format Export</Label>
            <Select value={exportFormat} onValueChange={(v: 'excel' | 'pdf' | 'csv') => setExportFormat(v)}>
              <SelectTrigger className="bg-background border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="excel">
                  <div className="flex items-center gap-2">
                    <FileSpreadsheet className="h-4 w-4" />
                    Excel (.xlsx)
                  </div>
                </SelectItem>
                <SelectItem value="pdf">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    PDF
                  </div>
                </SelectItem>
                <SelectItem value="csv">
                  <div className="flex items-center gap-2">
                    <FileSpreadsheet className="h-4 w-4" />
                    CSV
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <Button onClick={handleExport} disabled={loading} className="w-full sm:w-auto">
          <Download className="h-4 w-4 mr-2" />
          {loading ? 'Mengekspor...' : 'Export Score'}
        </Button>
      </CardContent>
    </Card>
  );
};

export default ScoreExporter;