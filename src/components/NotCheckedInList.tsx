import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { AlertTriangle, Users, Building2, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface StaffNotCheckedIn {
  uid: string;
  name: string;
  position: string;
  work_area: string;
  division: string | null;
}

interface GroupedByArea {
  [area: string]: StaffNotCheckedIn[];
}

const NotCheckedInList = () => {
  const [loading, setLoading] = useState(false);
  const [notCheckedIn, setNotCheckedIn] = useState<StaffNotCheckedIn[]>([]);
  const [groupedByArea, setGroupedByArea] = useState<GroupedByArea>({});
  const [totalStaff, setTotalStaff] = useState(0);

  const fetchData = async () => {
    setLoading(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      
      // Fetch all active staff
      const { data: allStaff, error: staffError } = await supabase
        .from('staff_users')
        .select('uid, name, position, work_area, division')
        .eq('is_active', true)
        .order('work_area')
        .order('name');

      if (staffError) throw staffError;
      
      setTotalStaff(allStaff?.length || 0);

      // Fetch today's attendance
      const { data: attendance, error: attError } = await supabase
        .from('attendance_records')
        .select('staff_uid')
        .eq('date', today);

      if (attError) throw attError;

      // Get UIDs who have checked in
      const checkedInUids = new Set(attendance?.map(a => a.staff_uid) || []);

      // Filter staff who haven't checked in
      const notCheckedInStaff = (allStaff || []).filter(s => !checkedInUids.has(s.uid));
      setNotCheckedIn(notCheckedInStaff);

      // Group by work area
      const grouped: GroupedByArea = {};
      notCheckedInStaff.forEach(staff => {
        const area = staff.work_area || 'Unknown';
        if (!grouped[area]) grouped[area] = [];
        grouped[area].push(staff);
      });
      setGroupedByArea(grouped);

    } catch (error) {
      console.error('Error fetching not checked in data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // Refresh every 5 minutes
    const interval = setInterval(fetchData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const percentage = totalStaff > 0 ? Math.round((notCheckedIn.length / totalStaff) * 100) : 0;
  const isHighAbsence = percentage > 50;

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-title-primary">
            <Users className="h-5 w-5" />
            Belum Absen Hari Ini
          </CardTitle>
          <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Warning Banner */}
        {isHighAbsence && (
          <div className="flex items-center gap-3 p-4 bg-destructive/10 border border-destructive/30 rounded-lg">
            <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
            <div>
              <p className="font-medium text-destructive">Perhatian!</p>
              <p className="text-sm text-muted-foreground">
                {percentage}% staff belum melakukan absensi hari ini ({notCheckedIn.length} dari {totalStaff} orang)
              </p>
            </div>
          </div>
        )}

        {/* Summary */}
        <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-lg">
          <div className="flex-1">
            <p className="text-sm text-muted-foreground">Belum Absen</p>
            <p className="text-2xl font-bold text-destructive">{notCheckedIn.length}</p>
          </div>
          <div className="flex-1">
            <p className="text-sm text-muted-foreground">Total Staff</p>
            <p className="text-2xl font-bold text-foreground">{totalStaff}</p>
          </div>
          <div className="flex-1">
            <p className="text-sm text-muted-foreground">Sudah Absen</p>
            <p className="text-2xl font-bold text-primary">{totalStaff - notCheckedIn.length}</p>
          </div>
        </div>

        {/* Grouped List */}
        {loading ? (
          <div className="text-center py-8 text-muted-foreground">Loading...</div>
        ) : notCheckedIn.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-4xl mb-2">🎉</div>
            <p className="font-medium text-foreground">Semua staff sudah absen!</p>
            <p className="text-sm text-muted-foreground">Kehadiran 100% hari ini</p>
          </div>
        ) : (
          <Accordion type="multiple" className="w-full">
            {Object.entries(groupedByArea)
              .sort(([, a], [, b]) => b.length - a.length)
              .map(([area, staffList]) => (
                <AccordionItem key={area} value={area}>
                  <AccordionTrigger className="hover:no-underline">
                    <div className="flex items-center gap-3">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{area}</span>
                      <Badge variant="destructive" className="ml-2">
                        {staffList.length} orang
                      </Badge>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-2 pl-7">
                      {staffList.map(staff => (
                        <div 
                          key={staff.uid} 
                          className="flex items-center justify-between p-2 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                        >
                          <div>
                            <p className="font-medium text-sm text-foreground">{staff.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {staff.position} {staff.division && `• ${staff.division}`}
                            </p>
                          </div>
                          <Badge variant="outline" className="text-xs">
                            {staff.uid}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
          </Accordion>
        )}
      </CardContent>
    </Card>
  );
};

export default NotCheckedInList;
