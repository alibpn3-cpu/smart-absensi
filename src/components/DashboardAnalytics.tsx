import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, AreaChart, Area
} from 'recharts';
import { 
  TrendingUp, Calendar, Users, Clock, Building2, BarChart3, RefreshCw
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface DailyStats {
  date: string;
  total: number;
  wfo: number;
  wfh: number;
  dinas: number;
}

interface WorkAreaStats {
  name: string;
  count: number;
  percentage: number;
}

interface CheckInTimeStats {
  hour: string;
  count: number;
}

// Status colors - distinct and visible
const STATUS_COLORS: Record<string, string> = {
  WFO: '#3B82F6',   // Blue
  WFH: '#22C55E',   // Green
  Dinas: '#F97316'  // Orange
};

const DashboardAnalytics = () => {
  const [loading, setLoading] = useState(false);
  const [dateRange, setDateRange] = useState<'7d' | '30d' | 'custom'>('7d');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  
  const [dailyStats, setDailyStats] = useState<DailyStats[]>([]);
  const [workAreaStats, setWorkAreaStats] = useState<WorkAreaStats[]>([]);
  const [statusDistribution, setStatusDistribution] = useState<{name: string; value: number}[]>([]);
  const [checkInTimeStats, setCheckInTimeStats] = useState<CheckInTimeStats[]>([]);
  const [summary, setSummary] = useState({
    totalRecords: 0,
    avgDailyAttendance: 0,
    avgCheckInTime: '',
    topWorkArea: '',
    attendanceRate: 0
  });

  useEffect(() => {
    const now = new Date();
    if (dateRange === '7d') {
      const start = new Date(now);
      start.setDate(start.getDate() - 7);
      setStartDate(start.toISOString().split('T')[0]);
      setEndDate(now.toISOString().split('T')[0]);
    } else if (dateRange === '30d') {
      const start = new Date(now);
      start.setDate(start.getDate() - 30);
      setStartDate(start.toISOString().split('T')[0]);
      setEndDate(now.toISOString().split('T')[0]);
    }
  }, [dateRange]);

  useEffect(() => {
    if (startDate && endDate) {
      fetchAnalytics();
    }
  }, [startDate, endDate]);

  const fetchAnalytics = async () => {
    if (!startDate || !endDate) return;
    
    setLoading(true);
    try {
      // Fetch attendance records
      const { data: records, error } = await supabase
        .from('attendance_records')
        .select('*')
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: true });

      if (error) throw error;

      // Fetch staff for work area info
      const { data: staff } = await supabase
        .from('staff_users')
        .select('uid, work_area')
        .eq('is_active', true);

      const staffWorkArea = new Map(staff?.map(s => [s.uid, s.work_area]) || []);

      // Fetch total staff count
      const { data: allStaff } = await supabase
        .from('staff_users')
        .select('id')
        .eq('is_active', true);
      
      const totalStaff = allStaff?.length || 0;

      // Process daily stats
      const dailyMap = new Map<string, DailyStats>();
      records?.forEach(r => {
        const existing = dailyMap.get(r.date) || { date: r.date, total: 0, wfo: 0, wfh: 0, dinas: 0 };
        existing.total++;
        if (r.status === 'wfo') existing.wfo++;
        else if (r.status === 'wfh') existing.wfh++;
        else if (r.status === 'dinas') existing.dinas++;
        dailyMap.set(r.date, existing);
      });
      
      const dailyData = Array.from(dailyMap.values()).map(d => ({
        ...d,
        date: new Date(d.date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })
      }));
      setDailyStats(dailyData);

      // Process work area stats
      const workAreaMap = new Map<string, number>();
      records?.forEach(r => {
        const area = staffWorkArea.get(r.staff_uid) || 'Unknown';
        workAreaMap.set(area, (workAreaMap.get(area) || 0) + 1);
      });
      
      const totalRecords = records?.length || 0;
      const workAreaData = Array.from(workAreaMap.entries())
        .map(([name, count]) => ({
          name,
          count,
          percentage: Math.round((count / totalRecords) * 100)
        }))
        .sort((a, b) => b.count - a.count);
      setWorkAreaStats(workAreaData);

      // Process status distribution
      const wfoCount = records?.filter(r => r.status === 'wfo').length || 0;
      const wfhCount = records?.filter(r => r.status === 'wfh').length || 0;
      const dinasCount = records?.filter(r => r.status === 'dinas').length || 0;
      setStatusDistribution([
        { name: 'WFO', value: wfoCount },
        { name: 'WFH', value: wfhCount },
        { name: 'Dinas', value: dinasCount }
      ]);

      // Process check-in time stats
      const hourMap = new Map<string, number>();
      records?.forEach(r => {
        if (r.check_in_time) {
          try {
            const timePart = r.check_in_time.split(' ')[1]?.split(':')[0] || '00';
            const hour = timePart.padStart(2, '0');
            hourMap.set(hour, (hourMap.get(hour) || 0) + 1);
          } catch {
            // ignore invalid time
          }
        }
      });
      
      const checkInData = Array.from({ length: 24 }, (_, i) => {
        const hour = i.toString().padStart(2, '0');
        return { hour: `${hour}:00`, count: hourMap.get(hour) || 0 };
      }).filter(d => d.count > 0);
      setCheckInTimeStats(checkInData);

      // Calculate summary
      const numDays = dailyMap.size;
      const avgDaily = numDays > 0 ? Math.round(totalRecords / numDays) : 0;
      const topArea = workAreaData[0]?.name || '-';
      
      // Calculate average check-in time
      let totalMinutes = 0;
      let validTimes = 0;
      records?.forEach(r => {
        if (r.check_in_time) {
          try {
            const timePart = r.check_in_time.split(' ')[1]?.split('+')[0];
            if (timePart) {
              const [h, m] = timePart.split(':').map(Number);
              totalMinutes += h * 60 + m;
              validTimes++;
            }
          } catch {
            // ignore
          }
        }
      });
      
      const avgMinutes = validTimes > 0 ? Math.round(totalMinutes / validTimes) : 0;
      const avgHour = Math.floor(avgMinutes / 60).toString().padStart(2, '0');
      const avgMin = (avgMinutes % 60).toString().padStart(2, '0');
      
      // Calculate attendance rate (average daily attendance / total staff)
      const attendanceRate = totalStaff > 0 ? Math.round((avgDaily / totalStaff) * 100) : 0;

      setSummary({
        totalRecords,
        avgDailyAttendance: avgDaily,
        avgCheckInTime: `${avgHour}:${avgMin}`,
        topWorkArea: topArea,
        attendanceRate
      });

    } catch (error) {
      console.error('Error fetching analytics:', error);
      toast({
        title: "Gagal",
        description: "Gagal memuat data analytics",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Date Range Selector */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-title-primary">
            <BarChart3 className="h-5 w-5" />
            Dashboard Analytics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-2">
              <Label>Periode</Label>
              <Select value={dateRange} onValueChange={(v) => setDateRange(v as any)}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7d">7 Hari Terakhir</SelectItem>
                  <SelectItem value="30d">30 Hari Terakhir</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {dateRange === 'custom' && (
              <>
                <div className="space-y-2">
                  <Label>Mulai</Label>
                  <Input 
                    type="date" 
                    value={startDate} 
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Sampai</Label>
                  <Input 
                    type="date" 
                    value={endDate} 
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </div>
              </>
            )}
            
            <Button onClick={fetchAnalytics} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="bg-card border-border">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Total Records</p>
                <p className="text-2xl font-bold text-foreground">{summary.totalRecords}</p>
              </div>
              <Calendar className="h-8 w-8 text-primary opacity-50" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-card border-border">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Rata-rata/Hari</p>
                <p className="text-2xl font-bold text-foreground">{summary.avgDailyAttendance}</p>
              </div>
              <Users className="h-8 w-8 text-primary opacity-50" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-card border-border">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Rata-rata Clock In</p>
                <p className="text-2xl font-bold text-foreground">{summary.avgCheckInTime}</p>
              </div>
              <Clock className="h-8 w-8 text-primary opacity-50" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-card border-border">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Top Area</p>
                <p className="text-lg font-bold text-foreground truncate">{summary.topWorkArea}</p>
              </div>
              <Building2 className="h-8 w-8 text-primary opacity-50" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-card border-border">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Tingkat Kehadiran</p>
                <p className="text-2xl font-bold text-foreground">{summary.attendanceRate}%</p>
              </div>
              <TrendingUp className="h-8 w-8 text-primary opacity-50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Daily Trend Line Chart */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-sm font-medium">Trend Kehadiran Harian</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={dailyStats}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))', 
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px'
                  }} 
                />
                <Area type="monotone" dataKey="total" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.3} name="Total" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Status Distribution Pie Chart */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-sm font-medium">Distribusi Status</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={statusDistribution}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {statusDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={STATUS_COLORS[entry.name] || '#8884d8'} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Status Breakdown Bar Chart */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-sm font-medium">Breakdown Status per Hari</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={dailyStats}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))', 
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px'
                  }} 
                />
                <Legend />
                <Bar dataKey="wfo" stackId="a" fill="#3B82F6" name="WFO" />
                <Bar dataKey="wfh" stackId="a" fill="#22C55E" name="WFH" />
                <Bar dataKey="dinas" stackId="a" fill="#F97316" name="Dinas" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Check-in Time Distribution */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-sm font-medium">Distribusi Waktu Clock In</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={checkInTimeStats}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="hour" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))', 
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px'
                  }} 
                />
                <Bar dataKey="count" fill="hsl(var(--primary))" name="Jumlah" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Work Area Table */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-sm font-medium">Kehadiran per Work Area</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 px-4 font-medium text-muted-foreground">Work Area</th>
                  <th className="text-center py-2 px-4 font-medium text-muted-foreground">Total Kehadiran</th>
                  <th className="text-center py-2 px-4 font-medium text-muted-foreground">Persentase</th>
                  <th className="text-left py-2 px-4 font-medium text-muted-foreground">Visualisasi</th>
                </tr>
              </thead>
              <tbody>
                {workAreaStats.slice(0, 10).map((area, index) => (
                  <tr key={area.name} className="border-b border-border/50">
                    <td className="py-2 px-4 font-medium text-foreground">{area.name}</td>
                    <td className="text-center py-2 px-4 text-foreground">{area.count}</td>
                    <td className="text-center py-2 px-4">
                      <Badge variant="secondary">{area.percentage}%</Badge>
                    </td>
                    <td className="py-2 px-4">
                      <div className="w-full bg-muted rounded-full h-2">
                        <div 
                          className="h-2 rounded-full transition-all"
                          style={{ 
                            width: `${area.percentage}%`,
                            backgroundColor: ['#3B82F6', '#22C55E', '#F97316', '#10b981', '#f59e0b', '#ef4444'][index % 6]
                          }}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default DashboardAnalytics;
