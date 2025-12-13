import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Download, FileSpreadsheet, Calendar, Filter, FileText, FileJson } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

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
  const [exportFormat, setExportFormat] = useState<'excel' | 'pdf' | 'csv' | 'html'>('excel');

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
          'Jenis Absensi': record.attendance_type === 'overtime' ? 'LEMBUR' : 'REGULAR',
          'Waktu Check In': formatTimeForExport(record.check_in_time),
          'Waktu Check Out': formatTimeForExport(record.check_out_time),
          'Total Jam Kerja': record.hours_worked || calculateWorkHours(record.check_in_time, record.check_out_time),
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
          const coordCell = `N${rowIndex}`; // Column N is Koordinat Check In (was M before new column)
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
          const coordCell = `P${rowIndex}`; // Column P is Koordinat Check Out (was O before new column)
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
          const checkinPhotoCell = `Q${rowIndex}`; // Column Q is Foto Check In (was P before new column)
          ws[checkinPhotoCell] = {
            t: 's',
            v: 'Lihat Foto',
            l: { Target: photoUrls.checkin, Tooltip: 'Buka foto check-in' }
          };
        }
        
        // Check-out photo
        if (photoUrls?.checkout) {
          const checkoutPhotoCell = `R${rowIndex}`; // Column R is Foto Check Out (was Q before new column)
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
        { wch: 12 },  // Jenis Absensi (NEW)
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

  const getExportData = async () => {
    const attendanceData = await fetchAttendanceData();
    if (!attendanceData || attendanceData.length === 0) {
      toast({
        title: "Tidak Ada Data",
        description: "Tidak ada catatan absensi untuk filter yang dipilih",
        variant: "destructive"
      });
      return null;
    }
    return attendanceData.map((record: any, index: number) => {
      const emp = allEmployees.find((s: any) => s.uid === record.staff_uid);
      return {
        no: index + 1,
        uid: record.staff_uid,
        name: record.staff_name,
        position: emp?.position || '-',
        workArea: emp?.work_area || '-',
        division: emp?.division || '-',
        date: new Date(record.date).toLocaleDateString('id-ID'),
        status: record.status.toUpperCase(),
        attendanceType: record.attendance_type === 'overtime' ? 'LEMBUR' : 'REGULAR',
        checkIn: formatTimeForExport(record.check_in_time),
        checkOut: formatTimeForExport(record.check_out_time),
        hoursWorked: record.hours_worked || calculateWorkHours(record.check_in_time, record.check_out_time),
        checkinAddress: record.checkin_location_address || '-',
        checkoutAddress: record.checkout_location_address || '-',
        reason: record.reason || '-'
      };
    });
  };

  const exportToPDF = async () => {
    setLoading(true);
    try {
      const data = await getExportData();
      if (!data) { setLoading(false); return; }

      const doc = new jsPDF('landscape', 'mm', 'a4');
      
      // Header
      doc.setFontSize(16);
      doc.setTextColor(59, 130, 246);
      doc.text('Laporan Absensi Karyawan', 14, 15);
      
      // Info periode
      doc.setFontSize(10);
      doc.setTextColor(100);
      doc.text(`Periode: ${filters.startDate} s/d ${filters.endDate}`, 14, 22);
      doc.text(`Total Records: ${data.length}`, 14, 27);
      
      // Table
      autoTable(doc, {
        head: [['No', 'Nama', 'Tanggal', 'Status', 'Jenis', 'Check In', 'Check Out', 'Jam Kerja', 'Lokasi Check In']],
        body: data.map((r) => [
          r.no, r.name, r.date, r.status, r.attendanceType, r.checkIn, r.checkOut, r.hoursWorked, r.checkinAddress
        ]),
        startY: 32,
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [59, 130, 246], textColor: 255 },
        alternateRowStyles: { fillColor: [245, 247, 250] }
      });
      
      // Page numbers
      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text(`Halaman ${i} dari ${pageCount}`, doc.internal.pageSize.width / 2, doc.internal.pageSize.height - 10, { align: 'center' });
      }
      
      const filename = `Laporan-Absensi_${filters.startDate}_${filters.endDate}.pdf`;
      doc.save(filename);
      
      toast({ title: "Berhasil", description: `PDF berhasil diekspor! ${data.length} catatan.` });
    } catch (error) {
      console.error('PDF Export error:', error);
      toast({ title: "Gagal", description: "Gagal mengekspor PDF", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const exportToCSV = async () => {
    setLoading(true);
    try {
      const data = await getExportData();
      if (!data) { setLoading(false); return; }

      const BOM = '\uFEFF';
      const headers = ['No', 'UID', 'Nama', 'Jabatan', 'Area Kerja', 'Divisi', 'Tanggal', 'Status', 'Jenis Absensi', 'Check In', 'Check Out', 'Jam Kerja', 'Lokasi Check In', 'Lokasi Check Out', 'Alasan'];
      const rows = data.map((r) => [
        r.no, r.uid, r.name, r.position, r.workArea, r.division, r.date, r.status, r.attendanceType, r.checkIn, r.checkOut, r.hoursWorked, r.checkinAddress, r.checkoutAddress, r.reason
      ]);
      
      const csvContent = BOM + [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      ].join('\n');
      
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      saveAs(blob, `Laporan-Absensi_${filters.startDate}_${filters.endDate}.csv`);
      
      toast({ title: "Berhasil", description: `CSV berhasil diekspor! ${data.length} catatan.` });
    } catch (error) {
      console.error('CSV Export error:', error);
      toast({ title: "Gagal", description: "Gagal mengekspor CSV", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const exportToHTML = async () => {
    setLoading(true);
    try {
      const data = await getExportData();
      if (!data) { setLoading(false); return; }

      const tableRows = data.map(r => `
        <tr>
          <td>${r.no}</td>
          <td>${r.name}</td>
          <td>${r.date}</td>
          <td><span class="badge ${r.status.toLowerCase()}">${r.status}</span></td>
          <td>${r.attendanceType}</td>
          <td>${r.checkIn}</td>
          <td>${r.checkOut}</td>
          <td>${r.hoursWorked}</td>
          <td>${r.checkinAddress}</td>
        </tr>
      `).join('');

      const htmlContent = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Laporan Absensi - ${filters.startDate} s/d ${filters.endDate}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 20px; background: #f5f7fa; color: #1a202c; }
    .container { max-width: 1200px; margin: 0 auto; background: white; padding: 30px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
    h1 { color: #3B82F6; margin-bottom: 10px; font-size: 24px; }
    .summary { background: linear-gradient(135deg, #3B82F6, #2563EB); color: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
    .summary p { margin: 5px 0; }
    table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 14px; }
    th { background: #3B82F6; color: white; padding: 12px 8px; text-align: left; font-weight: 600; }
    td { padding: 10px 8px; border-bottom: 1px solid #e2e8f0; }
    tr:nth-child(even) { background: #f8fafc; }
    tr:hover { background: #e0f2fe; }
    .badge { padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: 600; }
    .badge.wfo { background: #dbeafe; color: #1d4ed8; }
    .badge.wfh { background: #dcfce7; color: #16a34a; }
    .badge.dinas { background: #fed7aa; color: #c2410c; }
    footer { margin-top: 30px; text-align: center; color: #64748b; font-size: 12px; }
    @media print { body { background: white; } .container { box-shadow: none; } }
  </style>
</head>
<body>
  <div class="container">
    <h1>📊 Laporan Absensi Karyawan</h1>
    <div class="summary">
      <p><strong>Periode:</strong> ${filters.startDate} s/d ${filters.endDate}</p>
      <p><strong>Total Records:</strong> ${data.length}</p>
      <p><strong>Status:</strong> ${filters.status === 'all' ? 'Semua' : filters.status.toUpperCase()}</p>
    </div>
    <table>
      <thead>
        <tr>
          <th>No</th><th>Nama</th><th>Tanggal</th><th>Status</th><th>Jenis</th><th>Check In</th><th>Check Out</th><th>Jam Kerja</th><th>Lokasi</th>
        </tr>
      </thead>
      <tbody>${tableRows}</tbody>
    </table>
    <footer>
      <p>Diekspor pada: ${new Date().toLocaleString('id-ID')}</p>
      <p>IT Division 2025</p>
    </footer>
  </div>
</body>
</html>`;

      const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8;' });
      saveAs(blob, `Laporan-Absensi_${filters.startDate}_${filters.endDate}.html`);
      
      toast({ title: "Berhasil", description: `HTML berhasil diekspor! ${data.length} catatan.` });
    } catch (error) {
      console.error('HTML Export error:', error);
      toast({ title: "Gagal", description: "Gagal mengekspor HTML", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    switch (exportFormat) {
      case 'pdf': exportToPDF(); break;
      case 'csv': exportToCSV(); break;
      case 'html': exportToHTML(); break;
      default: exportToExcel();
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
                  {workAreas.filter(Boolean).map((area) => (
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

          {/* Export Format & Button */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <div className="flex items-center gap-2">
              <Label>Format:</Label>
              <Select value={exportFormat} onValueChange={(v) => setExportFormat(v as any)}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="excel">📊 Excel (.xlsx)</SelectItem>
                  <SelectItem value="pdf">📄 PDF (.pdf)</SelectItem>
                  <SelectItem value="csv">📋 CSV (.csv)</SelectItem>
                  <SelectItem value="html">🌐 HTML (.html)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button 
              onClick={handleExport}
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
                  Export Laporan
                </>
              )}
            </Button>
          </div>

          {/* Export Info */}
          <div className="text-center text-sm text-muted-foreground">
            <p>📊 Excel: Format lengkap dengan hyperlink foto dan koordinat</p>
            <p>📄 PDF: Format cetak dengan tabel rapi dan header</p>
            <p>📋 CSV: Format teks untuk import ke aplikasi lain</p>
            <p>🌐 HTML: Format web dengan styling modern</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default AttendanceExporter;