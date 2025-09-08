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
  FileSpreadsheet
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

interface AttendanceRecord {
  id: string;
  staff_uid: string;
  staff_name: string;
  check_in_time: string | null;
  check_out_time: string | null;
  location_address: string | null;
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
        title: "Error",
        description: "Failed to load dashboard data",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      signOut(); // No need for await since it just clears localStorage and navigates
      toast({
        title: "Success",
        description: "Successfully logged out"
      });
    } catch (error) {
      console.error('Logout error:', error);
      toast({
        title: "Error",
        description: "Failed to logout",
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
        title: "Error",
        description: "Failed to load photo",
        variant: "destructive"
      });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-2 sm:p-4">
      <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white">Admin Dashboard</h1>
            <p className="text-slate-300">Smart Zone Absensi Management</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button 
              variant="outline" 
              onClick={handleLogout} 
              className="bg-red-500/20 border-red-400/30 text-red-300 hover:bg-red-500/30"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
          <Card className="bg-white/10 border-white/20 backdrop-blur-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium text-white">Total Staff</CardTitle>
              <Users className="h-4 w-4 text-slate-300" />
            </CardHeader>
            <CardContent>
              <div className="text-xl sm:text-2xl font-bold text-white">{summary.totalStaff}</div>
            </CardContent>
          </Card>

          <Card className="bg-white/10 border-white/20 backdrop-blur-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium text-white">Hadir Hari Ini</CardTitle>
              <TrendingUp className="h-4 w-4 text-slate-300" />
            </CardHeader>
            <CardContent>
              <div className="text-xl sm:text-2xl font-bold text-white">{summary.presentToday}</div>
              <p className="text-xs text-slate-300">
                {summary.totalStaff > 0 
                  ? `${Math.round((summary.presentToday / summary.totalStaff) * 100)}% kehadiran`
                  : '0% kehadiran'
                }
              </p>
            </CardContent>
          </Card>

          <Card className="bg-white/10 border-white/20 backdrop-blur-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium text-white">WFO</CardTitle>
              <Clock className="h-4 w-4 text-slate-300" />
            </CardHeader>
            <CardContent>
              <div className="text-xl sm:text-2xl font-bold text-white">{summary.wfoCount}</div>
            </CardContent>
          </Card>

          <Card className="bg-white/10 border-white/20 backdrop-blur-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium text-white">WFH</CardTitle>
              <Clock className="h-4 w-4 text-slate-300" />
            </CardHeader>
            <CardContent>
              <div className="text-xl sm:text-2xl font-bold text-white">{summary.wfhCount}</div>
            </CardContent>
          </Card>

          <Card className="bg-white/10 border-white/20 backdrop-blur-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium text-white">Dinas</CardTitle>
              <Clock className="h-4 w-4 text-slate-300" />
            </CardHeader>
            <CardContent>
              <div className="text-xl sm:text-2xl font-bold text-white">{summary.dinasCount}</div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Tabs */}
        <Tabs defaultValue="attendance" className="space-y-4 sm:space-y-6">
          <TabsList className="grid w-full grid-cols-3 sm:grid-cols-6 gap-1 bg-white/10 border-white/20 backdrop-blur-sm h-auto p-1">
            <TabsTrigger value="attendance" className="text-white data-[state=active]:bg-white/20 data-[state=active]:text-white flex-1 py-2 text-xs sm:text-sm">
              <span className="hidden sm:inline">Attendance</span>
              <span className="sm:hidden">Absen</span>
            </TabsTrigger>
            <TabsTrigger value="employees" className="text-white data-[state=active]:bg-white/20 data-[state=active]:text-white flex-1 py-2 text-xs sm:text-sm">
              <UserPlus className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-2" />
              <span className="hidden sm:inline">Employees</span>
              <span className="sm:hidden">Staff</span>
            </TabsTrigger>
            <TabsTrigger value="admins" className="text-white data-[state=active]:bg-white/20 data-[state=active]:text-white flex-1 py-2 text-xs sm:text-sm">
              <Settings className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-2" />
              <span className="hidden sm:inline">Admins</span>
              <span className="sm:hidden">Admin</span>
            </TabsTrigger>
            <TabsTrigger value="export" className="text-white data-[state=active]:bg-white/20 data-[state=active]:text-white flex-1 py-2 text-xs sm:text-sm">
              <FileSpreadsheet className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-2" />
              <span className="hidden sm:inline">Export</span>
              <span className="sm:hidden">Data</span>
            </TabsTrigger>
            <TabsTrigger value="geofence" className="text-white data-[state=active]:bg-white/20 data-[state=active]:text-white flex-1 py-2 text-xs sm:text-sm">
              <MapPin className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-2" />
              <span className="hidden sm:inline">Geofence</span>
              <span className="sm:hidden">Lokasi</span>
            </TabsTrigger>
            <TabsTrigger value="settings" className="text-white data-[state=active]:bg-white/20 data-[state=active]:text-white flex-1 py-2 text-xs sm:text-sm">
              <Settings className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-2" />
              <span className="hidden sm:inline">Settings</span>
              <span className="sm:hidden">Config</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="attendance" className="space-y-4 sm:space-y-6">
            {/* Filters */}
            <Card className="bg-white/10 border-white/20 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-white">
                  <Filter className="h-5 w-5" />
                  Filter Attendance Records
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col sm:flex-row gap-4 items-end">
                  <div className="space-y-2 flex-1 sm:flex-initial">
                    <Label htmlFor="date" className="text-white">Tanggal</Label>
                    <Input
                      id="date"
                      type="date"
                      value={selectedDate}
                      onChange={(e) => setSelectedDate(e.target.value)}
                      className="bg-white/10 border-white/20 text-white"
                    />
                  </div>
                  <Button 
                    onClick={fetchDashboardData} 
                    disabled={loading}
                    className="bg-white/20 border-white/30 text-white hover:bg-white/30 w-full sm:w-auto"
                  >
                    <Calendar className="h-4 w-4 mr-2" />
                    Update
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Attendance Records */}
            <Card className="bg-white/10 border-white/20 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="text-white">Attendance Records - {new Date(selectedDate).toLocaleDateString('id-ID')}</CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="text-center py-8 text-white">Loading...</div>
                ) : attendanceRecords.length === 0 ? (
                  <div className="text-center py-8 text-slate-300">
                    No attendance records found for selected date
                  </div>
                ) : (
                  <div className="space-y-4">
                    {attendanceRecords.map((record) => (
                      <div
                        key={record.id}
                        className="border border-white/20 rounded-lg p-4 space-y-3 bg-white/5"
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <h3 className="font-semibold text-white">{record.staff_name}</h3>
                            <p className="text-sm text-slate-300">ID: {record.staff_uid}</p>
                          </div>
                          {getStatusBadge(record.status)}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                          <div>
                            <p className="text-slate-300">Check In:</p>
                            <p className="font-medium text-white">
                              {record.check_in_time 
                                ? new Date(record.check_in_time).toLocaleString('id-ID')
                                : '-'
                              }
                            </p>
                          </div>
                          <div>
                            <p className="text-slate-300">Check Out:</p>
                            <p className="font-medium text-white">
                              {record.check_out_time 
                                ? new Date(record.check_out_time).toLocaleString('id-ID')
                                : '-'
                              }
                            </p>
                          </div>
                        </div>

                        {record.location_address && (
                          <div>
                            <p className="text-sm text-slate-300">Location:</p>
                            <p className="text-sm text-white">{record.location_address}</p>
                          </div>
                        )}

                        {record.reason && (
                          <div>
                            <p className="text-sm text-slate-300">Reason:</p>
                            <p className="text-sm text-white">{record.reason}</p>
                          </div>
                        )}

                        {record.selfie_photo_url && (
                          <div className="flex justify-end">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => viewPhoto(record.selfie_photo_url!)}
                              className="bg-white/10 border-white/20 text-white hover:bg-white/20"
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

          <TabsContent value="admins">
            <AdminManager />
          </TabsContent>

          <TabsContent value="export">
            <AttendanceExporter />
          </TabsContent>

          <TabsContent value="geofence">
            <Card className="bg-white/10 border-white/20 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="text-white">Geofence Management</CardTitle>
              </CardHeader>
              <CardContent>
                <GeofenceManager />
              </CardContent>
            </Card>
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