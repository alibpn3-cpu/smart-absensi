import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Download, FileSpreadsheet, Calendar, Filter, FileText, FileJson } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';
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
  employee_type?: string;
}

interface WorkAreaSchedule {
  work_area: string;
  employee_type: string;
  clock_in_time: string;
  clock_out_time: string;
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
  const [skipBlankDates, setSkipBlankDates] = useState(false);
  const [schedules, setSchedules] = useState<WorkAreaSchedule[]>([]);
  const [fetchProgress, setFetchProgress] = useState('');

  useEffect(() => {
    fetchEmployees();
    fetchSchedules();
    
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
      .select('uid, name, work_area, position, division, employee_type')
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

  const fetchSchedules = async () => {
    const { data } = await supabase
      .from('work_area_schedules')
      .select('*');
    setSchedules(data || []);
  };

  // Get timezone for work area (WIB = Asia/Jakarta, WITA = Asia/Makassar)
  const getTimezone = (workArea: string | undefined): string => {
    if (!workArea) return 'Asia/Jakarta';
    const upperArea = workArea.toUpperCase();
    // WIB (GMT+7) for Head Office Jakarta/Cikarang
    if (upperArea.includes('HEAD OFFICE') || upperArea.includes('CIKARANG') || upperArea.includes('JAKARTA')) {
      return 'Asia/Jakarta';
    }
    // WITA (GMT+8) for Kalimantan areas
    return 'Asia/Makassar';
  };

  // Get On Duty time based on work area and employee type
  const getOnDuty = (workArea: string | undefined, employeeType: string | undefined): string => {
    const upperArea = (workArea || '').toUpperCase();
    const empType = (employeeType || 'staff').toLowerCase();
    
    // Check if schedule exists in database first
    const schedule = schedules.find(s => 
      s.work_area.toUpperCase() === upperArea && 
      s.employee_type.toLowerCase() === empType
    );
    if (schedule) {
      return formatScheduleTime(schedule.clock_in_time);
    }
    
    // Fallback defaults
    if (upperArea.includes('HEAD OFFICE') || upperArea.includes('CIKARANG') || upperArea.includes('JAKARTA')) {
      return '08:30:00'; // WIB
    }
    if (upperArea.includes('BRANCH OFFICE') || upperArea.includes('BALIKPAPAN')) {
      return '08:00:00'; // WITA
    }
    if (upperArea.includes('HANDIL') || upperArea.includes('MUARA BADAK') || upperArea.includes('SITE')) {
      return empType === 'primary' ? '07:00:00' : '08:00:00'; // WITA
    }
    return '08:00:00';
  };

  // Get Off Duty time based on work area and employee type
  const getOffDuty = (workArea: string | undefined, employeeType: string | undefined): string => {
    const upperArea = (workArea || '').toUpperCase();
    const empType = (employeeType || 'staff').toLowerCase();
    
    // Check if schedule exists in database first
    const schedule = schedules.find(s => 
      s.work_area.toUpperCase() === upperArea && 
      s.employee_type.toLowerCase() === empType
    );
    if (schedule) {
      return formatScheduleTime(schedule.clock_out_time);
    }
    
    // Fallback defaults
    if (upperArea.includes('HEAD OFFICE') || upperArea.includes('CIKARANG') || upperArea.includes('JAKARTA')) {
      return '17:30:00'; // WIB
    }
    if (upperArea.includes('BRANCH OFFICE') || upperArea.includes('BALIKPAPAN')) {
      return '17:00:00'; // WITA
    }
    if (upperArea.includes('HANDIL') || upperArea.includes('MUARA BADAK') || upperArea.includes('SITE')) {
      return empType === 'primary' ? '18:00:00' : '16:00:00'; // WITA
    }
    return '17:00:00';
  };

  // Format schedule time to HH:mm:ss
  const formatScheduleTime = (time: string): string => {
    if (!time) return '-';
    // If already in HH:mm:ss format, return as is
    if (/^\d{2}:\d{2}:\d{2}$/.test(time)) return time;
    // If in HH:mm format, add :00
    if (/^\d{2}:\d{2}$/.test(time)) return `${time}:00`;
    return time;
  };

  // Get day name in Indonesian
  const getDayName = (dateStr: string): string => {
    const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const date = new Date(dateStr);
    return days[date.getDay()];
  };

  // Format time to HH:mm:ss only (no milliseconds, timezone-aware)
  const formatTimeHMS = (timeStr: string | null, workArea?: string): string => {
    if (!timeStr) return '-';
    try {
      // Parse the stored time string (format: "YYYY-MM-DD HH:mm:ss.sss+HH:mm")
      const normalized = timeStr.replace(' ', 'T');
      const date = new Date(normalized);
      
      if (isNaN(date.getTime())) {
        // Fallback: extract time portion directly (handle both : and . separators)
        const match = timeStr.match(/(\d{2}[:.]\d{2}[:.]\d{2})/);
        return match ? match[1].replace(/\./g, ':') : '-';
      }
      
      const timezone = getTimezone(workArea);
      const formatted = date.toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
        timeZone: timezone
      });
      
      // Indonesian locale uses dots (.) as separator, convert to colons (:)
      return formatted.replace(/\./g, ':');
    } catch {
      const match = timeStr.match(/(\d{2}[:.]\d{2}[:.]\d{2})/);
      return match ? match[1].replace(/\./g, ':') : '-';
    }
  };

  // Calculate late clock in (returns HH:mm:ss or '-')
  const calculateLateClockIn = (checkInTime: string | null, scheduledTime: string, workArea?: string): string => {
    if (!checkInTime || !scheduledTime || scheduledTime === '-') return '-';
    
    try {
      const checkInHMS = formatTimeHMS(checkInTime, workArea);
      if (checkInHMS === '-') return '-';
      
      const [ciH, ciM, ciS] = checkInHMS.split(':').map(Number);
      const [schH, schM, schS] = scheduledTime.split(':').map(Number);
      
      // Validate parsed numbers
      if (isNaN(ciH) || isNaN(ciM) || isNaN(schH) || isNaN(schM)) return '-';
      
      const checkInMinutes = ciH * 60 + ciM + (ciS || 0) / 60;
      const scheduledMinutes = schH * 60 + schM + (schS || 0) / 60;
      
      const lateMinutes = checkInMinutes - scheduledMinutes;
      
      if (lateMinutes <= 0) return '-'; // Not late
      
      const hours = Math.floor(lateMinutes / 60);
      const minutes = Math.floor(lateMinutes % 60);
      const seconds = Math.round((lateMinutes % 1) * 60);
      
      return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    } catch {
      return '-';
    }
  };

  // Calculate early clock out (returns HH:mm:ss or '-')
  const calculateEarlyClockOut = (checkOutTime: string | null, scheduledTime: string, workArea?: string): string => {
    if (!checkOutTime || !scheduledTime || scheduledTime === '-') return '-';
    
    try {
      const checkOutHMS = formatTimeHMS(checkOutTime, workArea);
      if (checkOutHMS === '-') return '-';
      
      const [coH, coM, coS] = checkOutHMS.split(':').map(Number);
      const [schH, schM, schS] = scheduledTime.split(':').map(Number);
      
      // Validate parsed numbers
      if (isNaN(coH) || isNaN(coM) || isNaN(schH) || isNaN(schM)) return '-';
      
      const checkOutMinutes = coH * 60 + coM + (coS || 0) / 60;
      const scheduledMinutes = schH * 60 + schM + (schS || 0) / 60;
      
      const earlyMinutes = scheduledMinutes - checkOutMinutes;
      
      if (earlyMinutes <= 0) return '-'; // Not early
      
      const hours = Math.floor(earlyMinutes / 60);
      const minutes = Math.floor(earlyMinutes % 60);
      const seconds = Math.round((earlyMinutes % 1) * 60);
      
      return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    } catch {
      return '-';
    }
  };

  // Format hours worked to HH:mm:ss
  const formatHoursHMS = (hoursWorked: number | null, checkIn: string | null, checkOut: string | null): string => {
    if (hoursWorked && typeof hoursWorked === 'number') {
      const hours = Math.floor(hoursWorked);
      const minutes = Math.floor((hoursWorked - hours) * 60);
      const seconds = Math.round(((hoursWorked - hours) * 60 - minutes) * 60);
      return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }
    
    if (!checkIn || !checkOut) return '-';
    
    try {
      const start = new Date(checkIn.replace(' ', 'T'));
      const end = new Date(checkOut.replace(' ', 'T'));
      
      if (isNaN(start.getTime()) || isNaN(end.getTime())) return '-';
      
      const diffMs = end.getTime() - start.getTime();
      const totalSeconds = Math.floor(diffMs / 1000);
      
      if (totalSeconds < 0) return '-';
      
      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = totalSeconds % 60;
      
      return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    } catch {
      return '-';
    }
  };

  // Generate all dates in a range
  const generateDateRange = (start: string, end: string): string[] => {
    const dates: string[] = [];
    const current = new Date(start);
    const endDate = new Date(end);
    
    while (current <= endDate) {
      dates.push(current.toISOString().split('T')[0]);
      current.setDate(current.getDate() + 1);
    }
    return dates;
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

    const BATCH_SIZE = 1000;
    let allData: any[] = [];
    let from = 0;
    let hasMore = true;

    // Get work area UIDs once if filtering by work area
    let workAreaUids: string[] = [];
    if (filters.workArea !== 'all') {
      workAreaUids = allEmployees
        .filter((s) => s.work_area === filters.workArea)
        .map((s) => s.uid);
      if (workAreaUids.length === 0) {
        setFetchProgress('');
        return [];
      }
    }

    setFetchProgress('Mengambil data...');

    while (hasMore) {
      let query = supabase
        .from('attendance_records')
        .select('*')
        .gte('date', filters.startDate)
        .lte('date', filters.endDate)
        .order('date', { ascending: true })
        .order('check_in_time', { ascending: true })
        .range(from, from + BATCH_SIZE - 1);

      // Apply status filter
      if (filters.status !== 'all') {
        query = query.eq('status', filters.status);
      }

      // Apply employee filter
      if (filters.employeeUid !== 'all') {
        query = query.eq('staff_uid', filters.employeeUid);
      }

      // Apply work area filter
      if (filters.workArea !== 'all' && workAreaUids.length > 0) {
        query = query.in('staff_uid', workAreaUids);
      }

      const { data, error } = await query;

      if (error) {
        toast({
          title: "Gagal",
          description: "Gagal memuat data absensi",
          variant: "destructive"
        });
        setFetchProgress('');
        return null;
      }

      if (data && data.length > 0) {
        allData = [...allData, ...data];
        from += BATCH_SIZE;
        setFetchProgress(`Mengambil data... (${allData.length} records)`);
        
        // If data count is less than batch size, we've reached the end
        if (data.length < BATCH_SIZE) {
          hasMore = false;
        }
      } else {
        hasMore = false;
      }
    }

    // Sort results descending (newest first) for display
    allData.sort((a, b) => {
      const dateCompare = b.date.localeCompare(a.date);
      if (dateCompare !== 0) return dateCompare;
      return (b.check_in_time || '').localeCompare(a.check_in_time || '');
    });

    setFetchProgress(`Total: ${allData.length} records`);
    return allData;
  };

  // Fetch attendance data with date range filling (for exports that show all dates)
  const fetchAttendanceDataWithDateRange = async () => {
    const attendanceData = await fetchAttendanceData();
    if (!attendanceData) return null;
    
    // If skipBlankDates is true, just return the raw data
    if (skipBlankDates) {
      return attendanceData;
    }
    
    // Generate all dates in range
    const allDates = generateDateRange(filters.startDate, filters.endDate);
    
    // Create attendance map for quick lookup
    const attendanceMap = new Map();
    attendanceData.forEach((record: any) => {
      const key = `${record.staff_uid}_${record.date}`;
      attendanceMap.set(key, record);
    });
    
    // Determine target UIDs
    let targetUids: string[];
    if (filters.employeeUid !== 'all') {
      targetUids = [filters.employeeUid];
    } else if (filters.workArea !== 'all') {
      targetUids = allEmployees
        .filter((s) => s.work_area === filters.workArea)
        .map((s) => s.uid);
    } else {
      // Get unique UIDs from attendance data
      targetUids = [...new Set(attendanceData.map((r: any) => r.staff_uid))];
    }
    
    // Generate data for all dates
    const result: any[] = [];
    for (const uid of targetUids) {
      const emp = allEmployees.find((e) => e.uid === uid);
      for (const date of allDates) {
        const record = attendanceMap.get(`${uid}_${date}`);
        if (record) {
          result.push(record);
        } else {
          // Create empty record for this date
          result.push({
            staff_uid: uid,
            staff_name: emp?.name || uid,
            date: date,
            status: null,
            checkout_status: null,
            attendance_type: null,
            check_in_time: null,
            check_out_time: null,
            hours_worked: null,
            checkin_location_address: null,
            checkin_location_lat: null,
            checkin_location_lng: null,
            checkout_location_address: null,
            checkout_location_lat: null,
            checkout_location_lng: null,
            selfie_checkin_url: null,
            selfie_checkout_url: null,
            selfie_photo_url: null,
            reason: null,
            _isEmpty: true // Flag to identify empty records
          });
        }
      }
    }
    
    // Sort by date descending, then by name
    result.sort((a, b) => {
      const dateCompare = b.date.localeCompare(a.date);
      if (dateCompare !== 0) return dateCompare;
      return (a.staff_name || '').localeCompare(b.staff_name || '');
    });
    
    return result;
  };

  const exportToExcel = async () => {
    setLoading(true);
    
    try {
      const attendanceData = await fetchAttendanceDataWithDateRange();
      
      if (!attendanceData || attendanceData.length === 0) {
        toast({
          title: "Tidak Ada Data",
          description: "Tidak ada catatan absensi untuk filter yang dipilih",
          variant: "destructive"
        });
        setLoading(false);
        return;
      }

      // Fetch P2H/Toolbox checklist data for all records
      const dates = [...new Set(attendanceData.map((r: any) => r.date))];
      const uids = [...new Set(attendanceData.map((r: any) => r.staff_uid))];
      
      const { data: checklistData } = await supabase
        .from('p2h_toolbox_checklist')
        .select('*')
        .in('checklist_date', dates)
        .in('staff_uid', uids);
      
      // Create lookup map for checklist data
      const checklistMap = new Map();
      checklistData?.forEach((c: any) => {
        checklistMap.set(`${c.staff_uid}_${c.checklist_date}`, c);
      });

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

      // Generate signed URLs for all photos
      const signedPhotoUrls = await Promise.all(
        attendanceData.map(async (record: any) => {
          const checkinUrl = record.selfie_checkin_url || record.selfie_photo_url;
          const checkoutUrl = record.selfie_checkout_url;
          const checklist = checklistMap.get(`${record.staff_uid}_${record.date}`);
          
          let checkinSigned = null;
          let checkoutSigned = null;
          let p2hSigned = null;
          let toolboxSigned = null;
          
          // Attendance photos from attendance-photos bucket
          if (checkinUrl) {
            try {
              const { data } = await supabase.storage
                .from('attendance-photos')
                .createSignedUrl(checkinUrl, 60 * 60 * 24 * 14);
              checkinSigned = data?.signedUrl || null;
            } catch (e) {
              console.error('Error generating check-in signed URL:', e);
            }
          }
          
          if (checkoutUrl) {
            try {
              const { data } = await supabase.storage
                .from('attendance-photos')
                .createSignedUrl(checkoutUrl, 60 * 60 * 24 * 14);
              checkoutSigned = data?.signedUrl || null;
            } catch (e) {
              console.error('Error generating check-out signed URL:', e);
            }
          }
          
          // P2H/Toolbox photos from p2h-photos bucket (public bucket - use getPublicUrl)
          if (checklist?.p2h_photo_url) {
            try {
              const { data } = supabase.storage
                .from('p2h-photos')
                .getPublicUrl(checklist.p2h_photo_url);
              p2hSigned = data?.publicUrl || null;
            } catch (e) {
              console.error('Error getting P2H photo URL:', e);
            }
          }
          
          if (checklist?.toolbox_photo_url) {
            try {
              const { data } = supabase.storage
                .from('p2h-photos')
                .getPublicUrl(checklist.toolbox_photo_url);
              toolboxSigned = data?.publicUrl || null;
            } catch (e) {
              console.error('Error getting Toolbox photo URL:', e);
            }
          }
          
          return { checkin: checkinSigned, checkout: checkoutSigned, p2h: p2hSigned, toolbox: toolboxSigned };
        })
      );

      // Create ExcelJS workbook
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Laporan Absensi');

      // Define columns
      worksheet.columns = [
        { header: 'No', key: 'no', width: 5 },
        { header: 'UID Karyawan', key: 'uid', width: 12 },
        { header: 'Nama Karyawan', key: 'nama', width: 20 },
        { header: 'Jabatan', key: 'jabatan', width: 15 },
        { header: 'Area Kerja', key: 'area', width: 15 },
        { header: 'Divisi', key: 'divisi', width: 12 },
        { header: 'Hari', key: 'hari', width: 10 },
        { header: 'Tanggal', key: 'tanggal', width: 12 },
        { header: 'Status Clock-In', key: 'statusIn', width: 12 },
        { header: 'Status Clock-Out', key: 'statusOut', width: 12 },
        { header: 'Jenis Absensi', key: 'jenisAbsensi', width: 12 },
        { header: 'On Duty', key: 'onDuty', width: 10 },
        { header: 'Off Duty', key: 'offDuty', width: 10 },
        { header: 'Waktu Clock In', key: 'clockIn', width: 10 },
        { header: 'Waktu Clock Out', key: 'clockOut', width: 10 },
        { header: 'Late Clock In', key: 'lateIn', width: 12 },
        { header: 'Early Clock Out', key: 'earlyOut', width: 12 },
        { header: 'Total Jam Kerja', key: 'totalJam', width: 12 },
        { header: 'Geofence Clock-In', key: 'geofenceIn', width: 20 },
        { header: 'Alamat Clock-In', key: 'alamatIn', width: 35 },
        { header: 'Koordinat Clock-In', key: 'koordinatIn', width: 20 },
        { header: 'Geofence Clock-Out', key: 'geofenceOut', width: 20 },
        { header: 'Alamat Clock-Out', key: 'alamatOut', width: 35 },
        { header: 'Koordinat Clock-Out', key: 'koordinatOut', width: 20 },
        { header: 'Foto Clock-In', key: 'fotoIn', width: 12 },
        { header: 'Foto Clock-Out', key: 'fotoOut', width: 12 },
        { header: 'P2H', key: 'p2h', width: 8 },
        { header: 'Foto P2H', key: 'fotoP2h', width: 12 },
        { header: 'Toolbox', key: 'toolbox', width: 8 },
        { header: 'Foto Toolbox', key: 'fotoToolbox', width: 12 },
        { header: 'Alasan Clock In', key: 'alasanIn', width: 25 },
        { header: 'Alasan Clock Out', key: 'alasanOut', width: 25 },
        { header: 'Alasan Extend In', key: 'alasanExtendIn', width: 25 },
        { header: 'Alasan Extend Out', key: 'alasanExtendOut', width: 25 }
      ];

      // Add data rows
      attendanceData.forEach((record: any, index: number) => {
        const checkinGeofenceName = record.checkin_location_lat && record.checkin_location_lng
          ? findGeofenceName(Number(record.checkin_location_lat), Number(record.checkin_location_lng))
          : null;
        
        const checkoutGeofenceName = record.checkout_location_lat && record.checkout_location_lng
          ? findGeofenceName(Number(record.checkout_location_lat), Number(record.checkout_location_lng))
          : null;
        
        const checkoutLat = record.checkout_location_lat ?? (record.check_out_time ? record.checkin_location_lat : null);
        const checkoutLng = record.checkout_location_lng ?? (record.check_out_time ? record.checkin_location_lng : null);
        const checkoutAddress = checkoutGeofenceName || record.checkout_location_address || (record.check_out_time ? record.checkin_location_address : null);
          
        const emp = allEmployees.find((s: any) => s.uid === record.staff_uid);
        const checklist = checklistMap.get(`${record.staff_uid}_${record.date}`);
        const photoUrls = signedPhotoUrls[index];
        
        const onDuty = getOnDuty(emp?.work_area, emp?.employee_type);
        const offDuty = getOffDuty(emp?.work_area, emp?.employee_type);
        
        const row = worksheet.addRow({
          no: index + 1,
          uid: record.staff_uid,
          nama: record.staff_name,
          jabatan: emp?.position || '-',
          area: emp?.work_area || '-',
          divisi: emp?.division || '-',
          hari: getDayName(record.date),
          tanggal: new Date(record.date).toLocaleDateString('id-ID'),
          statusIn: record.status?.toUpperCase() || '-',
          statusOut: record.checkout_status?.toUpperCase() || record.status?.toUpperCase() || '-',
          jenisAbsensi: record.attendance_type === 'overtime' ? 'LEMBUR' : 'REGULAR',
          onDuty: onDuty,
          offDuty: offDuty,
          clockIn: formatTimeHMS(record.check_in_time, emp?.work_area),
          clockOut: formatTimeHMS(record.check_out_time, emp?.work_area),
          lateIn: calculateLateClockIn(record.check_in_time, onDuty, emp?.work_area),
          earlyOut: calculateEarlyClockOut(record.check_out_time, offDuty, emp?.work_area),
          totalJam: formatHoursHMS(record.hours_worked, record.check_in_time, record.check_out_time),
          geofenceIn: checkinGeofenceName || '-',
          alamatIn: record.checkin_location_address || '-',
          koordinatIn: record.checkin_location_lat && record.checkin_location_lng 
            ? `${record.checkin_location_lat}, ${record.checkin_location_lng}` 
            : '-',
          geofenceOut: checkoutGeofenceName || '-',
          alamatOut: checkoutAddress || '-',
          koordinatOut: checkoutLat && checkoutLng 
            ? `${checkoutLat}, ${checkoutLng}` 
            : '-',
          fotoIn: photoUrls?.checkin ? 'Lihat Foto' : '-',
          fotoOut: photoUrls?.checkout ? 'Lihat Foto' : '-',
          p2h: checklist?.p2h_checked ? 'Ya' : 'Tidak',
          fotoP2h: photoUrls?.p2h ? 'Lihat Foto' : '-',
          toolbox: checklist?.toolbox_checked ? 'Ya' : 'Tidak',
          fotoToolbox: photoUrls?.toolbox ? 'Lihat Foto' : '-',
          alasanIn: record.checkin_reason || record.reason || '-',
          alasanOut: record.checkout_reason || '-',
          alasanExtendIn: record.extend_reason || '-',
          alasanExtendOut: record.extend_reason || '-'
        });

        // Add hyperlinks for coordinates
        if (record.checkin_location_lat && record.checkin_location_lng) {
          const cell = row.getCell('koordinatIn');
          const mapsUrl = `https://www.google.com/maps?q=${record.checkin_location_lat},${record.checkin_location_lng}`;
          cell.value = { 
            text: `${record.checkin_location_lat}, ${record.checkin_location_lng}`, 
            hyperlink: mapsUrl 
          };
          cell.font = { color: { argb: 'FF0000FF' }, underline: true };
        }

        if (checkoutLat && checkoutLng) {
          const cell = row.getCell('koordinatOut');
          const mapsUrl = `https://www.google.com/maps?q=${checkoutLat},${checkoutLng}`;
          cell.value = { text: `${checkoutLat}, ${checkoutLng}`, hyperlink: mapsUrl };
          cell.font = { color: { argb: 'FF0000FF' }, underline: true };
        }

        // Add hyperlinks for photos
        if (photoUrls?.checkin) {
          const cell = row.getCell('fotoIn');
          cell.value = { text: 'Lihat Foto', hyperlink: photoUrls.checkin };
          cell.font = { color: { argb: 'FF0000FF' }, underline: true };
        }
        if (photoUrls?.checkout) {
          const cell = row.getCell('fotoOut');
          cell.value = { text: 'Lihat Foto', hyperlink: photoUrls.checkout };
          cell.font = { color: { argb: 'FF0000FF' }, underline: true };
        }
        if (photoUrls?.p2h) {
          const cell = row.getCell('fotoP2h');
          cell.value = { text: 'Lihat Foto', hyperlink: photoUrls.p2h };
          cell.font = { color: { argb: 'FF0000FF' }, underline: true };
        }
        if (photoUrls?.toolbox) {
          const cell = row.getCell('fotoToolbox');
          cell.value = { text: 'Lihat Foto', hyperlink: photoUrls.toolbox };
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
      const lastColumn = String.fromCharCode(65 + worksheet.columns.length - 1);
      worksheet.autoFilter = {
        from: 'A1',
        to: `${lastColumn}${attendanceData.length + 1}`
      };

      // Generate filename
      const startDate = new Date(filters.startDate).toLocaleDateString('id-ID').replace(/\//g, '-');
      const endDate = new Date(filters.endDate).toLocaleDateString('id-ID').replace(/\//g, '-');
      const statusText = filters.status === 'all' ? 'Semua' : filters.status.toUpperCase();
      const employeeText = filters.employeeUid === 'all' ? 'Semua-Karyawan' : filters.employeeUid;
      const workAreaText = filters.workArea === 'all' ? 'Semua-Area' : filters.workArea;
      
      const filename = `Laporan-Absensi_${startDate}_${endDate}_${statusText}_${workAreaText}_${employeeText}.xlsx`;

      // Save file
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
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
    const attendanceData = await fetchAttendanceDataWithDateRange();
    if (!attendanceData || attendanceData.length === 0) {
      toast({
        title: "Tidak Ada Data",
        description: "Tidak ada catatan absensi untuk filter yang dipilih",
        variant: "destructive"
      });
      return null;
    }
    
    // Fetch P2H/Toolbox checklist data
    const dates = [...new Set(attendanceData.map((r: any) => r.date))];
    const uids = [...new Set(attendanceData.map((r: any) => r.staff_uid))];
    
    const { data: checklistData } = await supabase
      .from('p2h_toolbox_checklist')
      .select('*')
      .in('checklist_date', dates)
      .in('staff_uid', uids);
    
    const checklistMap = new Map();
    checklistData?.forEach((c: any) => {
      checklistMap.set(`${c.staff_uid}_${c.checklist_date}`, c);
    });
    
    return attendanceData.map((record: any, index: number) => {
      const emp = allEmployees.find((s: any) => s.uid === record.staff_uid);
      const checklist = checklistMap.get(`${record.staff_uid}_${record.date}`);
      const isEmpty = record._isEmpty === true;
      
      const onDuty = getOnDuty(emp?.work_area, emp?.employee_type);
      const offDuty = getOffDuty(emp?.work_area, emp?.employee_type);
      
      return {
        no: index + 1,
        uid: record.staff_uid,
        name: record.staff_name || emp?.name || '-',
        position: emp?.position || '-',
        workArea: emp?.work_area || '-',
        division: emp?.division || '-',
        day: getDayName(record.date),
        date: new Date(record.date).toLocaleDateString('id-ID'),
        statusIn: isEmpty ? '-' : (record.status?.toUpperCase() || '-'),
        statusOut: isEmpty ? '-' : (record.checkout_status?.toUpperCase() || record.status?.toUpperCase() || '-'),
        attendanceType: isEmpty ? '-' : (record.attendance_type === 'overtime' ? 'LEMBUR' : 'REGULAR'),
        onDuty: onDuty,
        offDuty: offDuty,
        checkIn: isEmpty ? '-' : formatTimeHMS(record.check_in_time, emp?.work_area),
        checkOut: isEmpty ? '-' : formatTimeHMS(record.check_out_time, emp?.work_area),
        lateClockIn: isEmpty ? '-' : calculateLateClockIn(record.check_in_time, onDuty, emp?.work_area),
        earlyClockOut: isEmpty ? '-' : calculateEarlyClockOut(record.check_out_time, offDuty, emp?.work_area),
        hoursWorked: isEmpty ? '-' : formatHoursHMS(record.hours_worked, record.check_in_time, record.check_out_time),
        checkinAddress: isEmpty ? '-' : (record.checkin_location_address || '-'),
        checkoutAddress: isEmpty ? '-' : (record.checkout_location_address || '-'),
        p2h: checklist?.p2h_checked ? 'Ya' : 'Tidak',
        toolbox: checklist?.toolbox_checked ? 'Ya' : 'Tidak',
        checkinReason: isEmpty ? '-' : (record.checkin_reason || record.reason || '-'),
        checkoutReason: isEmpty ? '-' : (record.checkout_reason || '-'),
        extendInReason: isEmpty ? '-' : (record.extend_reason || '-'),
        extendOutReason: isEmpty ? '-' : (record.extend_reason || '-')
      };
    });
  };

  const exportToPDF = async () => {
    setLoading(true);
    try {
      const data = await getExportData();
      if (!data) { setLoading(false); return; }

      const doc = new jsPDF('landscape', 'mm', 'a4');
      
      // Header - Bold
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(59, 130, 246);
      doc.text('Laporan Absensi Karyawan', 14, 15);
      
      // Info periode
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100);
      doc.text(`Periode: ${filters.startDate} s/d ${filters.endDate}`, 14, 22);
      doc.text(`Total Records: ${data.length}`, 14, 27);
      
      // Table with new columns
      autoTable(doc, {
        head: [['No', 'Nama', 'Hari', 'Tanggal', 'Status In', 'Jenis', 'On Duty', 'Clock In', 'Late', 'Off Duty', 'Clock Out', 'Early', 'Jam Kerja']],
        body: data.map((r) => [
          r.no, r.name, r.day, r.date, r.statusIn, r.attendanceType, r.onDuty, r.checkIn, r.lateClockIn, r.offDuty, r.checkOut, r.earlyClockOut, r.hoursWorked
        ]),
        startY: 32,
        styles: { fontSize: 7, cellPadding: 1.5 },
        headStyles: { fillColor: [59, 130, 246], textColor: 255, fontStyle: 'bold' },
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
      const headers = ['No', 'UID', 'Nama', 'Jabatan', 'Area Kerja', 'Divisi', 'Hari', 'Tanggal', 'Status In', 'Status Out', 'Jenis Absensi', 'On Duty', 'Off Duty', 'Clock In', 'Clock Out', 'Late Clock In', 'Early Clock Out', 'Jam Kerja', 'Lokasi Clock In', 'Lokasi Clock Out', 'P2H', 'Toolbox', 'Alasan Clock In', 'Alasan Clock Out', 'Alasan Extend In', 'Alasan Extend Out'];
      const rows = data.map((r) => [
        r.no, r.uid, r.name, r.position, r.workArea, r.division, r.day, r.date, r.statusIn, r.statusOut, r.attendanceType, r.onDuty, r.offDuty, r.checkIn, r.checkOut, r.lateClockIn, r.earlyClockOut, r.hoursWorked, r.checkinAddress, r.checkoutAddress, r.p2h, r.toolbox, r.checkinReason, r.checkoutReason, r.extendInReason, r.extendOutReason
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
          <td>${r.day}</td>
          <td>${r.date}</td>
          <td><span class="badge ${r.statusIn.toLowerCase()}">${r.statusIn}</span></td>
          <td>${r.attendanceType}</td>
          <td>${r.onDuty}</td>
          <td>${r.checkIn}</td>
          <td class="${r.lateClockIn !== '-' ? 'late' : ''}">${r.lateClockIn}</td>
          <td>${r.offDuty}</td>
          <td>${r.checkOut}</td>
          <td class="${r.earlyClockOut !== '-' ? 'early' : ''}">${r.earlyClockOut}</td>
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
    .container { max-width: 1400px; margin: 0 auto; background: white; padding: 30px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
    h1 { color: #3B82F6; margin-bottom: 10px; font-size: 24px; font-weight: bold; }
    .summary { background: linear-gradient(135deg, #3B82F6, #2563EB); color: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
    .summary p { margin: 5px 0; }
    table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 13px; }
    th { background: #3B82F6; color: white; padding: 12px 8px; text-align: left; font-weight: bold; }
    td { padding: 10px 8px; border-bottom: 1px solid #e2e8f0; }
    tr:nth-child(even) { background: #f8fafc; }
    tr:hover { background: #e0f2fe; }
    .badge { padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: 600; }
    .badge.wfo { background: #dbeafe; color: #1d4ed8; }
    .badge.wfh { background: #dcfce7; color: #16a34a; }
    .badge.dinas { background: #fed7aa; color: #c2410c; }
    .late { color: #dc2626; font-weight: 500; }
    .early { color: #f59e0b; font-weight: 500; }
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
          <th>No</th><th>Nama</th><th>Hari</th><th>Tanggal</th><th>Status</th><th>Jenis</th><th>On Duty</th><th>Clock In</th><th>Late</th><th>Off Duty</th><th>Clock Out</th><th>Early</th><th>Jam Kerja</th><th>Lokasi</th>
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
            
            {/* Skip Blank Dates Checkbox */}
            <div className="flex items-center space-x-2 mt-3 pt-3 border-t border-muted">
              <Checkbox
                id="skipBlankDates"
                checked={skipBlankDates}
                onCheckedChange={(checked) => setSkipBlankDates(checked === true)}
              />
              <Label htmlFor="skipBlankDates" className="text-sm cursor-pointer">
                Skip tanggal tanpa data presensi
              </Label>
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
            {fetchProgress && (
              <span className="text-sm text-muted-foreground">{fetchProgress}</span>
            )}
          </div>

          {/* Export Info */}
          <div className="text-center text-sm text-muted-foreground">
            <p>📊 Excel: Format lengkap dengan hyperlink foto dan koordinat</p>
            <p>📄 PDF: Format cetak dengan tabel rapi dan header bold</p>
            <p>📋 CSV: Format teks untuk import ke aplikasi lain</p>
            <p>🌐 HTML: Format web dengan styling modern</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default AttendanceExporter;
