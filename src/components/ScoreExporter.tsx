import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Download, FileSpreadsheet, Calendar, Filter, FileText } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import * as XLSX from 'xlsx';
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
        exportToExcel(data);
      } else if (exportFormat === 'pdf') {
        exportToPDF(data);
      } else {
        exportToCSV(data);
      }
    } finally {
      setLoading(false);
    }
  };

  const exportToExcel = (data: any[]) => {
    const excelData = data.map((record, index) => ({
      'No': index + 1,
      'UID': record.staff_uid,
      'Nama': record.staff_name,
      'Tanggal': new Date(record.score_date).toLocaleDateString('id-ID'),
      'Tipe Karyawan': record.employee_type === 'primary' ? 'Primary' : 'Staff',
      'Area Kerja': record.work_area || '-',
      'Clock In': record.check_in_time || '-',
      'Clock Out': record.check_out_time || '-',
      'Score Clock In': record.clock_in_score,
      'Score Clock Out': record.clock_out_score,
      'Score P2H': record.p2h_score,
      'Score Toolbox': record.toolbox_score,
      'Final Score': record.final_score,
      'Terlambat': record.is_late ? 'Ya' : 'Tidak',
      'Metode Kalkulasi': record.calculation_method || 'manual'
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(excelData);

    // Set column widths
    ws['!cols'] = [
      { wch: 5 },   // No
      { wch: 12 },  // UID
      { wch: 20 },  // Nama
      { wch: 12 },  // Tanggal
      { wch: 12 },  // Tipe
      { wch: 15 },  // Area
      { wch: 10 },  // Clock In
      { wch: 10 },  // Clock Out
      { wch: 12 },  // Score In
      { wch: 12 },  // Score Out
      { wch: 10 },  // P2H
      { wch: 10 },  // Toolbox
      { wch: 12 },  // Final
      { wch: 10 },  // Terlambat
      { wch: 12 }   // Metode
    ];

    XLSX.utils.book_append_sheet(wb, ws, 'Laporan Score');

    const startDate = new Date(filters.startDate).toLocaleDateString('id-ID').replace(/\//g, '-');
    const endDate = new Date(filters.endDate).toLocaleDateString('id-ID').replace(/\//g, '-');
    const filename = `Laporan-Score_${startDate}_${endDate}.xlsx`;

    const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelBuffer], { type: 'application/octet-stream' });
    saveAs(blob, filename);

    toast({
      title: "Berhasil",
      description: `${data.length} data score berhasil diekspor`
    });
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