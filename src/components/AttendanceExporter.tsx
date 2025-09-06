import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Download, FileSpreadsheet, Calendar, Filter } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

interface ExportFilters {
  startDate: string;
  endDate: string;
  status: string;
  employeeUid: string;
}

interface StaffUser {
  uid: string;
  name: string;
}

const AttendanceExporter = () => {
  const [filters, setFilters] = useState<ExportFilters>({
    startDate: '',
    endDate: '',
    status: 'all',
    employeeUid: 'all'
  });
  const [employees, setEmployees] = useState<StaffUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingEmployees, setLoadingEmployees] = useState(false);

  React.useEffect(() => {
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
    setLoadingEmployees(true);
    const { data, error } = await supabase
      .from('staff_users')
      .select('uid, name')
      .eq('is_active', true)
      .order('name');

    if (error) {
      toast({
        title: "Error",
        description: "Failed to fetch employees",
        variant: "destructive"
      });
    } else {
      setEmployees(data || []);
    }
    setLoadingEmployees(false);
  };

  const fetchAttendanceData = async () => {
    if (!filters.startDate || !filters.endDate) {
      toast({
        title: "Error",
        description: "Please select start and end dates",
        variant: "destructive"
      });
      return null;
    }

    let query = supabase
      .from('attendance_records')
      .select(`
        *,
        staff_users!inner(name, position, work_area, division)
      `)
      .gte('date', filters.startDate)
      .lte('date', filters.endDate)
      .order('date', { ascending: false })
      .order('check_in_time', { ascending: false });

    // Apply status filter
    if (filters.status !== 'all') {
      query = query.eq('status', filters.status);
    }

    // Apply employee filter
    if (filters.employeeUid !== 'all') {
      query = query.eq('staff_uid', filters.employeeUid);
    }

    const { data, error } = await query;

    if (error) {
      toast({
        title: "Error",
        description: "Failed to fetch attendance data",
        variant: "destructive"
      });
      return null;
    }

    return data;
  };

  const formatDateForExport = (dateString: string | null) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString('id-ID', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const calculateWorkHours = (checkIn: string | null, checkOut: string | null) => {
    if (!checkIn || !checkOut) return '-';
    
    const start = new Date(checkIn);
    const end = new Date(checkOut);
    const diffMs = end.getTime() - start.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);
    
    return `${diffHours.toFixed(2)} jam`;
  };

  const exportToExcel = async () => {
    setLoading(true);
    
    try {
      const attendanceData = await fetchAttendanceData();
      
      if (!attendanceData || attendanceData.length === 0) {
        toast({
          title: "No Data",
          description: "No attendance records found for the selected filters",
          variant: "destructive"
        });
        setLoading(false);
        return;
      }

      // Prepare data for Excel
      const excelData = attendanceData.map((record: any, index: number) => ({
        'No': index + 1,
        'UID Karyawan': record.staff_uid,
        'Nama Karyawan': record.staff_name,
        'Jabatan': record.staff_users?.position || '-',
        'Area Kerja': record.staff_users?.work_area || '-',
        'Divisi': record.staff_users?.division || '-',
        'Tanggal': new Date(record.date).toLocaleDateString('id-ID'),
        'Status': record.status.toUpperCase(),
        'Waktu Check In': formatDateForExport(record.check_in_time),
        'Waktu Check Out': formatDateForExport(record.check_out_time),
        'Total Jam Kerja': calculateWorkHours(record.check_in_time, record.check_out_time),
        'Alamat Lokasi': record.location_address || '-',
        'Latitude': record.location_lat || '-',
        'Longitude': record.location_lng || '-',
        'Alasan': record.reason || '-',
        'Waktu Input': formatDateForExport(record.created_at)
      }));

      // Create workbook
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(excelData);

      // Set column widths
      const colWidths = [
        { wch: 5 },   // No
        { wch: 12 },  // UID
        { wch: 20 },  // Nama
        { wch: 15 },  // Jabatan
        { wch: 15 },  // Area Kerja
        { wch: 12 },  // Divisi
        { wch: 12 },  // Tanggal
        { wch: 8 },   // Status
        { wch: 18 },  // Check In
        { wch: 18 },  // Check Out
        { wch: 12 },  // Total Jam
        { wch: 30 },  // Alamat
        { wch: 12 },  // Lat
        { wch: 12 },  // Lng
        { wch: 20 },  // Alasan
        { wch: 18 }   // Waktu Input
      ];
      ws['!cols'] = colWidths;

      // Set page orientation to landscape
      ws['!printProps'] = {
        orientation: 'landscape',
        fitToWidth: 1,
        fitToHeight: 0
      };

      // Add worksheet to workbook
      XLSX.utils.book_append_sheet(wb, ws, 'Laporan Absensi');

      // Generate filename
      const startDate = new Date(filters.startDate).toLocaleDateString('id-ID').replace(/\//g, '-');
      const endDate = new Date(filters.endDate).toLocaleDateString('id-ID').replace(/\//g, '-');
      const statusText = filters.status === 'all' ? 'Semua' : filters.status.toUpperCase();
      const employeeText = filters.employeeUid === 'all' ? 'Semua-Karyawan' : filters.employeeUid;
      
      const filename = `Laporan-Absensi_${startDate}_${endDate}_${statusText}_${employeeText}.xlsx`;

      // Generate Excel file
      const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([excelBuffer], { type: 'application/octet-stream' });
      
      // Save file
      saveAs(blob, filename);

      toast({
        title: "Success",
        description: `Report exported successfully! ${attendanceData.length} records exported.`
      });

    } catch (error) {
      console.error('Export error:', error);
      toast({
        title: "Error",
        description: "Failed to export attendance report",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileSpreadsheet className="h-5 w-5" />
          Export Laporan Absensi
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Filter Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Date Range */}
            <div className="space-y-2">
              <Label htmlFor="startDate">Tanggal Mulai</Label>
              <Input
                id="startDate"
                type="date"
                value={filters.startDate}
                onChange={(e) => setFilters({...filters, startDate: e.target.value})}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="endDate">Tanggal Akhir</Label>
              <Input
                id="endDate"
                type="date"
                value={filters.endDate}
                onChange={(e) => setFilters({...filters, endDate: e.target.value})}
              />
            </div>

            {/* Status Filter */}
            <div className="space-y-2">
              <Label htmlFor="status">Status Absen</Label>
              <Select value={filters.status} onValueChange={(value) => setFilters({...filters, status: value})}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Status</SelectItem>
                  <SelectItem value="wfo">WFO</SelectItem>
                  <SelectItem value="wfh">WFH</SelectItem>
                  <SelectItem value="dinas">Dinas</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Employee Filter */}
            <div className="space-y-2">
              <Label htmlFor="employee">Karyawan</Label>
              <Select 
                value={filters.employeeUid} 
                onValueChange={(value) => setFilters({...filters, employeeUid: value})}
                disabled={loadingEmployees}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Karyawan</SelectItem>
                  {employees.map((employee) => (
                    <SelectItem key={employee.uid} value={employee.uid}>
                      {employee.name} ({employee.uid})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Filter Info */}
          <div className="p-4 bg-muted/50 rounded-lg border-l-4 border-primary">
            <div className="flex items-center gap-2 mb-2">
              <Filter className="h-4 w-4 text-primary" />
              <span className="font-medium text-sm">Filter Aktif:</span>
            </div>
            <div className="text-sm text-muted-foreground space-y-1">
              <div>
                📅 Periode: {filters.startDate ? new Date(filters.startDate).toLocaleDateString('id-ID') : '-'} 
                {' s/d '} 
                {filters.endDate ? new Date(filters.endDate).toLocaleDateString('id-ID') : '-'}
              </div>
              <div>📋 Status: {filters.status === 'all' ? 'Semua Status' : filters.status.toUpperCase()}</div>
              <div>👤 Karyawan: {filters.employeeUid === 'all' ? 'Semua Karyawan' : employees.find(e => e.uid === filters.employeeUid)?.name || filters.employeeUid}</div>
            </div>
          </div>

          {/* Export Button */}
          <div className="flex justify-center">
            <Button 
              onClick={exportToExcel}
              disabled={loading || !filters.startDate || !filters.endDate}
              className="gradient-primary px-8 py-3 text-lg"
              size="lg"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
                  Exporting...
                </>
              ) : (
                <>
                  <Download className="h-5 w-5 mr-2" />
                  Export ke Excel (XLSX)
                </>
              )}
            </Button>
          </div>

          {/* Export Info */}
          <div className="text-center text-sm text-muted-foreground">
            <p>📄 File akan berformat Excel (.xlsx) dengan orientasi landscape</p>
            <p>📍 Termasuk alamat lengkap dan koordinat lokasi absen</p>
            <p>⏱️ Data jam kerja otomatis dihitung berdasarkan check-in dan check-out</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default AttendanceExporter;