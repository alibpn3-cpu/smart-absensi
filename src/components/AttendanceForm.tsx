import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Camera, MapPin, Clock, CheckCircle, Calendar, Users, Globe, User } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import CameraCapture from './CameraCapture';
import BirthdayCard from './BirthdayCard';
import { format } from 'date-fns';

interface StaffUser {
  uid: string;
  name: string;
  position: string;
  work_area: string;
  photo_url?: string;
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
  const [showCheckoutReasonDialog, setShowCheckoutReasonDialog] = useState(false);
  const [checkoutReason, setCheckoutReason] = useState('');
  const [pendingCheckoutLocation, setPendingCheckoutLocation] = useState<{ lat: number; lng: number; address: string; coordinates: string } | null>(null);
  
  // Auto-detect timezone from device
  const getDeviceTimezone = () => {
    const stored = localStorage.getItem('user_timezone');
    if (stored) return stored;

    const offset = -new Date().getTimezoneOffset() / 60;
    let detectedTz = 'WIB';
    
    if (offset >= 8.5) detectedTz = 'WIT';
    else if (offset >= 7.5) detectedTz = 'WITA';
    else detectedTz = 'WIB';
    
    localStorage.setItem('user_timezone', detectedTz);
    return detectedTz;
  };

  const [timezone] = useState(getDeviceTimezone());
  const [wfoLocationName, setWfoLocationName] = useState<string | null>(null);

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


  const getTimezoneOffset = (tz: string): number => {
    const timeZoneOffsets = {
      'WIB': 7,   // UTC+7
      'WITA': 8,  // UTC+8  
      'WIT': 9    // UTC+9
    };
    return timeZoneOffsets[tz as keyof typeof timeZoneOffsets] || 7;
  };

  const formatTimeWithTimezone = (date: Date, tz: string) => {
    const offset = getTimezoneOffset(tz);
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


  const fetchTodayAttendance = async () => {
    if (!selectedStaff) return;

    // Use device-local date (YYYY-MM-DD) to match records created in local timezone
    const nowLocal = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const today = `${nowLocal.getFullYear()}-${pad(nowLocal.getMonth() + 1)}-${pad(nowLocal.getDate())}`;
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
    if (!selectedStaff || !currentLocation) {
      console.error('❌ Missing required data:', { selectedStaff, currentLocation });
      return;
    }

    setLoading(true);
    console.log('📸 Starting attendance submission for:', selectedStaff.name);
    
    try {
      // Check geofence for WFO status and get geofence name
      let locationAddress = currentLocation.address;
      const isCheckOut = todayAttendance?.check_in_time && !todayAttendance?.check_out_time;
      
      if (attendanceStatus === 'wfo') {
        console.log('🏢 Checking WFO geofence for location:', currentLocation.lat, currentLocation.lng);
        const geofenceResult = await checkGeofence(currentLocation.lat, currentLocation.lng);
        console.log('📍 Geofence check result:', geofenceResult);
        
        // For CHECK-IN: Must be inside geofence
        if (!isCheckOut && !geofenceResult.isInGeofence) {
          console.error('❌ Not in geofence area for check-in');
          toast({
            title: "Error Lokasi",
            description: "Anda harus berada di dalam area kantor untuk check in WFO",
            variant: "destructive"
          });
          setLoading(false);
          return;
        }
        
        // For CHECK-OUT: If outside geofence, use the stored reason from dialog
        if (isCheckOut && !geofenceResult.isInGeofence) {
          console.log('📝 Checkout outside geofence, using reason:', checkoutReason);
          // Use the reason provided in the dialog
        } else {
          // Inside geofence, use geofence name
          if (geofenceResult.geofenceName) {
            locationAddress = geofenceResult.geofenceName;
            console.log('✅ Using geofence name:', locationAddress);
          } else {
            console.warn('⚠️ No geofence name found, using address');
          }
        }
      }

      // Upload photo to Supabase Storage
      const fileName = `${selectedStaff.uid}_${Date.now()}.jpg`;
      console.log('📤 Uploading photo:', fileName);
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('attendance-photos')
        .upload(fileName, photoBlob);

      if (uploadError) {
        console.error('❌ Photo upload error:', uploadError);
        throw uploadError;
      }
      console.log('✅ Photo uploaded:', uploadData.path);

      // Save attendance record with full local timestamp including timezone offset, e.g. 2025-10-03 10:02:40.123+08:00
      const now = new Date();
      const pad = (n: number) => String(n).padStart(2, '0');
      const y = now.getFullYear();
      const M = pad(now.getMonth() + 1);
      const d = pad(now.getDate());
      const h = pad(now.getHours());
      const m = pad(now.getMinutes());
      const s = pad(now.getSeconds());
      const ms = String(now.getMilliseconds()).padStart(3, '0');
      const tzMin = -now.getTimezoneOffset();
      const sign = tzMin >= 0 ? '+' : '-';
      const offH = pad(Math.floor(Math.abs(tzMin) / 60));
      const offM = pad(Math.abs(tzMin) % 60);
      const formattedTime = `${y}-${M}-${d} ${h}:${m}:${s}.${ms}${sign}${offH}:${offM}`;
      const localDateStr = `${y}-${M}-${d}`;
      
      // Use the checkout reason if it was set (for WFO checkout outside geofence)
      const finalReason = checkoutReason || reason || null;
      
      const attendanceData = {
        staff_uid: selectedStaff.uid,
        staff_name: selectedStaff.name,
        date: localDateStr,
        location_lat: currentLocation.lat,
        location_lng: currentLocation.lng,
        location_address: locationAddress,
        selfie_photo_url: uploadData.path,
        status: attendanceStatus,
        reason: finalReason,
        ...(isCheckOut 
          ? { check_out_time: formattedTime }
          : { check_in_time: formattedTime }
        )
      };

      console.log('💾 Saving attendance data:', attendanceData);

      if (todayAttendance && isCheckOut) {
        // Update existing record for check-out
        console.log('📝 Updating check-out for record:', todayAttendance.id);
        const { error } = await supabase
          .from('attendance_records')
          .update({
            check_out_time: formattedTime,
            selfie_photo_url: uploadData.path
          })
          .eq('id', todayAttendance.id);

        if (error) {
          console.error('❌ Check-out update error:', error);
          throw error;
        }
        console.log('✅ Check-out recorded successfully');
      } else if (!todayAttendance) {
        // Create new record for check-in
        console.log('📝 Creating new check-in record');
        const { error, data } = await supabase
          .from('attendance_records')
          .insert([attendanceData])
          .select();

        if (error) {
          console.error('❌ Check-in insert error:', error);
          throw error;
        }
        console.log('✅ Check-in recorded successfully:', data);
      }

      toast({
        title: "Berhasil",
        description: `Berhasil ${isCheckOut ? 'check out' : 'check in'}! Lokasi: ${locationAddress}`
      });

      setShowCamera(false);
      setReason('');
      setCheckoutReason('');
      setPendingCheckoutLocation(null);
      fetchTodayAttendance();
    } catch (error) {
      console.error('❌ CRITICAL ERROR saving attendance:', error);
      console.error('Error details:', JSON.stringify(error, null, 2));
      toast({
        title: "Gagal",
        description: "Gagal menyimpan catatan absensi. Silakan coba lagi.",
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
      
      // Check if this is WFO checkout and if we're outside geofence
      const isCheckOut = todayAttendance?.check_in_time && !todayAttendance?.check_out_time;
      
      if (attendanceStatus === 'wfo' && isCheckOut) {
        const geofenceResult = await checkGeofence(location.lat, location.lng);
        
        if (!geofenceResult.isInGeofence) {
          // Outside geofence for WFO checkout - show reason dialog
          setPendingCheckoutLocation(location);
          setShowCheckoutReasonDialog(true);
          return;
        }
      }
      
      // Normal flow - inside geofence or not WFO checkout
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

  const handleCheckoutReasonSubmit = () => {
    if (!checkoutReason.trim()) {
      toast({
        title: "Alasan Diperlukan",
        description: "Silakan masukkan alasan checkout WFO di luar kantor",
        variant: "destructive"
      });
      return;
    }
    
    setShowCheckoutReasonDialog(false);
    setCurrentLocation(pendingCheckoutLocation);
    setShowCamera(true);
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

  const formatCheckTime = (s: string | null | undefined) => {
    if (!s) return '-';
    try {
      const d = new Date(s.replace(' ', 'T'));
      if (isNaN(d.getTime())) return s;
      return format(d, 'hh:mm:ss a').toLowerCase();
    } catch {
      return s;
    }
  };

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-md mx-auto space-y-6 animate-fade-in">
        {/* Birthday Card - Shows only when there are birthdays today */}
        <BirthdayCard />
        
        {/* Header with Date/Time */}
        <Card className="bg-card border shadow-lg">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-start gap-6 px-4">
              {/* Analog Clock - Left aligned */}
              <div className="relative w-24 h-24 rounded-full border-2 border-primary bg-card shadow-sm flex-shrink-0">
                {/* Clock numbers 1-12 */}
                {[...Array(12)].map((_, i) => {
                  const hour = i + 1;
                  const angle = (hour * 30 - 90) * (Math.PI / 180);
                  const radius = 36;
                  const x = radius * Math.cos(angle);
                  const y = radius * Math.sin(angle);
                  return (
                    <div
                      key={hour}
                      className="absolute text-[8px] font-semibold text-primary"
                      style={{
                        left: `calc(50% + ${x}px)`,
                        top: `calc(50% + ${y}px)`,
                        transform: 'translate(-50%, -50%)'
                      }}
                    >
                      {hour}
                    </div>
                  );
                })}
                
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

              {/* Date and Digital Time - Stacked vertically */}
              <div className="flex flex-col gap-2">
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

                {/* Digital Time */}
                <div className="flex items-center gap-3">
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-xl font-bold text-primary">
                      {formatTimeWithTimezone(currentDateTime, timezone).split(' ')[0]}
                    </span>
                    <span className="text-xs font-medium text-muted-foreground">
                      {formatTimeWithTimezone(currentDateTime, timezone).split(' ')[1]}
                    </span>
                  </div>
                </div>
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
                <div className="flex gap-3">
                  {/* Staff Photo - Box Frame */}
                  <div className="flex-shrink-0">
                    <div className="w-10 h-10 border-2 border-primary rounded overflow-hidden bg-primary/10 flex items-center justify-center">
                      {selectedStaff.photo_url ? (
                        <img src={selectedStaff.photo_url} alt={selectedStaff.name} className="w-full h-full object-cover" />
                      ) : (
                        <User className="w-5 h-5 text-primary" />
                      )}
                    </div>
                  </div>
                  
                  {/* Staff Details */}
                  <div className="flex-1 space-y-3">
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
                        {formatCheckTime(todayAttendance.check_in_time as string)}
                      </span>
                    </div>
                  )}
                  {todayAttendance.check_out_time && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Check Out:</span>
                      <span className="font-medium">
                        {formatCheckTime(todayAttendance.check_out_time as string)}
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

        {/* Checkout Reason Dialog - WFO outside geofence */}
        <Dialog open={showCheckoutReasonDialog} onOpenChange={setShowCheckoutReasonDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Checkout WFO di Luar Area Kantor</DialogTitle>
              <DialogDescription>
                Anda berada di luar area geofence kantor. Silakan masukkan alasan checkout WFO di luar kantor.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2 py-4">
              <Textarea
                placeholder="Masukkan alasan checkout di luar kantor..."
                value={checkoutReason}
                onChange={(e) => setCheckoutReason(e.target.value)}
                rows={4}
                className="w-full"
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => {
                setShowCheckoutReasonDialog(false);
                setCheckoutReason('');
                setPendingCheckoutLocation(null);
              }}>
                Batal
              </Button>
              <Button onClick={handleCheckoutReasonSubmit}>
                Lanjutkan
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Camera Modal */}
        {showCamera && (
          <CameraCapture
            onCapture={handlePhotoCapture}
            onClose={() => {
              setShowCamera(false);
              setCheckoutReason('');
              setPendingCheckoutLocation(null);
            }}
            loading={loading}
          />
        )}
      </div>
    </div>
  );
};

export default AttendanceForm;
