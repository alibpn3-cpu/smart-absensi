import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Camera, MapPin, Clock, CheckCircle, Calendar, Users, Search } from 'lucide-react';
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
  location_lat: number | null;
  location_lng: number | null;
}

interface PermissionsState {
  location: boolean;
  camera: boolean;
}

const AttendanceForm = () => {
  const [staffUsers, setStaffUsers] = useState<StaffUser[]>([]);
  const [filteredStaff, setFilteredStaff] = useState<StaffUser[]>([]);
  const [selectedStaff, setSelectedStaff] = useState<StaffUser | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [attendanceStatus, setAttendanceStatus] = useState<'wfo' | 'wfh' | 'dinas'>('wfo');
  const [reason, setReason] = useState('');
  const [showCamera, setShowCamera] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number; address: string; coordinates: string } | null>(null);
  const [todayAttendance, setTodayAttendance] = useState<AttendanceRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [currentDateTime, setCurrentDateTime] = useState(new Date());
  const [permissions, setPermissions] = useState<PermissionsState>({ location: false, camera: false });

  useEffect(() => {
    fetchStaffUsers();
    checkStoredPermissions();
    loadSavedStaff();
    
    // Update current time every second
    const timer = setInterval(() => {
      setCurrentDateTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (selectedStaff) {
      fetchTodayAttendance();
      // Save selected staff to localStorage
      localStorage.setItem('last_selected_staff', JSON.stringify(selectedStaff));
    }
  }, [selectedStaff]);

  useEffect(() => {
    // Filter staff based on search query
    if (searchQuery.trim() === '') {
      setFilteredStaff(staffUsers);
    } else {
      const filtered = staffUsers.filter(staff => 
        staff.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        staff.position.toLowerCase().includes(searchQuery.toLowerCase()) ||
        staff.uid.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredStaff(filtered);
    }
  }, [searchQuery, staffUsers]);

  const checkStoredPermissions = () => {
    const storedPermissions = localStorage.getItem('attendance_permissions');
    if (storedPermissions) {
      setPermissions(JSON.parse(storedPermissions));
    }
  };

  const savePermissions = (newPermissions: PermissionsState) => {
    setPermissions(newPermissions);
    localStorage.setItem('attendance_permissions', JSON.stringify(newPermissions));
  };

  const loadSavedStaff = () => {
    const savedStaff = localStorage.getItem('last_selected_staff');
    if (savedStaff) {
      try {
        const staff = JSON.parse(savedStaff);
        setSelectedStaff(staff);
      } catch (error) {
        console.error('Error loading saved staff:', error);
      }
    }
  };

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
      setFilteredStaff(data || []);
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

  const requestLocationPermission = (): Promise<{ lat: number; lng: number; address: string; coordinates: string }> => {
    return new Promise(async (resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation not supported'));
        return;
      }

      // If we already have permission, use it
      if (permissions.location) {
        navigator.geolocation.getCurrentPosition(
          async (position) => {
            const lat = position.coords.latitude;
            const lng = position.coords.longitude;
            const locationData = await getAddressFromCoords(lat, lng);
            resolve({ lat, lng, address: locationData.address, coordinates: locationData.coordinates });
          },
          (error) => reject(error),
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 }
        );
        return;
      }

      // Request permission for the first time
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          const locationData = await getAddressFromCoords(lat, lng);
          
          // Save permission
          savePermissions({ ...permissions, location: true });
          
          resolve({ lat, lng, address: locationData.address, coordinates: locationData.coordinates });
        },
        (error) => reject(error),
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 }
      );
    });
  };

  const getAddressFromCoords = async (lat: number, lng: number): Promise<{ address: string; coordinates: string }> => {
    try {
      // Using a free geocoding service to get detailed address
      const response = await fetch(
        `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=id`
      );
      const data = await response.json();
      
      // Build detailed address from available data
      let detailedAddress = '';
      
      if (data.localityInfo && data.localityInfo.administrative) {
        const admin = data.localityInfo.administrative;
        // Find street/road info if available
        const roadInfo = admin.find((item: any) => item.order >= 8);
        const districtInfo = admin.find((item: any) => item.order === 7);
        const cityInfo = admin.find((item: any) => item.order === 5);
        const provinceInfo = admin.find((item: any) => item.order === 4);
        
        const addressParts = [];
        if (roadInfo) addressParts.push(roadInfo.name);
        if (districtInfo) addressParts.push(districtInfo.name);
        if (cityInfo) addressParts.push(cityInfo.name);
        if (provinceInfo) addressParts.push(provinceInfo.name);
        
        detailedAddress = addressParts.join(', ');
      }
      
      // Fallback to basic address if detailed not available
      if (!detailedAddress) {
        detailedAddress = data.locality || data.city || `${data.principalSubdivision}, ${data.countryName}` || 'Lokasi tidak diketahui';
      }
      
      const coordinates = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
      
      return {
        address: detailedAddress,
        coordinates: coordinates
      };
    } catch (error) {
      const coordinates = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
      return {
        address: `Koordinat: ${coordinates}`,
        coordinates: coordinates
      };
    }
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
    setSearchQuery(''); // Clear search when staff is selected
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
      const location = await requestLocationPermission();
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
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-md mx-auto space-y-6 animate-fade-in">
        {/* Header with Date/Time */}
        <Card className="bg-card border shadow-lg">
          <CardHeader className="text-center pb-4">
            <div className="space-y-1">
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <Calendar className="h-4 w-4" />
                {currentDateTime.toLocaleDateString('id-ID', { 
                  weekday: 'long', 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                })}
              </div>
              <div className="text-2xl font-bold text-primary">
                {currentDateTime.toLocaleTimeString('id-ID', {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit'
                })}
              </div>
            </div>
          </CardHeader>
        </Card>

        <Card className="border-0 shadow-xl animate-slide-up">
          <CardContent className="space-y-6 p-6">
            {/* Staff Selection */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                <label className="text-sm font-semibold">Nama Staff</label>
                {selectedStaff && (
                  <Badge variant="secondary" className="text-xs">
                    Tersimpan: {selectedStaff.name}
                  </Badge>
                )}
              </div>
              
              <Select onValueChange={handleStaffSelect} value={selectedStaff?.uid || ''}>
                <SelectTrigger className="h-12 border-2 hover:border-primary transition-colors">
                  <SelectValue placeholder="Pilih nama staff..." />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border shadow-lg max-h-60 overflow-hidden z-50">
                  {/* Search Input inside dropdown */}
                  <div className="sticky top-0 bg-popover p-2 border-b border-border z-10">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Cari nama staff..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10 h-8 border text-popover-foreground bg-background"
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => e.stopPropagation()}
                      />
                    </div>
                  </div>
                  <div className="max-h-40 overflow-y-auto">
                    {filteredStaff.length === 0 ? (
                      <div className="p-3 text-center text-muted-foreground text-sm">
                        {searchQuery ? 'Tidak ada staff yang cocok' : 'Tidak ada data staff'}
                      </div>
                    ) : (
                      filteredStaff.map((staff) => (
                        <SelectItem 
                          key={staff.uid} 
                          value={staff.uid}
                          className="cursor-pointer hover:bg-accent/50 focus:bg-accent/50 px-3 py-2 text-popover-foreground"
                        >
                          {staff.name} - {staff.position}
                        </SelectItem>
                      ))
                    )}
                  </div>
                </SelectContent>
              </Select>
            </div>

            {/* Staff Info Display */}
            {selectedStaff && (
              <div className="bg-muted/30 p-4 rounded-lg space-y-3 border">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-muted-foreground block">UID:</span>
                    <span className="font-semibold text-foreground">{selectedStaff.uid}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">Jabatan:</span>
                    <span className="font-semibold text-foreground">{selectedStaff.position}</span>
                  </div>
                </div>
                <div>
                  <span className="text-muted-foreground text-sm block">Area Tugas:</span>
                  <span className="font-semibold text-foreground">{selectedStaff.work_area}</span>
                </div>
              </div>
            )}

            {/* Attendance Status */}
            <div className="space-y-3">
              <label className="text-sm font-semibold">Status Absen</label>
              <Select value={attendanceStatus} onValueChange={(value: 'wfo' | 'wfh' | 'dinas') => setAttendanceStatus(value)}>
                <SelectTrigger className="h-12 border-2 hover:border-primary transition-colors">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border shadow-lg z-50">
                  <SelectItem value="wfo">🏢 WFO (Work From Office)</SelectItem>
                  <SelectItem value="wfh">🏠 WFH (Work From Home)</SelectItem>
                  <SelectItem value="dinas">🚗 Dinas Luar</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Reason */}
            <div className="space-y-3">
              <label className="text-sm font-semibold">Alasan Absen (Opsional)</label>
              <Textarea
                placeholder="Masukkan alasan jika diperlukan..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                className="border-2 hover:border-primary transition-colors resize-none"
              />
            </div>

            {/* Current Location Display */}
            {currentLocation && (
              <div className="p-4 bg-success/10 border border-success/30 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <MapPin className="h-4 w-4 text-success" />
                  <span className="text-sm font-semibold text-success">Lokasi Saat Ini</span>
                </div>
                <p className="text-sm text-success mb-2">{currentLocation.address}</p>
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">
                    📍 {currentLocation.coordinates}
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(
                      `https://www.google.com/maps?q=${currentLocation.lat},${currentLocation.lng}`,
                      '_blank'
                    )}
                    className="text-xs h-6"
                  >
                    🗺️ Lihat di Maps
                  </Button>
                </div>
              </div>
            )}

            {/* Today's Attendance Status */}
            {todayAttendance && (
              <div className="p-4 bg-primary/10 border border-primary/30 rounded-lg">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-semibold">Status Hari Ini</span>
                  <Badge variant={isCompleted ? "default" : "secondary"} className="shadow-glow">
                    {isCompleted ? "✅ Selesai" : "⏰ Check In"}
                  </Badge>
                </div>
                <div className="space-y-2 text-sm">
                  {todayAttendance.check_in_time && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Check In:</span>
                      <span className="font-medium">
                        {new Date(todayAttendance.check_in_time).toLocaleTimeString('id-ID', {
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                          hour12: true
                        })}
                      </span>
                    </div>
                  )}
                  {todayAttendance.check_out_time && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Check Out:</span>
                      <span className="font-medium">
                        {new Date(todayAttendance.check_out_time).toLocaleTimeString('id-ID', {
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                          hour12: true
                        })}
                      </span>
                    </div>
                  )}
                  {todayAttendance.location_address && (
                    <div>
                      <span className="text-muted-foreground block">Lokasi:</span>
                      <span className="font-medium text-xs mb-2 block">{todayAttendance.location_address}</span>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">
                          📍 Koordinat: {todayAttendance.location_lat}, {todayAttendance.location_lng}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => window.open(
                            `https://www.google.com/maps?q=${todayAttendance.location_lat},${todayAttendance.location_lng}`,
                            '_blank'
                          )}
                          className="text-xs h-6"
                        >
                          🗺️ Lihat di Maps
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Action Button */}
            <Button 
              onClick={handleAttendanceAction}
              disabled={!selectedStaff || loading || !!isCompleted}
              className="w-full h-14 text-lg font-semibold gradient-primary border-0 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.02]"
              size="lg"
            >
              <Camera className="h-5 w-5 mr-3" />
              {isCompleted 
                ? "✅ Absen Hari Ini Selesai" 
                : isCheckedIn 
                  ? "📤 Check Out" 
                  : "📥 Check In"
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
    </div>
  );
};

export default AttendanceForm;