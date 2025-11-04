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
  work_area?: string;
  position?: string;
  division?: string;
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
  const [allEmployees, setAllEmployees] = useState<StaffUser[]>([]);
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
      .select('uid, name, work_area, position, division')
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
      setAllEmployees(staff);
      
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
      .select('*')
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
      const uids = allEmployees
        .filter((s) => s.work_area === filters.workArea)
        .map((s) => s.uid);
      if (uids.length === 0) {
        return [];
      }
      query = query.in('staff_uid', uids);
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

  const formatTimeForExport = (timeString: string | null) => {
    if (!timeString) return '-';
    try {
      // Parse the stored time string (format: "YYYY-MM-DD HH:mm:ss.sss+HH:mm")
      // Extract just the time portion for display
      const parts = timeString.split(' ');
      if (parts.length >= 2) {
        const timePart = parts[1].split('+')[0]; // Remove timezone offset
        return timePart;
      }
      return timeString;
    } catch {
      return timeString;
    }
  };

  const calculateWorkHours = (checkIn: string | null, checkOut: string | null) => {
    if (!checkIn || !checkOut) return '-';
    
    try {
      // Parse the stored time strings (format: "YYYY-MM-DD HH:mm:ss.sss+HH:mm")
      const start = new Date(checkIn.replace(' ', 'T'));
      const end = new Date(checkOut.replace(' ', 'T'));
      
      if (isNaN(start.getTime()) || isNaN(end.getTime())) return '-';
      
      const diffMs = end.getTime() - start.getTime();
      
      // Convert to hours, minutes, seconds
      const totalSeconds = Math.floor(diffMs / 1000);
      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = totalSeconds % 60;
      
      // Format output
      const parts = [];
      if (hours > 0) parts.push(`${hours} jam`);
      if (minutes > 0) parts.push(`${minutes} menit`);
      if (seconds > 0 && hours === 0) parts.push(`${seconds} detik`); // Show seconds only if less than 1 hour
      
      return parts.length > 0 ? parts.join(' ') : '0 detik';
    } catch {
      return '-';
    }
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
        const geofenceName = record.status === 'wfo' && record.checkin_location_lat && record.checkin_location_lng
          ? findGeofenceName(Number(record.checkin_location_lat), Number(record.checkin_location_lng))
          : null;
        
        const checkoutGeofenceName = record.status === 'wfo' && record.checkout_location_lat && record.checkout_location_lng
          ? findGeofenceName(Number(record.checkout_location_lat), Number(record.checkout_location_lng))
          : null;
        
        const checkoutLat = record.checkout_location_lat ?? (record.check_out_time ? record.checkin_location_lat : null);
        const checkoutLng = record.checkout_location_lng ?? (record.check_out_time ? record.checkin_location_lng : null);
        const checkoutAddress = checkoutGeofenceName || record.checkout_location_address || (record.check_out_time ? record.checkin_location_address : null);
          
        const emp = allEmployees.find((s: any) => s.uid === record.staff_uid);
        
        return {
          'No': index + 1,
          'UID Karyawan': record.staff_uid,
          'Nama Karyawan': record.staff_name,
          'Jabatan': emp?.position || '-',
          'Area Kerja': emp?.work_area || '-',
          'Divisi': emp?.division || '-',
          'Tanggal': new Date(record.date).toLocaleDateString('id-ID'),
          'Status': record.status.toUpperCase(),
          'Waktu Check In': formatTimeForExport(record.check_in_time),
          'Waktu Check Out': formatTimeForExport(record.check_out_time),
          'Total Jam Kerja': calculateWorkHours(record.check_in_time, record.check_out_time),
          'Alamat Lokasi Check In': geofenceName || record.checkin_location_address || '-',
          'Koordinat Check In': record.checkin_location_lat && record.checkin_location_lng 
            ? `${record.checkin_location_lat}, ${record.checkin_location_lng}` 
            : '-',
          'Alamat Lokasi Check Out': checkoutAddress || '-',
          'Koordinat Check Out': checkoutLat && checkoutLng 
            ? `${checkoutLat}, ${checkoutLng}` 
            : '-',
          'Foto Check In': record.selfie_checkin_url || record.selfie_photo_url ? 'Lihat Foto' : '-',
          'Foto Check Out': record.selfie_checkout_url ? 'Lihat Foto' : '-',
          'Alasan': record.reason || '-'
        };
      });

      // Create workbook
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(excelData);

      // Generate signed URLs for private photos (both check-in and check-out)
      const signedPhotoUrls = await Promise.all(
        attendanceData.map(async (record: any) => {
          const checkinUrl = record.selfie_checkin_url || record.selfie_photo_url;
          const checkoutUrl = record.selfie_checkout_url;
          
          let checkinSigned = null;
          let checkoutSigned = null;
          
          if (checkinUrl) {
            try {
              const { data } = await supabase
                .storage
                .from('attendance-photos')
                .createSignedUrl(checkinUrl, 60 * 60 * 24 * 14); // 14 days
              checkinSigned = data?.signedUrl || null;
            } catch (e) {
              console.error('Error generating check-in signed URL:', e);
            }
          }
          
          if (checkoutUrl) {
            try {
              const { data } = await supabase
                .storage
                .from('attendance-photos')
                .createSignedUrl(checkoutUrl, 60 * 60 * 24 * 14); // 14 days
              checkoutSigned = data?.signedUrl || null;
            } catch (e) {
              console.error('Error generating check-out signed URL:', e);
            }
          }
          
          return { checkin: checkinSigned, checkout: checkoutSigned };
        })
      );

      // Add hyperlinks after creating the sheet
      attendanceData.forEach((record: any, index: number) => {
        const rowIndex = index + 2; // +2 because row 1 is header and Excel is 1-indexed
        
        // Add check-in coordinate hyperlink
        if (record.checkin_location_lat && record.checkin_location_lng) {
          const coordCell = `M${rowIndex}`; // Column M is Koordinat Check In
          const mapsUrl = `https://www.google.com/maps?q=${record.checkin_location_lat},${record.checkin_location_lng}`;
          ws[coordCell] = {
            t: 's',
            v: `${record.checkin_location_lat}, ${record.checkin_location_lng}`,
            l: { Target: mapsUrl, Tooltip: 'Buka lokasi check-in di Google Maps' }
          };
        }
        
        // Add check-out coordinate hyperlink (with fallback to check-in if needed)
        const cLat = record.checkout_location_lat ?? (record.check_out_time ? record.checkin_location_lat : null);
        const cLng = record.checkout_location_lng ?? (record.check_out_time ? record.checkin_location_lng : null);
        if (cLat && cLng) {
          const coordCell = `O${rowIndex}`; // Column O is Koordinat Check Out
          const mapsUrl = `https://www.google.com/maps?q=${cLat},${cLng}`;
          ws[coordCell] = {
            t: 's',
            v: `${cLat}, ${cLng}`,
            l: { Target: mapsUrl, Tooltip: 'Buka lokasi check-out di Google Maps' }
          };
        }
        
        // Add photo hyperlinks (signed URLs)
        const photoUrls = signedPhotoUrls[index];
        
        // Check-in photo
        if (photoUrls?.checkin) {
          const checkinPhotoCell = `P${rowIndex}`; // Column P is Foto Check In
          ws[checkinPhotoCell] = {
            t: 's',
            v: 'Lihat Foto',
            l: { Target: photoUrls.checkin, Tooltip: 'Buka foto check-in' }
          };
        }
        
        // Check-out photo
        if (photoUrls?.checkout) {
          const checkoutPhotoCell = `Q${rowIndex}`; // Column Q is Foto Check Out
          ws[checkoutPhotoCell] = {
            t: 's',
            v: 'Lihat Foto',
            l: { Target: photoUrls.checkout, Tooltip: 'Buka foto check-out' }
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
        { wch: 35 },  // Alamat Check In
        { wch: 20 },  // Koordinat Check In
        { wch: 35 },  // Alamat Check Out
        { wch: 20 },  // Koordinat Check Out
        { wch: 15 },  // Foto Check In
        { wch: 15 },  // Foto Check Out
        { wch: 20 }   // Alasan
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

            {/* Employee Filter with Search */}
            <div className="space-y-2">
              <Label htmlFor="employee">Karyawan</Label>
              <Select 
                value={filters.employeeUid} 
                onValueChange={(value) => setFilters({...filters, employeeUid: value})}
                disabled={loadingEmployees}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pilih karyawan..." />
                </SelectTrigger>
                <SelectContent>
                  <div className="p-2">
                    <Input 
                      placeholder="Cari nama karyawan..." 
                      onChange={(e) => {
                        const search = e.target.value.toLowerCase();
                        if (!search) {
                          setEmployees(allEmployees);
                        } else {
                          const filtered = allEmployees.filter(emp => 
                            emp.name.toLowerCase().includes(search)
                          );
                          setEmployees(filtered);
                        }
                      }}
                      className="mb-2"
                    />
                  </div>
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