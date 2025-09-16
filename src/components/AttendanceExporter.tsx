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
  workArea: string;
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
    employeeUid: 'all',
    workArea: 'all'
  });
  const [employees, setEmployees] = useState<StaffUser[]>([]);
  const [workAreas, setWorkAreas] = useState<string[]>([]);
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
      .select('uid, name, work_area')
      .eq('is_active', true)
      .order('name');

    if (error) {
      toast({
        title: "Gagal",
        description: "Gagal memuat data karyawan",
        variant: "destructive"
      });
    } else {
      const staff = data || [];
      setEmployees(staff);
      
      // Extract unique work areas
      const areas = [...new Set(staff.map((s: any) => s.work_area))].sort();
      setWorkAreas(areas);
    }
    setLoadingEmployees(false);
  };

  const fetchAttendanceData = async () => {
    if (!filters.startDate || !filters.endDate) {
      toast({
        title: "Gagal",
        description: "Silakan pilih tanggal mulai dan akhir",
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

    // Apply work area filter
    if (filters.workArea !== 'all') {
      query = query.eq('staff_users.work_area', filters.workArea);
    }

    const { data, error } = await query;

    if (error) {
      toast({
        title: "Gagal",
        description: "Gagal memuat data absensi",
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
          title: "Tidak Ada Data",
          description: "Tidak ada catatan absensi untuk filter yang dipilih",
          variant: "destructive"
        });
        setLoading(false);
        return;
      }

      // Prepare data for Excel (resolve geofence name for WFO)
      const { data: geofences } = await supabase
        .from('geofence_areas')
        .select('name, center_lat, center_lng, radius')
        .eq('is_active', true);

      const distance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
        const R = 6371e3;
        const φ1 = (lat1 * Math.PI) / 180;
        const φ2 = (lat2 * Math.PI) / 180;
        const Δφ = ((lat2 - lat1) * Math.PI) / 180;
        const Δλ = ((lon2 - lon1) * Math.PI) / 180;
        const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
      };

      const findGeofenceName = (lat?: number, lng?: number): string | null => {
        if (!lat || !lng || !geofences) return null;
        for (const g of geofences as any[]) {
          if (g.center_lat && g.center_lng && g.radius) {
            const d = distance(
              Number(lat),
              Number(lng),
              parseFloat(g.center_lat.toString()),
              parseFloat(g.center_lng.toString())
            );
            if (d <= g.radius) return g.name as string;
          }
        }
        return null;
      };

      const excelData = attendanceData.map((record: any, index: number) => {
        const geofenceName = record.status === 'wfo' && record.location_lat && record.location_lng
          ? findGeofenceName(Number(record.location_lat), Number(record.location_lng))
          : null;
        return {
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
          'Alamat Lokasi': geofenceName || record.location_address || '-',
          'Koordinat': record.location_lat && record.location_lng 
            ? `${record.location_lat}, ${record.location_lng}` 
            : '-',
          'Foto': record.selfie_photo_url ? 'Lihat Foto' : '-',
          'Alasan': record.reason || '-',
          'Waktu Input': formatDateForExport(record.created_at)
        };
      });

      // Create workbook
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(excelData);

      // Generate signed URLs for private photos
      const signedPhotoUrls = await Promise.all(
        attendanceData.map(async (record: any) => {
          if (record.selfie_photo_url) {
            try {
              const { data } = await supabase
                .storage
                .from('attendance-photos')
                .createSignedUrl(record.selfie_photo_url, 60 * 60 * 24 * 14); // 14 days
              return data?.signedUrl || null;
            } catch (e) {
              return null;
            }
          }
          return null;
        })
      );

      // Add hyperlinks after creating the sheet
      attendanceData.forEach((record: any, index: number) => {
        const rowIndex = index + 2; // +2 because row 1 is header and Excel is 1-indexed
        
        // Add coordinate hyperlink
        if (record.location_lat && record.location_lng) {
          const coordCell = `M${rowIndex}`; // Column M is Koordinat
          const mapsUrl = `https://www.google.com/maps?q=${record.location_lat},${record.location_lng}`;
          ws[coordCell] = {
            t: 's',
            v: `${record.location_lat}, ${record.location_lng}`,
            l: { Target: mapsUrl, Tooltip: 'Buka lokasi di Google Maps' }
          };
        }
        
        // Add photo hyperlink (signed URL)
        const signedUrl = signedPhotoUrls[index];
        if (signedUrl) {
          const photoCell = `N${rowIndex}`; // Column N is Foto
          ws[photoCell] = {
            t: 's',
            v: 'Lihat Foto',
            l: { Target: signedUrl, Tooltip: 'Buka foto selfie' }
          };
        }
      });

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
        { wch: 35 },  // Alamat
        { wch: 20 },  // Koordinat
        { wch: 15 },  // Foto
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
      const workAreaText = filters.workArea === 'all' ? 'Semua-Area' : filters.workArea;
      
      const filename = `Laporan-Absensi_${startDate}_${endDate}_${statusText}_${workAreaText}_${employeeText}.xlsx`;

      // Generate Excel file
      const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([excelBuffer], { type: 'application/octet-stream' });
      
      // Save file
      saveAs(blob, filename);

      toast({
        title: "Berhasil",
        description: `Laporan berhasil diekspor! ${attendanceData.length} catatan diekspor.`
      });

    } catch (error) {
      console.error('Export error:', error);
      toast({
        title: "Gagal",
        description: "Gagal mengekspor laporan absensi",
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
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

            {/* Work Area Filter */}
            <div className="space-y-2">
              <Label htmlFor="workArea">Area Tugas</Label>
              <Select 
                value={filters.workArea} 
                onValueChange={(value) => setFilters({...filters, workArea: value})}
                disabled={loadingEmployees}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Area</SelectItem>
                  {workAreas.map((area) => (
                    <SelectItem key={area} value={area}>
                      {area}
                    </SelectItem>
                  ))}
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
              <div>🏢 Area Tugas: {filters.workArea === 'all' ? 'Semua Area' : filters.workArea}</div>
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
            <p>📍 Koordinat lokasi dapat diklik untuk membuka peta di browser</p>
            <p>📷 Kolom foto berisi link untuk membuka foto selfie saat absen</p>
            <p>⏱️ Data jam kerja otomatis dihitung berdasarkan check-in dan check-out</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default AttendanceExporter;