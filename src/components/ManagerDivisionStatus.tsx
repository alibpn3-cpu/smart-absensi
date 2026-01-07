import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ChevronUp, Users, CheckCircle, AlertCircle, MapPin, LogIn, LogOut } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface ManagerDivisionStatusProps {
  division: string;
  managerName: string;
}

interface StaffAttendance {
  uid: string;
  name: string;
  position: string;
  checkInTime: string | null;
  checkOutTime: string | null;
  status: 'wfo' | 'wfh' | 'dinas' | null;
  checkinLocation: string | null;
  checkoutLocation: string | null;
}

const ManagerDivisionStatus: React.FC<ManagerDivisionStatusProps> = ({ division, managerName }) => {
  const [checkedInStaff, setCheckedInStaff] = useState<StaffAttendance[]>([]);
  const [notCheckedInStaff, setNotCheckedInStaff] = useState<StaffAttendance[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const [loading, setLoading] = useState(false);

  const fetchDivisionAttendance = async () => {
    if (!division) return;
    
    setLoading(true);
    try {
      // Get current date in local timezone
      const now = new Date();
      const pad = (n: number) => String(n).padStart(2, '0');
      const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
      
      // Fetch all active staff in the division
      const { data: staffData, error: staffError } = await supabase
        .from('staff_users')
        .select('uid, name, position')
        .eq('division', division)
        .eq('is_active', true)
        .order('name');
      
      if (staffError) throw staffError;
      
      // Fetch today's attendance for all staff with location info
      const { data: attendanceData, error: attendanceError } = await supabase
        .from('attendance_records')
        .select('staff_uid, check_in_time, check_out_time, status, checkin_location_address, checkout_location_address')
        .eq('date', today)
        .eq('attendance_type', 'regular');
      
      if (attendanceError) throw attendanceError;
      
      // Create attendance map
      const attendanceMap = new Map<string, {
        checkInTime: string | null;
        checkOutTime: string | null;
        status: string | null;
        checkinLocation: string | null;
        checkoutLocation: string | null;
      }>();
      
      attendanceData?.forEach(record => {
        attendanceMap.set(record.staff_uid, {
          checkInTime: record.check_in_time,
          checkOutTime: record.check_out_time,
          status: record.status,
          checkinLocation: record.checkin_location_address,
          checkoutLocation: record.checkout_location_address
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
            checkOutTime: attendance.checkOutTime,
            status: attendance.status as 'wfo' | 'wfh' | 'dinas' | null,
            checkinLocation: attendance.checkinLocation,
            checkoutLocation: attendance.checkoutLocation
          });
        } else {
          notChecked.push({
            uid: staff.uid,
            name: staff.name,
            position: staff.position,
            checkInTime: null,
            checkOutTime: null,
            status: null,
            checkinLocation: null,
            checkoutLocation: null
          });
        }
      });
      
      setCheckedInStaff(checked);
      setNotCheckedInStaff(notChecked);
    } catch (error) {
      console.error('Error fetching division attendance:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDivisionAttendance();
    
    // Refresh every 1 minute
    const interval = setInterval(fetchDivisionAttendance, 60 * 1000);
    
    return () => clearInterval(interval);
  }, [division]);

  const formatTime = (timestamp: string | null): string => {
    if (!timestamp) return '-';
    try {
      const date = new Date(timestamp.replace(' ', 'T'));
      return date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '-';
    }
  };

  const shortenAddress = (address: string | null | undefined): string | null => {
    if (!address) return null;
    const parts = address.split(',');
    const firstPart = parts[0].trim();
    return firstPart.length > 25 ? firstPart.substring(0, 22) + '...' : firstPart;
  };

  const getStatusVariant = (status: string | null) => {
    switch (status) {
      case 'wfo':
        return 'default';
      case 'wfh':
        return 'secondary';
      case 'dinas':
        return 'outline';
      default:
        return 'secondary';
    }
  };

  const getStatusColor = (status: string | null) => {
    switch (status) {
      case 'wfo':
        return 'bg-blue-500 text-white';
      case 'wfh':
        return 'bg-purple-500 text-white';
      case 'dinas':
        return 'bg-orange-500 text-white';
      default:
        return '';
    }
  };

  if (!division) {
    return null;
  }

  return (
    <Card className="border-0 shadow-md rounded-xl bg-card">
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors py-3 px-4">
            <CardTitle className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                <span>Tim Divisi {division}</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="default" className="bg-green-500 text-white text-xs">
                  ✅ {checkedInStaff.length}
                </Badge>
                <Badge variant="destructive" className="text-xs">
                  ⚠️ {notCheckedInStaff.length}
                </Badge>
                {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </div>
            </CardTitle>
          </CardHeader>
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <CardContent className="pt-0 px-4 pb-4 space-y-4">
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
                    <div className="max-h-60 overflow-y-auto space-y-2 pl-6">
                      {checkedInStaff.map(staff => (
                        <div 
                          key={staff.uid} 
                          className="bg-green-50 dark:bg-green-950/30 p-3 rounded-lg space-y-1.5"
                        >
                          {/* Name and Status */}
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-sm truncate max-w-[180px]">{staff.name}</span>
                            {staff.status && (
                              <Badge className={`text-[10px] ${getStatusColor(staff.status)}`}>
                                {staff.status.toUpperCase()}
                              </Badge>
                            )}
                          </div>
                          
                          {/* Times */}
                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <LogIn className="h-3 w-3 text-green-500" />
                              {formatTime(staff.checkInTime)}
                            </span>
                            {staff.checkOutTime && (
                              <span className="flex items-center gap-1">
                                <LogOut className="h-3 w-3 text-red-500" />
                                {formatTime(staff.checkOutTime)}
                              </span>
                            )}
                          </div>
                          
                          {/* Locations */}
                          {staff.checkinLocation && (
                            <div className="text-xs text-muted-foreground flex items-center gap-1">
                              <MapPin className="h-3 w-3 text-green-500 shrink-0" />
                              <span className="truncate">In: {shortenAddress(staff.checkinLocation)}</span>
                            </div>
                          )}
                          {staff.checkoutLocation && (
                            <div className="text-xs text-muted-foreground flex items-center gap-1">
                              <MapPin className="h-3 w-3 text-red-500 shrink-0" />
                              <span className="truncate">Out: {shortenAddress(staff.checkoutLocation)}</span>
                            </div>
                          )}
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
                    <p className="text-xs text-muted-foreground pl-6">Semua anggota divisi sudah absen</p>
                  ) : (
                    <div className="max-h-40 overflow-y-auto space-y-1 pl-6">
                      {notCheckedInStaff.map(staff => (
                        <div 
                          key={staff.uid} 
                          className="flex items-center justify-between text-xs bg-red-50 dark:bg-red-950/30 p-2 rounded"
                        >
                          <div className="min-w-0">
                            <span className="font-medium truncate block max-w-[180px]">{staff.name}</span>
                            <span className="text-muted-foreground text-[10px]">{staff.position}</span>
                          </div>
                          <Badge variant="outline" className="text-[10px] border-destructive text-destructive shrink-0">
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

export default ManagerDivisionStatus;
