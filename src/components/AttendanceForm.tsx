import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Camera, MapPin, Clock, CheckCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import CameraCapture from './CameraCapture';

interface StaffUser {
  uid: string;
  name: string;
  position: string;
  work_area: string;
}

interface AttendanceRecord {
  id: string;
  check_in_time: string | null;
  check_out_time: string | null;
  status: 'wfo' | 'wfh' | 'dinas';
  location_address: string | null;
}

const AttendanceForm = () => {
  const [staffUsers, setStaffUsers] = useState<StaffUser[]>([]);
  const [selectedStaff, setSelectedStaff] = useState<StaffUser | null>(null);
  const [attendanceStatus, setAttendanceStatus] = useState<'wfo' | 'wfh' | 'dinas'>('wfo');
  const [reason, setReason] = useState('');
  const [showCamera, setShowCamera] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number; address: string } | null>(null);
  const [todayAttendance, setTodayAttendance] = useState<AttendanceRecord | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchStaffUsers();
  }, []);

  useEffect(() => {
    if (selectedStaff) {
      fetchTodayAttendance();
    }
  }, [selectedStaff]);

  const fetchStaffUsers = async () => {
    const { data, error } = await supabase
      .from('staff_users')
      .select('*')
      .eq('is_active', true)
      .order('name');

    if (error) {
      toast({
        title: "Error",
        description: "Failed to load staff data",
        variant: "destructive"
      });
    } else {
      setStaffUsers(data || []);
    }
  };

  const fetchTodayAttendance = async () => {
    if (!selectedStaff) return;

    const today = new Date().toISOString().split('T')[0];
    const { data, error } = await supabase
      .from('attendance_records')
      .select('*')
      .eq('staff_uid', selectedStaff.uid)
      .eq('date', today)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching attendance:', error);
    } else {
      setTodayAttendance(data as AttendanceRecord);
    }
  };

  const getCurrentLocation = (): Promise<{ lat: number; lng: number; address: string }> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation not supported'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          
          try {
            // Use reverse geocoding to get address
            const response = await fetch(
              `https://api.opencagedata.com/geocode/v1/json?q=${lat}+${lng}&key=demo_key&limit=1`
            );
            const data = await response.json();
            const address = data.results?.[0]?.formatted || `${lat}, ${lng}`;
            
            resolve({ lat, lng, address });
          } catch (error) {
            resolve({ lat, lng, address: `${lat}, ${lng}` });
          }
        },
        (error) => reject(error),
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 }
      );
    });
  };

  const checkGeofence = async (lat: number, lng: number): Promise<boolean> => {
    if (attendanceStatus !== 'wfo') return true;

    const { data: geofences, error } = await supabase
      .from('geofence_areas')
      .select('*')
      .eq('is_active', true);

    if (error || !geofences) return true;

    for (const geofence of geofences) {
      if (geofence.center_lat && geofence.center_lng && geofence.radius) {
        const distance = calculateDistance(
          lat, lng, 
          parseFloat(geofence.center_lat.toString()), 
          parseFloat(geofence.center_lng.toString())
        );
        
        if (distance <= geofence.radius) {
          return true;
        }
      }
    }

    return false;
  };

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = lat1 * Math.PI/180;
    const φ2 = lat2 * Math.PI/180;
    const Δφ = (lat2-lat1) * Math.PI/180;
    const Δλ = (lon2-lon1) * Math.PI/180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c;
  };

  const handleStaffSelect = (staffUid: string) => {
    const staff = staffUsers.find(s => s.uid === staffUid);
    setSelectedStaff(staff || null);
  };

  const handlePhotoCapture = async (photoBlob: Blob) => {
    if (!selectedStaff || !currentLocation) return;

    setLoading(true);
    try {
      // Check geofence for WFO status
      if (attendanceStatus === 'wfo') {
        const isInGeofence = await checkGeofence(currentLocation.lat, currentLocation.lng);
        if (!isInGeofence) {
          toast({
            title: "Location Error",
            description: "You must be within the office area to check in for WFO",
            variant: "destructive"
          });
          setLoading(false);
          return;
        }
      }

      // Upload photo to Supabase Storage
      const fileName = `${selectedStaff.uid}_${Date.now()}.jpg`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('attendance-photos')
        .upload(fileName, photoBlob);

      if (uploadError) throw uploadError;

      // Save attendance record
      const isCheckOut = todayAttendance?.check_in_time && !todayAttendance?.check_out_time;
      const attendanceData = {
        staff_uid: selectedStaff.uid,
        staff_name: selectedStaff.name,
        location_lat: currentLocation.lat,
        location_lng: currentLocation.lng,
        location_address: currentLocation.address,
        selfie_photo_url: uploadData.path,
        status: attendanceStatus,
        reason: reason || null,
        ...(isCheckOut 
          ? { check_out_time: new Date().toISOString() }
          : { check_in_time: new Date().toISOString() }
        )
      };

      if (todayAttendance && isCheckOut) {
        // Update existing record for check-out
        const { error } = await supabase
          .from('attendance_records')
          .update({
            check_out_time: new Date().toISOString(),
            selfie_photo_url: uploadData.path
          })
          .eq('id', todayAttendance.id);

        if (error) throw error;
      } else if (!todayAttendance) {
        // Create new record for check-in
        const { error } = await supabase
          .from('attendance_records')
          .insert([attendanceData]);

        if (error) throw error;
      }

      toast({
        title: "Success",
        description: `Successfully ${isCheckOut ? 'checked out' : 'checked in'}!`
      });

      setShowCamera(false);
      setReason('');
      fetchTodayAttendance();
    } catch (error) {
      console.error('Error saving attendance:', error);
      toast({
        title: "Error",
        description: "Failed to save attendance record",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAttendanceAction = async () => {
    if (!selectedStaff) {
      toast({
        title: "Error",
        description: "Please select a staff member",
        variant: "destructive"
      });
      return;
    }

    try {
      const location = await getCurrentLocation();
      setCurrentLocation(location);
      setShowCamera(true);
    } catch (error) {
      toast({
        title: "Location Error", 
        description: "Please enable location access to continue",
        variant: "destructive"
      });
    }
  };

  const isCheckedIn = todayAttendance?.check_in_time && !todayAttendance?.check_out_time;
  const isCompleted = todayAttendance?.check_in_time && todayAttendance?.check_out_time;

  return (
    <div className="max-w-md mx-auto p-4 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-center flex items-center justify-center gap-2">
            <Clock className="h-6 w-6" />
            Smart Zone Absensi
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Staff Selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Nama Staff</label>
            <Select onValueChange={handleStaffSelect}>
              <SelectTrigger>
                <SelectValue placeholder="Pilih nama staff..." />
              </SelectTrigger>
              <SelectContent>
                {staffUsers.map((staff) => (
                  <SelectItem key={staff.uid} value={staff.uid}>
                    {staff.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Staff Info Display */}
          {selectedStaff && (
            <div className="p-3 bg-muted rounded-lg space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">UID:</span>
                <span className="text-sm font-medium">{selectedStaff.uid}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Jabatan:</span>
                <span className="text-sm font-medium">{selectedStaff.position}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Area Tugas:</span>
                <span className="text-sm font-medium">{selectedStaff.work_area}</span>
              </div>
            </div>
          )}

          {/* Attendance Status */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Status Absen</label>
            <Select value={attendanceStatus} onValueChange={(value: 'wfo' | 'wfh' | 'dinas') => setAttendanceStatus(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="wfo">WFO (Work From Office)</SelectItem>
                <SelectItem value="wfh">WFH (Work From Home)</SelectItem>
                <SelectItem value="dinas">Dinas Luar</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Reason */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Alasan Absen (Opsional)</label>
            <Textarea
              placeholder="Masukkan alasan jika diperlukan..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
            />
          </div>

          {/* Current Location Display */}
          {currentLocation && (
            <div className="p-3 bg-secondary rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <MapPin className="h-4 w-4" />
                <span className="text-sm font-medium">Lokasi Saat Ini</span>
              </div>
              <p className="text-xs text-muted-foreground">{currentLocation.address}</p>
            </div>
          )}

          {/* Today's Attendance Status */}
          {todayAttendance && (
            <div className="p-3 bg-primary/10 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Status Hari Ini</span>
                <Badge variant={isCompleted ? "default" : "secondary"}>
                  {isCompleted ? "Selesai" : "Check In"}
                </Badge>
              </div>
              {todayAttendance.check_in_time && (
                <p className="text-xs text-muted-foreground">
                  Check In: {new Date(todayAttendance.check_in_time).toLocaleTimeString('id-ID')}
                </p>
              )}
              {todayAttendance.check_out_time && (
                <p className="text-xs text-muted-foreground">
                  Check Out: {new Date(todayAttendance.check_out_time).toLocaleTimeString('id-ID')}
                </p>
              )}
            </div>
          )}

          {/* Action Button */}
          <Button 
            onClick={handleAttendanceAction}
            disabled={!selectedStaff || loading || !!isCompleted}
            className="w-full"
            size="lg"
          >
            <Camera className="h-4 w-4 mr-2" />
            {isCompleted 
              ? "Absen Hari Ini Selesai" 
              : isCheckedIn 
                ? "Check Out" 
                : "Check In"
            }
          </Button>
        </CardContent>
      </Card>

      {/* Camera Modal */}
      {showCamera && (
        <CameraCapture
          onCapture={handlePhotoCapture}
          onClose={() => setShowCamera(false)}
          loading={loading}
        />
      )}
    </div>
  );
};

export default AttendanceForm;