import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  ImageIcon
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import GeofenceManager from '../components/GeofenceManager';
import EmployeeManager from '../components/EmployeeManager';
import AdminManager from '../components/AdminManager';
import AttendanceExporter from '../components/AttendanceExporter';
import AppSettings from '../components/AppSettings';
import BirthdayImporter from '../components/BirthdayImporter';
import AdManager from '../components/AdManager';
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
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [summary, setSummary] = useState<AttendanceSummary>({
    totalStaff: 0,
    presentToday: 0,
    wfoCount: 0,
    wfhCount: 0,
    dinasCount: 0
  });
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  
  const [loading, setLoading] = useState(true);

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

      setAttendanceRecords((attendance || []) as AttendanceRecord[]);
      
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
          <TabsList className="grid w-full grid-cols-3 sm:grid-cols-7 gap-1 bg-muted h-auto p-1">
            <TabsTrigger value="attendance" className="text-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground flex-1 py-2 text-xs sm:text-sm">
              <span className="hidden sm:inline">Attendance</span>
              <span className="sm:hidden">Absen</span>
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
            <TabsTrigger value="admins" className="text-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground flex-1 py-2 text-xs sm:text-sm">
              <Settings className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-2" />
              <span className="hidden sm:inline">Admins</span>
              <span className="sm:hidden">Admin</span>
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
            <TabsTrigger value="settings" className="text-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground flex-1 py-2 text-xs sm:text-sm">
              <Settings className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-2" />
              <span className="hidden sm:inline">Settings</span>
              <span className="sm:hidden">Config</span>
            </TabsTrigger>
            <TabsTrigger value="ads" className="text-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground flex-1 py-2 text-xs sm:text-sm">
              <ImageIcon className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-2" />
              <span className="hidden sm:inline">Ads</span>
              <span className="sm:hidden">Iklan</span>
            </TabsTrigger>
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
                <div className="flex flex-col sm:flex-row gap-4 items-end">
                  <div className="space-y-2 flex-1 sm:flex-initial">
                    <Label htmlFor="date" className="text-foreground">Tanggal</Label>
                    <Input
                      id="date"
                      type="date"
                      value={selectedDate}
                      onChange={(e) => setSelectedDate(e.target.value)}
                      className="bg-background border-border text-foreground"
                    />
                  </div>
                  <Button 
                    onClick={fetchDashboardData} 
                    disabled={loading}
                    className="bg-primary text-primary-foreground hover:bg-primary/90 w-full sm:w-auto"
                  >
                    <Calendar className="h-4 w-4 mr-2" />
                    Update
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Attendance Records */}
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="text-title-primary">Attendance Records - {new Date(selectedDate).toLocaleDateString('id-ID')}</CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="text-center py-8 text-foreground">Loading...</div>
                ) : attendanceRecords.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No attendance records found for selected date
                  </div>
                ) : (
                  <div className="space-y-4">
                    {attendanceRecords.map((record) => (
                      <div
                        key={record.id}
                        className="border border-border rounded-lg p-4 space-y-3 bg-muted/30"
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <h3 className="font-semibold text-foreground">{record.staff_name}</h3>
                            <p className="text-sm text-muted-foreground">ID: {record.staff_uid}</p>
                          </div>
                          {getStatusBadge(record.status)}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                          <div>
                            <p className="text-muted-foreground">Check In:</p>
                            <p className="font-medium text-foreground">
                              {record.check_in_time 
                                ? (() => {
                                    try {
                                      // Parse the stored time string (format: "YYYY-MM-DD HH:mm:ss.sss+HH:mm")
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
                            <p className="text-muted-foreground">Check Out:</p>
                            <p className="font-medium text-foreground">
                              {record.check_out_time 
                                ? (() => {
                                    try {
                                      // Parse the stored time string (format: "YYYY-MM-DD HH:mm:ss.sss+HH:mm")
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
                            <p className="text-sm text-muted-foreground">Lokasi Check In:</p>
                            <p className="text-sm text-foreground mb-2">{record.checkin_location_address}</p>
                            <div className="flex items-center justify-between">
                              <p className="text-xs text-muted-foreground">
                                📍 Koordinat: {record.checkin_location_lat}, {record.checkin_location_lng}
                              </p>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => window.open(
                                  `https://www.google.com/maps?q=${record.checkin_location_lat},${record.checkin_location_lng}`,
                                  '_blank'
                                )}
                                className="text-xs h-6"
                              >
                                🗺️ Maps
                              </Button>
                            </div>
                          </div>
                        )}

                        {record.checkout_location_address && (
                          <div className="mt-2">
                            <p className="text-sm text-muted-foreground">Lokasi Check Out:</p>
                            <p className="text-sm text-foreground mb-2">{record.checkout_location_address}</p>
                            <div className="flex items-center justify-between">
                              <p className="text-xs text-muted-foreground">
                                📍 Koordinat: {record.checkout_location_lat}, {record.checkout_location_lng}
                              </p>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => window.open(
                                  `https://www.google.com/maps?q=${record.checkout_location_lat},${record.checkout_location_lng}`,
                                  '_blank'
                                )}
                                className="text-xs h-6"
                              >
                                🗺️ Maps
                              </Button>
                            </div>
                          </div>
                        )}

                        {record.reason && (
                          <div>
                            <p className="text-sm text-muted-foreground">Reason:</p>
                            <p className="text-sm text-foreground">{record.reason}</p>
                          </div>
                        )}

                        {record.selfie_photo_url && (
                          <div className="flex justify-end">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => viewPhoto(record.selfie_photo_url!)}
                              className="bg-primary/10 border-primary/20 text-primary hover:bg-primary/20"
                            >
                              <Eye className="h-4 w-4 mr-2" />
                              View Photo
                            </Button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
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

          <TabsContent value="export">
            <AttendanceExporter />
          </TabsContent>

          <TabsContent value="geofence">
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="text-title-primary">Geofence Management</CardTitle>
              </CardHeader>
              <CardContent>
                <GeofenceManager />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settings">
            <AppSettings />
          </TabsContent>

          <TabsContent value="ads">
            <AdManager />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Dashboard;
