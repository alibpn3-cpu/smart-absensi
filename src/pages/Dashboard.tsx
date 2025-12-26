import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Users, 
  Calendar, 
  MapPin, 
  LogOut, 
  Clock,
  TrendingUp,
  Filter,
  Eye,
  UserPlus,
  Settings,
  FileSpreadsheet,
  Cake,
  ImageIcon,
  History
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
// GeofenceManager removed - using only PolygonGeofenceManager now
const PolygonGeofenceManager = React.lazy(() => import('../components/PolygonGeofenceManager'));
import EmployeeManager from '../components/EmployeeManager';
import AdminManager from '../components/AdminManager';
import AttendanceExporter from '../components/AttendanceExporter';
import AppSettings from '../components/AppSettings';
import BirthdayImporter from '../components/BirthdayImporter';
const AdManager = React.lazy(() => import('../components/AdManager'));
const KioskModeSettings = React.lazy(() => import('../components/KioskModeSettings'));
import ActivityLogViewer from '../components/ActivityLogViewer';
import NotCheckedInList from '../components/NotCheckedInList';
const DashboardAnalytics = React.lazy(() => import('../components/DashboardAnalytics'));
const ScoreReport = React.lazy(() => import('../components/ScoreReport'));
const RankingOverrideManager = React.lazy(() => import('../components/RankingOverrideManager'));
import { PieChart as RePieChart, Pie, Cell } from 'recharts';

interface AttendanceRecord {
  id: string;
  staff_uid: string;
  staff_name: string;
  check_in_time: string | null;
  check_out_time: string | null;
  checkin_location_address: string | null;
  checkin_location_lat: number | null;
  checkin_location_lng: number | null;
  checkout_location_address: string | null;
  checkout_location_lat: number | null;
  checkout_location_lng: number | null;
  status: 'wfo' | 'wfh' | 'dinas';
  reason: string | null;
  date: string;
  selfie_photo_url: string | null;
}

interface AttendanceSummary {
  totalStaff: number;
  presentToday: number;
  wfoCount: number;
  wfhCount: number;
  dinasCount: number;
}

const Dashboard = () => {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [filteredRecords, setFilteredRecords] = useState<AttendanceRecord[]>([]);
  const [summary, setSummary] = useState<AttendanceSummary>({
    totalStaff: 0,
    presentToday: 0,
    wfoCount: 0,
    wfhCount: 0,
    dinasCount: 0
  });
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  
  // Filter states
  const [filterName, setFilterName] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterLocation, setFilterLocation] = useState<string>('all');
  const [locations, setLocations] = useState<string[]>([]);
  
  const [loading, setLoading] = useState(true);
  
  // Check if user is superadmin (from admin_accounts) or staff admin
  const isSuperAdmin = !!localStorage.getItem('adminSession');
  const userSessionData = localStorage.getItem('userSession');
  const isStaffAdmin = userSessionData ? JSON.parse(userSessionData).is_admin : false;

  // Apply filters to attendance records
  useEffect(() => {
    let filtered = [...attendanceRecords];
    
    // Filter by name
    if (filterName.trim()) {
      const searchTerm = filterName.toLowerCase();
      filtered = filtered.filter(r => 
        r.staff_name.toLowerCase().includes(searchTerm) ||
        r.staff_uid.toLowerCase().includes(searchTerm)
      );
    }
    
    // Filter by status
    if (filterStatus !== 'all') {
      filtered = filtered.filter(r => r.status === filterStatus);
    }
    
    // Filter by location
    if (filterLocation !== 'all') {
      filtered = filtered.filter(r => 
        r.checkin_location_address?.includes(filterLocation) ||
        r.checkout_location_address?.includes(filterLocation)
      );
    }
    
    setFilteredRecords(filtered);
    setCurrentPage(1); // Reset to first page when filters change
  }, [attendanceRecords, filterName, filterStatus, filterLocation]);

  // Calculate pagination based on filtered records
  const totalPages = Math.ceil(filteredRecords.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentRecords = filteredRecords.slice(startIndex, endIndex);

  useEffect(() => {
    fetchDashboardData();
  }, [selectedDate]);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      // Fetch attendance records for selected date
      const { data: attendance, error: attendanceError } = await supabase
        .from('attendance_records')
        .select('*')
        .eq('date', selectedDate)
        .order('check_in_time', { ascending: false });

      if (attendanceError) throw attendanceError;

      // Fetch total staff count
      const { data: staffData, error: staffError } = await supabase
        .from('staff_users')
        .select('*')
        .eq('is_active', true);

      if (staffError) throw staffError;

      // Fetch geofence areas for location filter
      const { data: geofences } = await supabase
        .from('geofence_areas')
        .select('name')
        .eq('is_active', true);

      if (geofences) {
        setLocations(geofences.map(g => g.name));
      }

      setAttendanceRecords((attendance || []) as AttendanceRecord[]);
      setFilteredRecords((attendance || []) as AttendanceRecord[]);
      
      // Calculate summary
      const presentToday = attendance?.length || 0;
      const wfoCount = attendance?.filter(r => r.status === 'wfo').length || 0;
      const wfhCount = attendance?.filter(r => r.status === 'wfh').length || 0;
      const dinasCount = attendance?.filter(r => r.status === 'dinas').length || 0;

      setSummary({
        totalStaff: staffData?.length || 0,
        presentToday,
        wfoCount,
        wfhCount,
        dinasCount
      });
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      toast({
        title: "Gagal",
        description: "Gagal memuat data dashboard",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const attendancePie = React.useMemo(() => ([
    { name: 'Hadir', value: summary.presentToday },
    { name: 'Tidak Hadir', value: Math.max(summary.totalStaff - summary.presentToday, 0) }
  ]), [summary.presentToday, summary.totalStaff]);

  const handleLogout = async () => {
    try {
      signOut(); // No need for await since it just clears localStorage and navigates
      toast({
        title: "Berhasil",
        description: "Berhasil logout"
      });
    } catch (error) {
      console.error('Logout error:', error);
      toast({
        title: "Gagal",
        description: "Gagal logout",
        variant: "destructive"
      });
    }
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      wfo: "default",
      wfh: "secondary", 
      dinas: "outline"
    } as const;
    
    const labels = {
      wfo: "WFO",
      wfh: "WFH",
      dinas: "Dinas"
    };
    
    return (
      <Badge variant={variants[status as keyof typeof variants]}>
        {labels[status as keyof typeof labels]}
      </Badge>
    );
  };

  const viewPhoto = async (photoUrl: string) => {
    if (!photoUrl) return;
    
    try {
      const { data } = await supabase.storage
        .from('attendance-photos')
        .createSignedUrl(photoUrl, 3600); // 1 hour expiry
      
      if (data?.signedUrl) {
        window.open(data.signedUrl, '_blank');
      }
    } catch (error) {
      toast({
        title: "Gagal",
        description: "Gagal memuat foto",
        variant: "destructive"
      });
    }
  };

  return (
    <div className="min-h-screen bg-background p-2 sm:p-4">
      <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div className="flex-1">
            <h1 className="text-2xl sm:text-3xl font-bold text-title-primary">Admin Dashboard</h1>
            <p className="text-muted-foreground">Petrolog Digital Absensi Management</p>
          </div>
          <Button 
            variant="outline" 
            onClick={handleLogout} 
            className="bg-blue-500/20 border-blue-500/30 text-blue-600 hover:bg-blue-500/30 ml-2"
          >
            <LogOut className="h-4 w-4 mr-1" />
            Logout
          </Button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
          <Card className="bg-card border-border">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium text-foreground">Total Staff</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-xl sm:text-2xl font-bold text-foreground">{summary.totalStaff}</div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium text-foreground">Hadir Hari Ini</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="flex items-center justify-between">
              <div>
                <div className="text-xl sm:text-2xl font-bold text-foreground">{summary.presentToday}</div>
                <p className="text-xs text-muted-foreground">
                  {summary.totalStaff > 0 
                    ? `${Math.round((summary.presentToday / summary.totalStaff) * 100)}% kehadiran`
                    : '0% kehadiran'
                  }
                </p>
              </div>
              <div className="w-10 h-10">
                <RePieChart width={40} height={40}>
                  <Pie data={attendancePie} dataKey="value" innerRadius={14} outerRadius={20}>
                    <Cell fill="hsl(var(--primary))" />
                    <Cell fill="hsl(var(--destructive))" />
                  </Pie>
                </RePieChart>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium text-foreground">WFO</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="flex items-center justify-between">
              <div className="text-xl sm:text-2xl font-bold text-foreground">{summary.wfoCount}</div>
              <div className="w-10 h-10">
                <RePieChart width={40} height={40}>
                  <Pie data={[
                    { name: 'WFO', value: summary.wfoCount },
                    { name: 'Lainnya', value: Math.max(summary.presentToday - summary.wfoCount, 0) },
                  ]} dataKey="value" innerRadius={14} outerRadius={20}>
                    <Cell fill="hsl(var(--primary))" />
                    <Cell fill="hsl(var(--destructive))" />
                  </Pie>
                </RePieChart>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium text-foreground">WFH</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="flex items-center justify-between">
              <div className="text-xl sm:text-2xl font-bold text-foreground">{summary.wfhCount}</div>
              <div className="w-10 h-10">
                <RePieChart width={40} height={40}>
                  <Pie data={[
                    { name: 'WFH', value: summary.wfhCount },
                    { name: 'Lainnya', value: Math.max(summary.presentToday - summary.wfhCount, 0) },
                  ]} dataKey="value" innerRadius={14} outerRadius={20}>
                    <Cell fill="hsl(var(--primary))" />
                    <Cell fill="hsl(var(--destructive))" />
                  </Pie>
                </RePieChart>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium text-foreground">Dinas</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="flex items-center justify-between">
              <div className="text-xl sm:text-2xl font-bold text-foreground">{summary.dinasCount}</div>
              <div className="w-10 h-10">
                <RePieChart width={40} height={40}>
                  <Pie data={[
                    { name: 'Dinas', value: summary.dinasCount },
                    { name: 'Lainnya', value: Math.max(summary.presentToday - summary.dinasCount, 0) },
                  ]} dataKey="value" innerRadius={14} outerRadius={20}>
                    <Cell fill="hsl(var(--primary))" />
                    <Cell fill="hsl(var(--destructive))" />
                  </Pie>
                </RePieChart>
              </div>
            </CardContent>
          </Card>
        </div>


        {/* Main Content Tabs */}
        <Tabs defaultValue="attendance" className="space-y-4 sm:space-y-6">
          <TabsList className={`grid w-full gap-1 bg-muted h-auto p-1 ${isSuperAdmin ? 'grid-cols-3 sm:grid-cols-13' : 'grid-cols-3 sm:grid-cols-10'}`}>
            <TabsTrigger value="attendance" className="text-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground flex-1 py-2 text-xs sm:text-sm">
              <span className="hidden sm:inline">Attendance</span>
              <span className="sm:hidden">Absen</span>
            </TabsTrigger>
            <TabsTrigger value="notcheckedin" className="text-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground flex-1 py-2 text-xs sm:text-sm">
              <Users className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-2" />
              <span className="hidden sm:inline">In/Out Status</span>
              <span className="sm:hidden">I/O</span>
            </TabsTrigger>
            <TabsTrigger value="analytics" className="text-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground flex-1 py-2 text-xs sm:text-sm">
              <TrendingUp className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-2" />
              <span className="hidden sm:inline">Analytics</span>
              <span className="sm:hidden">Stats</span>
            </TabsTrigger>
            <TabsTrigger value="employees" className="text-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground flex-1 py-2 text-xs sm:text-sm">
              <UserPlus className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-2" />
              <span className="hidden sm:inline">Employees</span>
              <span className="sm:hidden">Staff</span>
            </TabsTrigger>
            <TabsTrigger value="birthdays" className="text-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground flex-1 py-2 text-xs sm:text-sm">
              <Cake className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-2" />
              <span className="hidden sm:inline">Birthdays</span>
              <span className="sm:hidden">Ultah</span>
            </TabsTrigger>
            {/* Superadmin only tabs */}
            {isSuperAdmin && (
              <>
                <TabsTrigger value="admins" className="text-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground flex-1 py-2 text-xs sm:text-sm">
                  <Settings className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Admins</span>
                  <span className="sm:hidden">Admin</span>
                </TabsTrigger>
                <TabsTrigger value="logs" className="text-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground flex-1 py-2 text-xs sm:text-sm">
                  <History className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Activity Logs</span>
                  <span className="sm:hidden">Log</span>
                </TabsTrigger>
              </>
            )}
            <TabsTrigger value="scores" className="text-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground flex-1 py-2 text-xs sm:text-sm">
              <TrendingUp className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-2" />
              <span className="hidden sm:inline">Scores</span>
              <span className="sm:hidden">Score</span>
            </TabsTrigger>
            <TabsTrigger value="export" className="text-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground flex-1 py-2 text-xs sm:text-sm">
              <FileSpreadsheet className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-2" />
              <span className="hidden sm:inline">Export</span>
              <span className="sm:hidden">Data</span>
            </TabsTrigger>
            <TabsTrigger value="geofence" className="text-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground flex-1 py-2 text-xs sm:text-sm">
              <MapPin className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-2" />
              <span className="hidden sm:inline">Geofence</span>
              <span className="sm:hidden">Lokasi</span>
            </TabsTrigger>
            {/* Kiosk - accessible to all admins */}
            <TabsTrigger value="kiosk" className="text-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground flex-1 py-2 text-xs sm:text-sm">
              <Settings className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-2" />
              <span className="hidden sm:inline">Kiosk</span>
              <span className="sm:hidden">Kiosk</span>
            </TabsTrigger>
            {/* Ads - accessible to all admins */}
            <TabsTrigger value="ads" className="text-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground flex-1 py-2 text-xs sm:text-sm">
              <ImageIcon className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-2" />
              <span className="hidden sm:inline">Ads</span>
              <span className="sm:hidden">Iklan</span>
            </TabsTrigger>
            {/* Settings - superadmin only */}
            {isSuperAdmin && (
              <TabsTrigger value="settings" className="text-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground flex-1 py-2 text-xs sm:text-sm">
                <Settings className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-2" />
                <span className="hidden sm:inline">Settings</span>
                <span className="sm:hidden">Config</span>
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="attendance" className="space-y-4 sm:space-y-6">
            {/* Filters */}
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-title-primary">
                  <Filter className="h-5 w-5" />
                  Filter Attendance Records
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                  {/* Date Filter */}
                  <div className="space-y-2">
                    <Label htmlFor="date" className="text-foreground">Tanggal</Label>
                    <Input
                      id="date"
                      type="date"
                      value={selectedDate}
                      onChange={(e) => setSelectedDate(e.target.value)}
                      className="bg-background border-border text-foreground"
                    />
                  </div>
                  
                  {/* Name Search */}
                  <div className="space-y-2">
                    <Label htmlFor="filterName" className="text-foreground">Cari Nama/UID</Label>
                    <Input
                      id="filterName"
                      type="text"
                      placeholder="Ketik nama atau UID..."
                      value={filterName}
                      onChange={(e) => setFilterName(e.target.value)}
                      className="bg-background border-border text-foreground"
                    />
                  </div>
                  
                  {/* Status Filter */}
                  <div className="space-y-2">
                    <Label htmlFor="filterStatus" className="text-foreground">Status</Label>
                    <Select value={filterStatus} onValueChange={setFilterStatus}>
                      <SelectTrigger className="bg-background border-border text-foreground">
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
                  
                  {/* Location Filter */}
                  <div className="space-y-2">
                    <Label htmlFor="filterLocation" className="text-foreground">Lokasi</Label>
                    <Select value={filterLocation} onValueChange={setFilterLocation}>
                      <SelectTrigger className="bg-background border-border text-foreground">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Semua Lokasi</SelectItem>
                        {locations.map((loc) => (
                          <SelectItem key={loc} value={loc}>{loc}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  {/* Refresh Button */}
                  <div className="space-y-2">
                    <Label className="text-transparent">Action</Label>
                    <Button 
                      onClick={fetchDashboardData} 
                      disabled={loading}
                      className="bg-primary text-primary-foreground hover:bg-primary/90 w-full"
                    >
                      <Calendar className="h-4 w-4 mr-2" />
                      Refresh
                    </Button>
                  </div>
                </div>
                
                {/* Active filters indicator */}
                {(filterName || filterStatus !== 'all' || filterLocation !== 'all') && (
                  <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
                    <span>Filter aktif:</span>
                    {filterName && <Badge variant="secondary">Nama: {filterName}</Badge>}
                    {filterStatus !== 'all' && <Badge variant="secondary">Status: {filterStatus.toUpperCase()}</Badge>}
                    {filterLocation !== 'all' && <Badge variant="secondary">Lokasi: {filterLocation}</Badge>}
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => {
                        setFilterName('');
                        setFilterStatus('all');
                        setFilterLocation('all');
                      }}
                      className="text-xs h-6"
                    >
                      Reset Filter
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Attendance Records */}
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="text-title-primary">
                  Attendance Records - {new Date(selectedDate).toLocaleDateString('id-ID')}
                  <span className="text-sm font-normal text-muted-foreground ml-2">
                    ({filteredRecords.length} dari {attendanceRecords.length} records)
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="text-center py-8 text-foreground">Loading...</div>
                ) : filteredRecords.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No attendance records found for selected date
                  </div>
                ) : (
                  <>
                    <div className="space-y-2">
                      {currentRecords.map((record) => (
                        <div
                          key={record.id}
                          className="border border-border rounded-lg p-2 space-y-1.5 bg-muted/30"
                        >
                          <div className="flex justify-between items-start">
                            <div>
                              <h3 className="font-semibold text-sm text-foreground">{record.staff_name}</h3>
                              <p className="text-xs text-muted-foreground">ID: {record.staff_uid}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              {getStatusBadge(record.status)}
                              {(record as any).attendance_type === 'overtime' && (
                                <Badge variant="secondary" className="bg-orange-500 text-white text-xs">
                                  ⏰ Lembur
                                </Badge>
                              )}
                            </div>
                          </div>
                          
                          {(record as any).hours_worked && (
                            <div className="text-xs text-muted-foreground mt-1">
                              <span className="font-semibold">Total Jam:</span> {(record as any).hours_worked} jam
                            </div>
                          )}

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                            <div>
                              <p className="text-muted-foreground">Clock In:</p>
                              <p className="font-medium text-foreground">
                                {record.check_in_time 
                                  ? (() => {
                                      try {
                                        const timeStr = record.check_in_time.split(' ')[1]?.split('+')[0] || record.check_in_time;
                                        return timeStr;
                                      } catch {
                                        return record.check_in_time;
                                      }
                                    })()
                                  : '-'
                                }
                              </p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Clock Out:</p>
                              <p className="font-medium text-foreground">
                                {record.check_out_time 
                                  ? (() => {
                                      try {
                                        const timeStr = record.check_out_time.split(' ')[1]?.split('+')[0] || record.check_out_time;
                                        return timeStr;
                                      } catch {
                                        return record.check_out_time;
                                      }
                                    })()
                                  : '-'
                                }
                              </p>
                            </div>
                          </div>

                          {record.checkin_location_address && (
                            <div>
                              <p className="text-xs text-muted-foreground">Lokasi Clock In:</p>
                              <p className="text-xs text-foreground mb-1">{record.checkin_location_address}</p>
                              <div className="flex items-center justify-between">
                                <p className="text-xs text-muted-foreground">
                                  📍 {record.checkin_location_lat}, {record.checkin_location_lng}
                                </p>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => window.open(
                                    `https://www.google.com/maps?q=${record.checkin_location_lat},${record.checkin_location_lng}`,
                                    '_blank'
                                  )}
                                  className="text-xs h-5 px-2"
                                >
                                  🗺️ Maps
                                </Button>
                              </div>
                            </div>
                          )}

                          {record.checkout_location_address && (
                            <div className="mt-1">
                              <p className="text-xs text-muted-foreground">Lokasi Clock Out:</p>
                              <p className="text-xs text-foreground mb-1">{record.checkout_location_address}</p>
                              <div className="flex items-center justify-between">
                                <p className="text-xs text-muted-foreground">
                                  📍 {record.checkout_location_lat}, {record.checkout_location_lng}
                                </p>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => window.open(
                                    `https://www.google.com/maps?q=${record.checkout_location_lat},${record.checkout_location_lng}`,
                                    '_blank'
                                  )}
                                  className="text-xs h-5 px-2"
                                >
                                  🗺️ Maps
                                </Button>
                              </div>
                            </div>
                          )}

                          {record.reason && (
                            <div className="mt-1">
                              <p className="text-xs text-muted-foreground">Alasan:</p>
                              <p className="text-xs text-foreground">{record.reason}</p>
                            </div>
                          )}

                          {record.selfie_photo_url && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => viewPhoto(record.selfie_photo_url!)}
                              className="w-full mt-1 text-xs h-6"
                            >
                              <Eye className="h-3 w-3 mr-1" />
                              View Photo
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                    
                    {/* Pagination Controls */}
                    <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
                      <div className="text-sm text-muted-foreground">
                        {totalPages > 1 ? (
                          <>Halaman {currentPage} dari {totalPages} (Total: {attendanceRecords.length} records)</>
                        ) : (
                          <>Total: {attendanceRecords.length} records</>
                        )}
                      </div>
                      {totalPages > 1 && (
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                            disabled={currentPage === 1}
                          >
                            Sebelumnya
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                            disabled={currentPage === totalPages}
                          >
                            Selanjutnya
                          </Button>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="notcheckedin">
            <NotCheckedInList />
          </TabsContent>

          <TabsContent value="analytics">
            <React.Suspense fallback={<div className="text-center py-8">Loading Analytics...</div>}>
              <DashboardAnalytics />
            </React.Suspense>
          </TabsContent>

          <TabsContent value="employees">
            <EmployeeManager />
          </TabsContent>

          <TabsContent value="birthdays">
            <BirthdayImporter />
          </TabsContent>

          <TabsContent value="admins">
            <AdminManager />
          </TabsContent>

          <TabsContent value="logs">
            <ActivityLogViewer />
          </TabsContent>

          <TabsContent value="scores" className="space-y-6">
            <React.Suspense fallback={<div className="text-center py-8">Loading Score Report...</div>}>
              <ScoreReport />
            </React.Suspense>
            {isSuperAdmin && (
              <React.Suspense fallback={<div className="text-center py-8">Loading...</div>}>
                <RankingOverrideManager />
              </React.Suspense>
            )}
          </TabsContent>

          <TabsContent value="export">
            <AttendanceExporter />
          </TabsContent>

          <TabsContent value="geofence">
            <React.Suspense fallback={<div className="text-center py-8">Loading map...</div>}>
              <PolygonGeofenceManager />
            </React.Suspense>
          </TabsContent>

          <TabsContent value="kiosk">
            <React.Suspense fallback={<div className="text-center py-8">Loading...</div>}>
              <KioskModeSettings />
            </React.Suspense>
          </TabsContent>

          <TabsContent value="ads">
            <React.Suspense fallback={<div className="text-center py-8">Loading...</div>}>
              <AdManager />
            </React.Suspense>
          </TabsContent>

          <TabsContent value="settings">
            <AppSettings />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Dashboard;
