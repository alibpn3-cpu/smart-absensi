import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Camera, MapPin, Clock, CheckCircle, Calendar, Users, Globe } from 'lucide-react';
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
  const [filteredStaffUsers, setFilteredStaffUsers] = useState<StaffUser[]>([]);
  const [selectedStaff, setSelectedStaff] = useState<StaffUser | null>(null);
  const [selectedWorkArea, setSelectedWorkArea] = useState<string>('all');
  const [workAreas, setWorkAreas] = useState<string[]>([]);
  const [attendanceStatus, setAttendanceStatus] = useState<'wfo' | 'wfh' | 'dinas'>('wfo');
  const [reason, setReason] = useState('');
  const [showCamera, setShowCamera] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number; address: string; coordinates: string } | null>(null);
  const [todayAttendance, setTodayAttendance] = useState<AttendanceRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [currentDateTime, setCurrentDateTime] = useState(new Date());
  const [permissions, setPermissions] = useState<PermissionsState>({ location: false, camera: false });
  const [timezone, setTimezone] = useState('WIB');
  const [wfoLocationName, setWfoLocationName] = useState<string | null>(null);

  useEffect(() => {
    fetchStaffUsers();
    checkStoredPermissions();
    loadSavedStaff();
    fetchTimezone();
    
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
        title: "Gagal",
        description: "Gagal memuat data staff",
        variant: "destructive"
      });
    } else {
      const staff = data || [];
      setStaffUsers(staff);
      setFilteredStaffUsers(staff);
      
      // Extract unique work areas
      const areas = [...new Set(staff.map(s => s.work_area))].sort();
      setWorkAreas(areas);
    }
  };

  const fetchTimezone = async () => {
    try {
      const { data } = await supabase
        .from('app_settings')
        .select('setting_value')
        .eq('setting_key', 'app_timezone')
        .single();
      
      if (data?.setting_value) {
        setTimezone(data.setting_value);
      }
    } catch (error) {
      console.log('Timezone setting not found, using default WIB');
    }
  };

  const formatTimeWithTimezone = (date: Date, tz: string) => {
    const timeZoneOffsets = {
      'WIB': 7,   // UTC+7
      'WITA': 8,  // UTC+8  
      'WIT': 9    // UTC+9
    };
    
    const offset = timeZoneOffsets[tz as keyof typeof timeZoneOffsets] || 7;
    const utc = date.getTime() + (date.getTimezoneOffset() * 60000);
    const localTime = new Date(utc + (offset * 3600000));
    
    const hours = localTime.getHours().toString().padStart(2, '0');
    const minutes = localTime.getMinutes().toString().padStart(2, '0');
    
    return `${hours}:${minutes} ${tz}`;
  };

  const getTimeForTimezone = (date: Date, tz: string) => {
    const timeZoneOffsets = {
      'WIB': 7,   // UTC+7
      'WITA': 8,  // UTC+8  
      'WIT': 9    // UTC+9
    };
    
    const offset = timeZoneOffsets[tz as keyof typeof timeZoneOffsets] || 7;
    const utc = date.getTime() + (date.getTimezoneOffset() * 60000);
    const localTime = new Date(utc + (offset * 3600000));
    
    return {
      hours: localTime.getHours(),
      minutes: localTime.getMinutes(),
      seconds: localTime.getSeconds()
    };
  };

  const updateTimezone = async (newTimezone: string) => {
    try {
      const { error } = await supabase
        .from('app_settings')
        .upsert({
          setting_key: 'app_timezone',
          setting_value: newTimezone,
          description: 'Application timezone for clock display'
        }, {
          onConflict: 'setting_key'
        });

      if (error) throw error;

      setTimezone(newTimezone);
      toast({
        title: "Berhasil",
        description: `Timezone berhasil diubah ke ${newTimezone}`
      });
    } catch (error) {
      toast({
        title: "Gagal",
        description: "Gagal mengubah timezone",
        variant: "destructive"
      });
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

  const generateLocationCode = (lat: number, lng: number): string => {
    // Simple GPS coordinate format instead of faulty Plus Code generation
    return `GPS: ${lat.toFixed(6)}, ${lng.toFixed(6)}`;
  };

  const getAddressFromCoords = async (lat: number, lng: number): Promise<{ address: string; coordinates: string }> => {
    console.log(`🔍 Fetching address for coordinates: ${lat}, ${lng}`);
    
    try {
      // Generate location code for the coordinates
      const locationCode = generateLocationCode(lat, lng);
      console.log(`📍 Generated Location Code: ${locationCode}`);
      
      let detailedAddress = '';
      
      // Try OpenStreetMap Nominatim first (more detailed for Indonesia)
      try {
        console.log('🌐 Trying OpenStreetMap Nominatim...');
        const nominatimResponse = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1&accept-language=id&zoom=18`,
          {
            headers: {
              'User-Agent': 'AttendanceApp/1.0'
            }
          }
        );
        
        if (nominatimResponse.ok) {
          const nominatimData = await nominatimResponse.json();
          console.log('🗺️ Nominatim response:', nominatimData);
          
          if (nominatimData.address) {
            const addr = nominatimData.address;
            const addressParts = [];
            
            // Build detailed address - Indonesian format
            if (addr.house_number && addr.road) {
              addressParts.push(`${addr.road} No.${addr.house_number}`);
            } else if (addr.road) {
              addressParts.push(addr.road);
            }
            
            // Add more detailed components
            if (addr.hamlet) addressParts.push(addr.hamlet);
            if (addr.neighbourhood) addressParts.push(addr.neighbourhood);
            if (addr.village) addressParts.push(addr.village);
            if (addr.suburb) addressParts.push(addr.suburb);
            
            // Administrative levels
            if (addr.city_district || addr.county) {
              addressParts.push(addr.city_district || addr.county);
            }
            
            if (addr.city) addressParts.push(addr.city);
            else if (addr.town) addressParts.push(addr.town);
            else if (addr.municipality) addressParts.push(addr.municipality);
            
            if (addr.state) addressParts.push(addr.state);
            
            // Postal code - very important!
            if (addr.postcode) {
              addressParts.push(addr.postcode);
            }
            
            if (addressParts.length > 0) {
              detailedAddress = addressParts.join(', ');
              console.log('✅ Built detailed address from Nominatim:', detailedAddress);
            }
          }
          
          // If no detailed address, try display_name
          if (!detailedAddress && nominatimData.display_name) {
            detailedAddress = nominatimData.display_name;
            console.log('📝 Using display_name from Nominatim:', detailedAddress);
          }
        }
      } catch (nominatimError) {
        console.log('❌ Nominatim failed:', nominatimError);
      }
      
      // Fallback to BigDataCloud if Nominatim didn't work
      if (!detailedAddress) {
        try {
          console.log('🌐 Trying BigDataCloud as fallback...');
          const bigDataResponse = await fetch(
            `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=id`
          );
          
          if (bigDataResponse.ok) {
            const bigDataData = await bigDataResponse.json();
            console.log('🌍 BigDataCloud response:', bigDataData);
            
            const addressComponents = [];
            
            if (bigDataData.locality) addressComponents.push(bigDataData.locality);
            if (bigDataData.localityInfo?.administrative?.[3]?.name) {
              addressComponents.push(bigDataData.localityInfo.administrative[3].name);
            }
            if (bigDataData.localityInfo?.administrative?.[2]?.name) {
              addressComponents.push(bigDataData.localityInfo.administrative[2].name);
            }
            if (bigDataData.city) addressComponents.push(bigDataData.city);
            if (bigDataData.principalSubdivision) addressComponents.push(bigDataData.principalSubdivision);
            
            // Try to get postal code from BigDataCloud
            if (bigDataData.postcode) {
              addressComponents.push(bigDataData.postcode);
            }
            
            if (addressComponents.length > 0) {
              detailedAddress = addressComponents.join(', ');
              console.log('✅ Built address from BigDataCloud:', detailedAddress);
            }
          }
        } catch (bigDataError) {
          console.log('❌ BigDataCloud failed:', bigDataError);
        }
      }
      
      // Third fallback - try LocationIQ
      if (!detailedAddress) {
        try {
          console.log('🌐 Trying LocationIQ as second fallback...');
          const locationIqResponse = await fetch(
            `https://us1.locationiq.com/v1/reverse.php?key=pk.locationiq.default_pk&lat=${lat}&lon=${lng}&format=json&addressdetails=1&accept-language=id`
          );
          
          if (locationIqResponse.ok) {
            const locationIqData = await locationIqResponse.json();
            console.log('🌍 LocationIQ response:', locationIqData);
            
            if (locationIqData.address) {
              const addr = locationIqData.address;
              const addressParts = [];
              
              if (addr.road) addressParts.push(addr.road);
              if (addr.neighbourhood) addressParts.push(addr.neighbourhood);
              if (addr.suburb) addressParts.push(addr.suburb);
              if (addr.city) addressParts.push(addr.city);
              if (addr.state) addressParts.push(addr.state);
              if (addr.postcode) addressParts.push(addr.postcode);
              
              if (addressParts.length > 0) {
                detailedAddress = addressParts.join(', ');
                console.log('✅ Built address from LocationIQ:', detailedAddress);
              }
            }
          }
        } catch (locationIqError) {
          console.log('❌ LocationIQ failed:', locationIqError);
        }
      }
      
      // Final fallback
      if (!detailedAddress) {
        detailedAddress = `Koordinat ${lat.toFixed(6)}, ${lng.toFixed(6)}`;
        console.log('⚠️ Using coordinate fallback');
      }
      
      // Include location code in the address
      const fullAddress = `${locationCode} - ${detailedAddress}`;
      const coordinates = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
      
      console.log('📍 Final address:', fullAddress);
      
      return {
        address: fullAddress,
        coordinates: coordinates
      };
    } catch (error) {
      console.error('❌ All geocoding attempts failed:', error);
      const locationCode = generateLocationCode(lat, lng);
      const coordinates = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
      return {
        address: `${locationCode} - Lokasi tidak dikenal`,
        coordinates: coordinates
      };
    }
  };

  const checkGeofence = async (lat: number, lng: number): Promise<{ isInGeofence: boolean; geofenceName?: string }> => {
    if (attendanceStatus !== 'wfo') return { isInGeofence: true };

    const { data: geofences, error } = await supabase
      .from('geofence_areas')
      .select('*')
      .eq('is_active', true);

    if (error || !geofences) return { isInGeofence: true };

    for (const geofence of geofences) {
      if (geofence.center_lat && geofence.center_lng && geofence.radius) {
        const distance = calculateDistance(
          lat, lng, 
          parseFloat(geofence.center_lat.toString()), 
          parseFloat(geofence.center_lng.toString())
        );
        
        if (distance <= geofence.radius) {
          return { isInGeofence: true, geofenceName: geofence.name };
        }
      }
    }

    return { isInGeofence: false };
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

  const handleWorkAreaSelect = (area: string) => {
    setSelectedWorkArea(area);
    if (area === 'all') {
      setFilteredStaffUsers(staffUsers);
    } else {
      setFilteredStaffUsers(staffUsers.filter(staff => staff.work_area === area));
    }
    // Clear selected staff if not in new filtered list
    if (selectedStaff && area !== 'all' && selectedStaff.work_area !== area) {
      setSelectedStaff(null);
    }
  };

  const handlePhotoCapture = async (photoBlob: Blob) => {
    if (!selectedStaff || !currentLocation) return;

    setLoading(true);
    try {
      // Check geofence for WFO status and get geofence name
      let locationAddress = currentLocation.address;
      if (attendanceStatus === 'wfo') {
        const geofenceResult = await checkGeofence(currentLocation.lat, currentLocation.lng);
        if (!geofenceResult.isInGeofence) {
          toast({
            title: "Error Lokasi",
            description: "Anda harus berada di dalam area kantor untuk absen WFO",
            variant: "destructive"
          });
          setLoading(false);
          return;
        }
        // Use geofence name as location for WFO status
        locationAddress = geofenceResult.geofenceName || currentLocation.address;
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
        location_address: locationAddress,
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
        title: "Berhasil",
        description: `Berhasil ${isCheckOut ? 'check out' : 'check in'}!`
      });

      setShowCamera(false);
      setReason('');
      fetchTodayAttendance();
    } catch (error) {
      console.error('Error saving attendance:', error);
      toast({
        title: "Gagal",
        description: "Gagal menyimpan catatan absensi",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAttendanceAction = async () => {
    if (!selectedStaff) {
      toast({
        title: "Gagal",
        description: "Silakan pilih nama staff",
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
        title: "Error Lokasi", 
        description: "Silakan aktifkan akses lokasi untuk melanjutkan",
        variant: "destructive"
      });
    }
  };

  // Clear app cache/cookies and SW, then reload
  const handleClearCache = async () => {
    try {
      localStorage.clear();
      sessionStorage.clear();
      // Delete cookies
      document.cookie.split(';').forEach((c) => {
        const eqPos = c.indexOf('=');
        const name = eqPos > -1 ? c.substr(0, eqPos) : c;
        document.cookie = name.trim() + '=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/';
      });
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.unregister()));
      }
      toast({ title: 'Berhasil', description: 'Cache & cookies dibersihkan. Memuat ulang...' });
    } catch (e) {
      toast({ title: 'Gagal', description: 'Tidak dapat membersihkan cache', variant: 'destructive' });
    } finally {
      setTimeout(() => window.location.reload(), 500);
    }
  };

  // Compute geofence name for today attendance display (WFO)
  useEffect(() => {
    const run = async () => {
      if (todayAttendance?.status === 'wfo' && todayAttendance.location_lat && todayAttendance.location_lng) {
        const { data: geofences } = await supabase
          .from('geofence_areas')
          .select('*')
          .eq('is_active', true);
        if (geofences && geofences.length) {
          const lat = Number(todayAttendance.location_lat);
          const lng = Number(todayAttendance.location_lng);
          for (const g of geofences as any[]) {
            if (g.center_lat && g.center_lng && g.radius) {
              const d = calculateDistance(
                lat,
                lng,
                parseFloat(g.center_lat.toString()),
                parseFloat(g.center_lng.toString())
              );
              if (d <= g.radius) {
                setWfoLocationName(g.name as string);
                return;
              }
            }
          }
        }
      }
      setWfoLocationName(null);
    };
    run();
  }, [todayAttendance]);

  const isCheckedIn = todayAttendance?.check_in_time && !todayAttendance?.check_out_time;
  const isCompleted = todayAttendance?.check_in_time && todayAttendance?.check_out_time;

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-md mx-auto space-y-6 animate-fade-in">
        {/* Header with Date/Time */}
        <Card className="bg-card border shadow-lg">
          <CardHeader className="text-center pb-4">
            <div className="space-y-3">
              {/* Row 1: Analog Clock + Date */}
              <div className="flex items-center justify-center gap-4">
                {/* Analog Clock */}
                <div className="relative w-20 h-20 rounded-full border-2 border-primary bg-card shadow-sm flex-shrink-0">
                  {/* Clock face dots */}
                  <div className="absolute top-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-primary rounded-full" />
                  <div className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-primary rounded-full" />
                  <div className="absolute top-1/2 left-1 -translate-y-1/2 w-1.5 h-1.5 bg-primary rounded-full" />
                  <div className="absolute top-1/2 right-1 -translate-y-1/2 w-1.5 h-1.5 bg-primary rounded-full" />
                  
                  {/* Center dot */}
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 bg-primary rounded-full z-10" />
                  
                  {/* Hour hand */}
                  <div 
                    className="absolute top-1/2 left-1/2 w-1 bg-primary rounded-full origin-bottom transition-transform duration-1000"
                    style={{ 
                      height: '35%',
                      transform: `translate(-50%, -100%) rotate(${((getTimeForTimezone(currentDateTime, timezone).hours % 12) * 30) + (getTimeForTimezone(currentDateTime, timezone).minutes * 0.5)}deg)`
                    }}
                  />
                  
                  {/* Minute hand */}
                  <div 
                    className="absolute top-1/2 left-1/2 w-1 bg-primary rounded-full origin-bottom transition-transform duration-1000"
                    style={{ 
                      height: '45%',
                      transform: `translate(-50%, -100%) rotate(${getTimeForTimezone(currentDateTime, timezone).minutes * 6}deg)`
                    }}
                  />
                  
                  {/* Second hand */}
                  <div 
                    className="absolute top-1/2 left-1/2 w-px bg-destructive rounded-full origin-bottom transition-transform duration-1000"
                    style={{ 
                      height: '45%',
                      transform: `translate(-50%, -100%) rotate(${getTimeForTimezone(currentDateTime, timezone).seconds * 6}deg)`
                    }}
                  />
                </div>

                {/* Date */}
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  {currentDateTime.toLocaleDateString('id-ID', { 
                    weekday: 'long', 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                  })}
                </div>
              </div>

              {/* Row 2: Digital Time */}
              <div className="flex items-center justify-center gap-3">
                <div className="text-2xl font-bold text-primary">
                  {formatTimeWithTimezone(currentDateTime, timezone)}
                </div>
                <Select value={timezone} onValueChange={updateTimezone}>
                  <SelectTrigger className="p-1 h-8 w-8 border-0 bg-transparent hover:bg-accent rounded-full">
                    <Globe className="h-4 w-4" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="WIB">WIB (UTC+7)</SelectItem>
                    <SelectItem value="WITA">WITA (UTC+8)</SelectItem>
                    <SelectItem value="WIT">WIT (UTC+9)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
        </Card>

        <Card className="border-0 shadow-xl animate-slide-up">
          <CardContent className="space-y-6 p-6">
            {/* Work Area Selection */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-primary" />
                <label className="text-sm font-semibold">Area Tugas</label>
              </div>
              
              <Select
                onValueChange={handleWorkAreaSelect} 
                value={selectedWorkArea}
              >
                <SelectTrigger className="h-12 border-2 hover:border-primary transition-colors">
                  <SelectValue placeholder="Pilih area tugas..." />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border shadow-lg max-h-60 overflow-hidden z-50">
                  <SelectItem value="all" className="cursor-pointer hover:bg-accent/50 focus:bg-accent/50 px-3 py-2 text-popover-foreground font-semibold">
                    🌍 Semua Area
                  </SelectItem>
                  {workAreas.map((area) => (
                    <SelectItem 
                      key={area} 
                      value={area}
                      className="cursor-pointer hover:bg-accent/50 focus:bg-accent/50 px-3 py-2 text-popover-foreground"
                    >
                      📍 {area}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

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
              
              <Select
                onValueChange={handleStaffSelect} 
                value={selectedStaff?.uid || ''}
              >
                <SelectTrigger className="h-12 border-2 hover:border-primary transition-colors">
                  <SelectValue placeholder="Pilih nama staff..." />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border shadow-lg max-h-60 overflow-hidden z-50">
                  <div className="max-h-40 overflow-y-auto">
                    {filteredStaffUsers.length === 0 ? (
                      <div className="p-3 text-center text-muted-foreground text-sm">
                        {selectedWorkArea === 'all' ? 'Tidak ada data staff' : `Tidak ada staff di area ${selectedWorkArea}`}
                      </div>
                    ) : (
                      filteredStaffUsers.map((staff) => (
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
                      <span className="font-medium text-xs mb-2 block">
                        {todayAttendance.status === 'wfo' && wfoLocationName ? wfoLocationName : (todayAttendance.location_address || '-')}
                      </span>
                      <span className="text-muted-foreground block text-xs">Koordinat:</span>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">
                          📍 {todayAttendance.location_lat}, {todayAttendance.location_lng}
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

        <div className="text-center text-xs text-muted-foreground mt-2 space-y-2">
          <div>Versi Aplikasi: v1.0.5 IT Dept. 2025</div>
          <Button variant="outline" size="sm" onClick={handleClearCache}>
            Update (Hapus Cache)
          </Button>
        </div>

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
