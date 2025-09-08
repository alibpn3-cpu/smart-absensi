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
  const [showGeofence, setShowGeofence] = useState(false);
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
      await signOut();
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
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Admin Dashboard</h1>
            <p className="text-muted-foreground">Smart Zone Absensi Management</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button 
              variant="outline" 
              onClick={() => setShowGeofence(!showGeofence)}
              className="gradient-secondary"
            >
              <MapPin className="h-4 w-4 mr-2" />
              Geofence
            </Button>
            <Button variant="outline" onClick={handleLogout} className="hover:bg-destructive/10">
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Staff</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.totalStaff}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Hadir Hari Ini</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.presentToday}</div>
              <p className="text-xs text-muted-foreground">
                {summary.totalStaff > 0 
                  ? `${Math.round((summary.presentToday / summary.totalStaff) * 100)}% kehadiran`
                  : '0% kehadiran'
                }
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">WFO</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.wfoCount}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">WFH</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.wfhCount}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Dinas</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.dinasCount}</div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Tabs */}
        <Tabs defaultValue="attendance" className="space-y-6">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="attendance">Attendance</TabsTrigger>
            <TabsTrigger value="employees">
              <UserPlus className="h-4 w-4 mr-2" />
              Employees
            </TabsTrigger>
            <TabsTrigger value="admins">
              <Settings className="h-4 w-4 mr-2" />
              Admins
            </TabsTrigger>
            <TabsTrigger value="export">
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              Export
            </TabsTrigger>
            <TabsTrigger value="geofence">
              <MapPin className="h-4 w-4 mr-2" />
              Geofence
            </TabsTrigger>
          </TabsList>

          <TabsContent value="attendance" className="space-y-6">
            {/* Filters */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Filter className="h-5 w-5" />
                  Filter Attendance Records
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex gap-4 items-end">
                  <div className="space-y-2">
                    <Label htmlFor="date">Tanggal</Label>
                    <Input
                      id="date"
                      type="date"
                      value={selectedDate}
                      onChange={(e) => setSelectedDate(e.target.value)}
                    />
                  </div>
                  <Button onClick={fetchDashboardData} disabled={loading}>
                    <Calendar className="h-4 w-4 mr-2" />
                    Update
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Attendance Records */}
            <Card>
              <CardHeader>
                <CardTitle>Attendance Records - {new Date(selectedDate).toLocaleDateString('id-ID')}</CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="text-center py-8">Loading...</div>
                ) : attendanceRecords.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No attendance records found for selected date
                  </div>
                ) : (
                  <div className="space-y-4">
                    {attendanceRecords.map((record) => (
                      <div
                        key={record.id}
                        className="border rounded-lg p-4 space-y-3"
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <h3 className="font-semibold">{record.staff_name}</h3>
                            <p className="text-sm text-muted-foreground">ID: {record.staff_uid}</p>
                          </div>
                          {getStatusBadge(record.status)}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                          <div>
                            <p className="text-muted-foreground">Check In:</p>
                            <p className="font-medium">
                              {record.check_in_time 
                                ? new Date(record.check_in_time).toLocaleString('id-ID')
                                : '-'
                              }
                            </p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Check Out:</p>
                            <p className="font-medium">
                              {record.check_out_time 
                                ? new Date(record.check_out_time).toLocaleString('id-ID')
                                : '-'
                              }
                            </p>
                          </div>
                        </div>

                        {record.location_address && (
                          <div>
                            <p className="text-sm text-muted-foreground">Location:</p>
                            <p className="text-sm">{record.location_address}</p>
                          </div>
                        )}

                        {record.reason && (
                          <div>
                            <p className="text-sm text-muted-foreground">Reason:</p>
                            <p className="text-sm">{record.reason}</p>
                          </div>
                        )}

                        {record.selfie_photo_url && (
                          <div className="flex justify-end">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => viewPhoto(record.selfie_photo_url!)}
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
            <Card>
              <CardHeader>
                <CardTitle>Geofence Management</CardTitle>
              </CardHeader>
              <CardContent>
                <GeofenceManager />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Dashboard;