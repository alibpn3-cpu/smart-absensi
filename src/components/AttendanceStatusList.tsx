import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ChevronUp, Users, CheckCircle, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface AttendanceStatusListProps {
  selectedWorkArea: string;
}

interface StaffAttendance {
  uid: string;
  name: string;
  position: string;
  checkInTime: string | null;
  checkOutTime: string | null;
}

const AttendanceStatusList: React.FC<AttendanceStatusListProps> = ({ selectedWorkArea }) => {
  const [checkedInStaff, setCheckedInStaff] = useState<StaffAttendance[]>([]);
  const [notCheckedInStaff, setNotCheckedInStaff] = useState<StaffAttendance[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const [loading, setLoading] = useState(false);

  const fetchAttendanceStatus = async () => {
    if (!selectedWorkArea || selectedWorkArea === 'all') return;
    
    setLoading(true);
    try {
      // Get current date in local timezone
      const now = new Date();
      const pad = (n: number) => String(n).padStart(2, '0');
      const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
      
      // Fetch all active staff in the work area
      const { data: staffData, error: staffError } = await supabase
        .from('staff_users')
        .select('uid, name, position')
        .eq('work_area', selectedWorkArea)
        .eq('is_active', true)
        .order('name');
      
      if (staffError) throw staffError;
      
      // Fetch today's attendance for all staff
      const { data: attendanceData, error: attendanceError } = await supabase
        .from('attendance_records')
        .select('staff_uid, check_in_time, check_out_time')
        .eq('date', today)
        .eq('attendance_type', 'regular');
      
      if (attendanceError) throw attendanceError;
      
      // Create attendance map
      const attendanceMap = new Map<string, { checkInTime: string | null; checkOutTime: string | null }>();
      attendanceData?.forEach(record => {
        attendanceMap.set(record.staff_uid, {
          checkInTime: record.check_in_time,
          checkOutTime: record.check_out_time
        });
      });
      
      // Categorize staff
      const checked: StaffAttendance[] = [];
      const notChecked: StaffAttendance[] = [];
      
      staffData?.forEach(staff => {
        const attendance = attendanceMap.get(staff.uid);
        if (attendance?.checkInTime) {
          checked.push({
            uid: staff.uid,
            name: staff.name,
            position: staff.position,
            checkInTime: attendance.checkInTime,
            checkOutTime: attendance.checkOutTime
          });
        } else {
          notChecked.push({
            uid: staff.uid,
            name: staff.name,
            position: staff.position,
            checkInTime: null,
            checkOutTime: null
          });
        }
      });
      
      setCheckedInStaff(checked);
      setNotCheckedInStaff(notChecked);
    } catch (error) {
      console.error('Error fetching attendance status:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAttendanceStatus();
    
    // Refresh every 1 minutes
    const interval = setInterval(fetchAttendanceStatus, 1 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, [selectedWorkArea]);

  const formatTime = (timestamp: string | null): string => {
    if (!timestamp) return '-';
    try {
      const date = new Date(timestamp.replace(' ', 'T'));
      return date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '-';
    }
  };

  if (!selectedWorkArea || selectedWorkArea === 'all') {
    return null;
  }

  const totalStaff = checkedInStaff.length + notCheckedInStaff.length;

  return (
    <Card className="mt-4">
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors py-3">
            <CardTitle className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                <span>Status Absensi - {selectedWorkArea}</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="default" className="bg-green-500 text-white">
                  ✅ {checkedInStaff.length}
                </Badge>
                <Badge variant="destructive">
                  ⚠️ {notCheckedInStaff.length}
                </Badge>
                {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </div>
            </CardTitle>
          </CardHeader>
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <CardContent className="pt-0 space-y-4">
            {loading ? (
              <div className="text-center text-muted-foreground text-sm py-4">
                Memuat data...
              </div>
            ) : (
              <>
                {/* Already Checked In */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-medium text-green-600">
                    <CheckCircle className="h-4 w-4" />
                    Sudah Absen ({checkedInStaff.length})
                  </div>
                  {checkedInStaff.length === 0 ? (
                    <p className="text-xs text-muted-foreground pl-6">Belum ada yang absen</p>
                  ) : (
                    <div className="max-h-40 overflow-y-auto space-y-1 pl-6">
                      {checkedInStaff.map(staff => (
                        <div 
                          key={staff.uid} 
                          className="flex items-center justify-between text-xs bg-green-50 dark:bg-green-950/30 p-2 rounded"
                        >
                          <span className="font-medium truncate max-w-[150px]">{staff.name}</span>
                          <span className="text-muted-foreground">
                            In: {formatTime(staff.checkInTime)}
                            {staff.checkOutTime && ` | Out: ${formatTime(staff.checkOutTime)}`}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                
                {/* Not Checked In */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-medium text-destructive">
                    <AlertCircle className="h-4 w-4" />
                    Belum Absen ({notCheckedInStaff.length})
                  </div>
                  {notCheckedInStaff.length === 0 ? (
                    <p className="text-xs text-muted-foreground pl-6">Semua staff sudah absen</p>
                  ) : (
                    <div className="max-h-40 overflow-y-auto space-y-1 pl-6">
                      {notCheckedInStaff.map(staff => (
                        <div 
                          key={staff.uid} 
                          className="flex items-center justify-between text-xs bg-red-50 dark:bg-red-950/30 p-2 rounded"
                        >
                          <span className="font-medium truncate max-w-[200px]">{staff.name}</span>
                          <Badge variant="outline" className="text-[10px] border-destructive text-destructive">
                            Belum Check In
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
};

export default AttendanceStatusList;
