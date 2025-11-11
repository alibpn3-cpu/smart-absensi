import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Camera, MapPin, Clock, CheckCircle, Calendar, Users, Globe, User, ChevronsUpDown, Check } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import CameraCapture from './CameraCapture';
import BirthdayCard from './BirthdayCard';
import PermissionIndicators from './PermissionIndicators';
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
  checkin_location_address: string | null;
  checkin_location_lat: number | null;
  checkin_location_lng: number | null;
  checkout_location_address: string | null;
  checkout_location_lat: number | null;
  checkout_location_lng: number | null;
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
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number; address: string; coordinates: string; accuracy?: number } | null>(null);
  const [todayAttendance, setTodayAttendance] = useState<AttendanceRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [currentDateTime, setCurrentDateTime] = useState(new Date());
  const [permissions, setPermissions] = useState<PermissionsState>({ location: false, camera: false });
  const [showCheckoutReasonDialog, setShowCheckoutReasonDialog] = useState(false);
  const [checkoutReason, setCheckoutReason] = useState('');
  const [pendingCheckoutLocation, setPendingCheckoutLocation] = useState<{ lat: number; lng: number; address: string; coordinates: string; accuracy?: number } | null>(null);
  const [isButtonProcessing, setIsButtonProcessing] = useState(false);
  const [cameraAttempts, setCameraAttempts] = useState(0);
  const [bypassCamera, setBypassCamera] = useState(false);
  const [isStaffPopoverOpen, setIsStaffPopoverOpen] = useState(false);
  
  // Audio for button click
  const playClickSound = () => {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.value = 800;
    oscillator.type = 'sine';
    
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.1);
  };
  
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
  }, []);

  useEffect(() => {
    // Store current date for comparison
    let lastDate = new Date().toDateString();
    
    // Update current time every second and check for date change
    const timer = setInterval(() => {
      const now = new Date();
      setCurrentDateTime(now);
      
      // Check if date has changed (midnight reset)
      const currentDate = now.toDateString();
      if (currentDate !== lastDate) {
        console.log('🔄 Date changed, resetting attendance...');
        lastDate = currentDate;
        // Reset attendance data
        setTodayAttendance(null);
        if (selectedStaff) {
          fetchTodayAttendance();
        }
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [selectedStaff]);

  useEffect(() => {
    if (selectedStaff) {
      fetchTodayAttendance();
      // Save selected staff to localStorage
      localStorage.setItem('last_selected_staff', JSON.stringify(selectedStaff));
    }
  }, [selectedStaff]);

  // Load saved attendance status when checking out
  useEffect(() => {
    const isCheckOut = todayAttendance?.check_in_time && !todayAttendance?.check_out_time;
    if (isCheckOut) {
      const savedStatus = localStorage.getItem('attendance_status');
      if (savedStatus && (savedStatus === 'wfo' || savedStatus === 'wfh' || savedStatus === 'dinas')) {
        setAttendanceStatus(savedStatus as 'wfo' | 'wfh' | 'dinas');
      }
    }
  }, [todayAttendance]);


  const checkStoredPermissions = async () => {
    // Check actual browser permissions, not just localStorage
    const actualPermissions = { location: false, camera: false };
    
    // Check location permission
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, { 
          timeout: 5000, 
          maximumAge: 300000 
        });
      });
      actualPermissions.location = true;
      console.log('✅ Location permission granted');
    } catch (error) {
      console.log('❌ Location permission not available');
    }
    
    // Check camera permission
    try {
      const permissionStatus = await navigator.permissions.query({ name: 'camera' as PermissionName });
      if (permissionStatus.state === 'granted') {
        actualPermissions.camera = true;
        console.log('✅ Camera permission granted');
      } else {
        console.log('❌ Camera permission not granted:', permissionStatus.state);
      }
    } catch (error) {
      console.log('❌ Camera permission check failed:', error);
    }
    
    // Update state and save to localStorage
    setPermissions(actualPermissions);
    localStorage.setItem('attendance_permissions', JSON.stringify(actualPermissions));
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

  const checkGeofence = async (lat: number, lng: number, accuracy?: number): Promise<{ isInGeofence: boolean; geofenceName?: string }> => {
    if (attendanceStatus !== 'wfo') return { isInGeofence: true };

    const { data: geofences, error } = await supabase
      .from('geofence_areas')
      .select('*')
      .eq('is_active', true);

    if (error || !geofences) return { isInGeofence: true };

    // Add tolerance for low accuracy (desktop browsers typically have 50-1000m accuracy)
    // If accuracy is poor (>50m), add extra radius tolerance
    const accuracyTolerance = accuracy && accuracy > 50 ? Math.min(accuracy * 0.8, 500) : 0;
    console.log(`📏 Accuracy: ${accuracy}m, adding tolerance: ${accuracyTolerance}m`);

    for (const geofence of geofences) {
      if (geofence.center_lat && geofence.center_lng && geofence.radius) {
        const distance = calculateDistance(
          lat, lng, 
          parseFloat(geofence.center_lat.toString()), 
          parseFloat(geofence.center_lng.toString())
        );
        
        const effectiveRadius = geofence.radius + accuracyTolerance;
        console.log(`📍 Distance to ${geofence.name}: ${distance.toFixed(2)}m (radius: ${geofence.radius}m + tolerance: ${accuracyTolerance.toFixed(0)}m = ${effectiveRadius.toFixed(0)}m)`);
        
        if (distance <= effectiveRadius) {
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
    setIsStaffPopoverOpen(false); // Close popover after selection
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

  const compressThumbnail = (blob: Blob): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(blob);
      
      img.onload = () => {
        URL.revokeObjectURL(url);
        const canvas = document.createElement('canvas');
        
        // Set thumbnail size to very small for storage efficiency
        const maxWidth = 200;
        const maxHeight = 200;
        let width = img.width;
        let height = img.height;
        
        if (width > height) {
          if (width > maxWidth) {
            height = (height / width) * maxWidth;
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = (width / height) * maxHeight;
            height = maxHeight;
          }
        }
        
        canvas.width = width;
        canvas.height = height;
        
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        
        // Convert to JPEG with low quality for small file size
        canvas.toBlob(
          (thumbnailBlob) => {
            if (thumbnailBlob) {
              resolve(thumbnailBlob);
            } else {
              reject(new Error('Failed to create thumbnail'));
            }
          },
          'image/jpeg',
          0.3 // 30% quality for very small file size
        );
      };
      
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Failed to load image'));
      };
      
      img.src = url;
    });
  };

  const handlePhotoCapture = async (photoBlob: Blob) => {
    if (!selectedStaff || !currentLocation) {
      console.error('❌ Missing required data:', { selectedStaff, currentLocation });
      return;
    }

    setLoading(true);
    console.log('📸 Starting attendance submission for:', selectedStaff.name);
    
    try {
      // Check if this is check-out
      const isCheckOut = todayAttendance?.check_in_time && !todayAttendance?.check_out_time;
      
      // Check geofence for WFO status and get geofence name
      let locationAddress = currentLocation.address;
      
      if (attendanceStatus === 'wfo') {
        console.log('🏢 Checking WFO geofence for location:', currentLocation.lat, currentLocation.lng);
        const geofenceResult = await checkGeofence(currentLocation.lat, currentLocation.lng, currentLocation.accuracy);
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

      // Upload photo to Supabase Storage (only for WFH and Dinas WITH photo)
      let photoPath = null;
      if ((attendanceStatus === 'wfh' || attendanceStatus === 'dinas') && photoBlob.size > 0 && !bypassCamera) {
        console.log('📸 Compressing thumbnail for WFH/Dinas...');
        const thumbnailBlob = await compressThumbnail(photoBlob);
        console.log(`📉 Thumbnail size: ${(thumbnailBlob.size / 1024).toFixed(2)}KB (original: ${(photoBlob.size / 1024).toFixed(2)}KB)`);
        
        const fileName = `${selectedStaff.uid}_${Date.now()}.jpg`;
        console.log('📤 Uploading thumbnail:', fileName);
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('attendance-photos')
          .upload(fileName, thumbnailBlob);

        if (uploadError) {
          console.error('❌ Photo upload error:', uploadError);
          throw uploadError;
        }
        photoPath = uploadData.path;
        console.log('✅ Thumbnail uploaded:', photoPath);
      } else if ((attendanceStatus === 'wfh' || attendanceStatus === 'dinas') && bypassCamera) {
        console.log('⚠️ Bypass mode: Skipping photo upload');
        toast({
          title: "ℹ️ Absensi Tanpa Foto",
          description: "Check-in berhasil tanpa foto selfie",
        });
      } else {
        console.log('🏢 WFO mode: Skipping photo upload');
      }

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
        selfie_photo_url: photoPath,
        status: attendanceStatus,
        reason: finalReason,
        ...(isCheckOut 
          ? { 
              check_out_time: formattedTime,
              checkout_location_lat: currentLocation.lat,
              checkout_location_lng: currentLocation.lng,
              checkout_location_address: locationAddress,
              selfie_checkout_url: photoPath
            }
          : { 
              check_in_time: formattedTime,
              checkin_location_lat: currentLocation.lat,
              checkin_location_lng: currentLocation.lng,
              checkin_location_address: locationAddress,
              selfie_checkin_url: photoPath
            }
        )
      };

      console.log('💾 Saving attendance data:', attendanceData);

      if (todayAttendance && isCheckOut) {
        // Update existing record for check-out
        console.log('📝 Updating check-out for record:', todayAttendance.id);
        const updateData: any = {
          check_out_time: formattedTime,
          checkout_location_lat: currentLocation.lat,
          checkout_location_lng: currentLocation.lng,
          checkout_location_address: locationAddress
        };
        
        // Only update photo for WFH/Dinas and save to checkout column
        if (photoPath) {
          updateData.selfie_checkout_url = photoPath;
        }
        
        // Update checkout reason if provided (for WFO outside geofence)
        if (checkoutReason) {
          updateData.reason = checkoutReason;
        }
        
        const { error } = await supabase
          .from('attendance_records')
          .update(updateData)
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
        
        // Save attendance status to localStorage for checkout
        localStorage.setItem('attendance_status', attendanceStatus);
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

  const checkCameraPermission = async (): Promise<boolean> => {
    try {
      const result = await navigator.permissions.query({ name: 'camera' as PermissionName });
      const granted = result.state === 'granted';
      if (granted) {
        // Reset attempts and bypass when permission is granted
        setCameraAttempts(0);
        setBypassCamera(false);
      }
      return granted;
    } catch (error) {
      // Fallback: try to access camera directly
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        stream.getTracks().forEach(track => track.stop());
        // Reset attempts and bypass on successful access
        setCameraAttempts(0);
        setBypassCamera(false);
        return true;
      } catch {
        return false;
      }
    }
  };

  const handleCameraError = (error: any) => {
    const newAttempts = cameraAttempts + 1;
    setCameraAttempts(newAttempts);
    
    if (newAttempts >= 2) {
      setBypassCamera(true);
      setShowCamera(false);
      toast({
        title: "⚠️ Check-in Tanpa Selfie",
        description: "Absensi akan diproses tanpa foto selfie. Silakan berikan akses kamera dengan klik tombol permission di bawah layar untuk foto selfie di lain waktu.",
        duration: 6000,
      });
      // Continue with attendance without camera
      handlePhotoCapture(new Blob());
    }
  };

  const handleAttendanceAction = async () => {
    if (isButtonProcessing) return; // Prevent multiple clicks
    
    if (!selectedStaff) {
      toast({
        title: "Gagal",
        description: "Silakan pilih nama staff",
        variant: "destructive"
      });
      return;
    }
    
    // Play click sound
    playClickSound();
    setIsButtonProcessing(true);

    // Determine location: use detected coordinates if available; otherwise request permission
    let resolvedLocation: { lat: number; lng: number; address: string; coordinates: string; accuracy?: number } | null = null;
    if (currentLocation) {
      console.log('📍 Using cached coordinates');
      resolvedLocation = currentLocation;
    } else {
      try {
        resolvedLocation = await requestLocationPermission();
      } catch (err) {
        console.error('❌ Failed to obtain location:', err);
        toast({
          title: "Izin Lokasi Diperlukan",
          description: "Silakan izinkan akses lokasi untuk melanjutkan absensi",
          variant: "destructive"
        });
        return;
      }
    }

    // NOTE: Pre-permission check for camera removed to avoid false negatives on iOS/Safari.
    // Camera permission will be requested directly inside CameraCapture on user gesture.


    try {
      const location = resolvedLocation!;
      
      // Check if this is check-out
      const isCheckOut = todayAttendance?.check_in_time && !todayAttendance?.check_out_time;
      
      if (attendanceStatus === 'wfo') {
        // WFO mode: Check geofence for both check-in and check-out
        console.log('🏢 Checking WFO geofence for location:', location.lat, location.lng);
        const geofenceResult = await checkGeofence(location.lat, location.lng, location.accuracy);
        console.log('📍 Geofence check result:', geofenceResult);
        
        if (!geofenceResult.isInGeofence) {
          if (isCheckOut) {
            // Outside geofence for WFO checkout - show reason dialog
            setPendingCheckoutLocation(location);
            setShowCheckoutReasonDialog(true);
            setIsButtonProcessing(false); // Reset processing state
            return;
          } else {
            // Outside geofence for WFO check-in - show error
            console.error('❌ Not in geofence area for check-in');
            toast({
              title: "Di Luar Area Kantor",
              description: "Anda harus berada di area kantor untuk check in WFO. Silakan pilih status WFH atau Dinas jika bekerja di luar kantor.",
              variant: "destructive"
            });
            return;
          }
        }
        
        // Inside geofence: Process without camera
        console.log('✅ Inside geofence, processing WFO attendance');
        setCurrentLocation(location);
        handlePhotoCapture(new Blob()); // Pass empty blob for WFO
      } else {
        // WFH/Dinas: Check if bypass enabled
        setCurrentLocation(location);
        if (bypassCamera) {
          // Skip camera, process directly
          handlePhotoCapture(new Blob());
        } else {
          // Normal flow with camera
          setShowCamera(true);
        }
      }
    } catch (error) {
      console.error('❌ Location error:', error);
      toast({
        title: "Error Lokasi", 
        description: "Silakan aktifkan akses lokasi untuk melanjutkan",
        variant: "destructive"
      });
    } finally {
      setIsButtonProcessing(false);
    }
  };

  const handleCheckoutReasonSubmit = async () => {
    if (!checkoutReason.trim()) {
      toast({
        title: "Alasan Diperlukan",
        description: "Silakan masukkan alasan checkout WFO di luar kantor",
        variant: "destructive"
      });
      return;
    }
    
    setShowCheckoutReasonDialog(false);
    
    // For WFO, directly process checkout without camera since no photo needed
    if (attendanceStatus === 'wfo' && pendingCheckoutLocation) {
      setCurrentLocation(pendingCheckoutLocation);
      // Use setTimeout to ensure state is updated before calling handlePhotoCapture
      setTimeout(async () => {
        await handlePhotoCapture(null as any);
      }, 100);
    } else {
      // For WFH/Dinas, show camera
      setCurrentLocation(pendingCheckoutLocation);
      setShowCamera(true);
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
      if (todayAttendance?.status === 'wfo' && todayAttendance.checkin_location_lat && todayAttendance.checkin_location_lng) {
        const { data: geofences } = await supabase
          .from('geofence_areas')
          .select('*')
          .eq('is_active', true);
        if (geofences && geofences.length) {
          const lat = Number(todayAttendance.checkin_location_lat);
          const lng = Number(todayAttendance.checkin_location_lng);
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
    <div className="min-h-screen bg-background p-4 pt-2">
      <div className="max-w-md mx-auto space-y-2 animate-fade-in">
        {/* Birthday Card - Shows only when there are birthdays today */}
        <BirthdayCard />
        
        {/* Header with Date/Time */}
        <Card className="bg-card border shadow-lg">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-center gap-4 px-4">
              {/* Analog Clock - Modern Design with Gradient Colors */}
              <div className="relative w-[90px] h-[90px] rounded-full border-[3.5px] border-gradient-to-br from-blue-600 via-purple-600 to-pink-600 bg-gradient-to-br from-slate-50 via-white to-slate-100 shadow-2xl flex-shrink-0 animate-scale-in" style={{ borderImage: 'linear-gradient(135deg, #2563eb, #9333ea, #ec4899) 1' }}>
                {/* Gradient overlay for depth */}
                <div className="absolute inset-0 rounded-full bg-gradient-to-br from-white/60 via-transparent to-slate-100/30 pointer-events-none" />
                
                {/* Subtle inner glow */}
                <div className="absolute inset-1.5 rounded-full shadow-inner opacity-20" />
                
                {/* Clock tick marks */}
                {[...Array(12)].map((_, i) => {
                  const angle = (i * 30 - 90) * (Math.PI / 180);
                  const radius = 38;
                  const x = radius * Math.cos(angle);
                  const y = radius * Math.sin(angle);
                  const isMainHour = [0, 3, 6, 9].includes(i);
                  return (
                    <div
                      key={i}
                      className={`absolute ${isMainHour ? 'w-0.5 h-3 bg-gradient-to-b from-blue-700 to-purple-700' : 'w-0.5 h-2 bg-slate-400'} rounded-full`}
                      style={{
                        left: `calc(50% + ${x}px)`,
                        top: `calc(50% + ${y}px)`,
                        transform: `translate(-50%, -50%) rotate(${i * 30}deg)`
                      }}
                    />
                  );
                })}
                
                {/* Clock numbers - all 12 numbers */}
                {[12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((hour) => {
                  const angle = ((hour === 12 ? 0 : hour) * 30 - 90) * (Math.PI / 180);
                  const radius = 27;
                  const x = radius * Math.cos(angle);
                  const y = radius * Math.sin(angle);
                  return (
                    <div
                      key={hour}
                      className="absolute text-[7px] font-bold bg-gradient-to-br from-blue-700 to-purple-700 bg-clip-text text-transparent"
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
                
                {/* Center dot with glow effect */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 bg-gradient-to-br from-blue-600 to-purple-600 rounded-full z-10 shadow-xl" />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 bg-blue-500/40 rounded-full z-10 animate-ping" />
                {/* Minute hand */}
                
                {/* Hour hand - gradient with shadow */}
                <div 
                  className="absolute top-1/2 left-1/2 w-1.5 bg-gradient-to-t from-blue-800 to-blue-600 rounded-full origin-bottom transition-all duration-500 ease-out shadow-lg"
                  style={{ 
                    height: '30%',
                    transform: `translate(-50%, -100%) rotate(${((getTimeForTimezone(currentDateTime, timezone).hours % 12) * 30) + (getTimeForTimezone(currentDateTime, timezone).minutes * 0.5)}deg)`
                  }}
                />
                
                {/* Minute hand - gradient with shadow */}
                <div 
                  className="absolute top-1/2 left-1/2 w-1 bg-gradient-to-t from-purple-800 to-purple-600 rounded-full origin-bottom transition-all duration-500 ease-out shadow-lg z-30"
                  style={{ 
                    height: '42%',
                    transform: `translate(-50%, -100%) rotate(${getTimeForTimezone(currentDateTime, timezone).minutes * 6}deg)`
                  }}
                />
                {/* Second hand - thin with smooth animation and gradient tip */}
                <div 
                  className="absolute top-1/2 left-1/2 w-0.5 origin-bottom"
                  style={{ 
                    height: '45%',
                    transform: `translate(-50%, -100%) rotate(${getTimeForTimezone(currentDateTime, timezone).seconds * 6}deg)`,
                    transition: 'transform 0.3s cubic-bezier(0.4, 0.0, 0.2, 1)'
                  }}
                >
                  <div className="w-full h-3/4 bg-slate-600 rounded-full" />
                  <div className="w-full h-1/4 bg-gradient-to-t from-red-600 to-pink-500 rounded-full shadow-md" />
                </div>
              </div>

              {/* Date and Digital Time - Centered and Responsive */}
              <div className="flex flex-col gap-2 items-center text-center flex-1">
                {/* Date */}
                <div className="flex items-center justify-center gap-2 text-xs sm:text-sm text-muted-foreground">
                  <Calendar className="h-4 w-4 flex-shrink-0" />
                  <span className="hidden sm:inline">
                    {currentDateTime.toLocaleDateString('id-ID', { 
                      weekday: 'long', 
                      year: 'numeric', 
                      month: 'long', 
                      day: 'numeric' 
                    })}
                  </span>
                  <span className="sm:hidden">
                    {currentDateTime.toLocaleDateString('id-ID', { 
                      weekday: 'short', 
                      day: 'numeric', 
                      month: 'short',
                      year: 'numeric'
                    })}
                  </span>
                </div>

                {/* Digital Time */}
                <div className="flex items-center justify-center gap-3">
                  <div className="flex items-baseline gap-1.5 justify-center">
                    <span className="text-xl sm:text-2xl font-bold text-primary">
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
                  {workAreas.filter(Boolean).map((area) => (
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
              
              <Popover open={isStaffPopoverOpen} onOpenChange={setIsStaffPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    className="h-12 w-full justify-between border-2 hover:border-primary transition-colors"
                  >
                    {selectedStaff 
                      ? `${selectedStaff.name} - ${selectedStaff.position}`
                      : "Pilih nama staff..."
                    }
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Cari nama staff..." className="h-9" />
                    <CommandEmpty>Tidak ada staff ditemukan.</CommandEmpty>
                    <CommandList>
                      <CommandGroup>
                        {filteredStaffUsers.length === 0 ? (
                          <div className="p-3 text-center text-muted-foreground text-sm">
                            {selectedWorkArea === 'all' ? 'Tidak ada data staff' : `Tidak ada staff di area ${selectedWorkArea}`}
                          </div>
                        ) : (
                          filteredStaffUsers.map((staff) => (
                            <CommandItem
                              key={staff.uid}
                              value={`${staff.name} ${staff.position}`}
                              onSelect={() => handleStaffSelect(staff.uid)}
                              className="cursor-pointer"
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  selectedStaff?.uid === staff.uid ? "opacity-100" : "opacity-0"
                                )}
                              />
                              {staff.name} - {staff.position}
                            </CommandItem>
                          ))
                        )}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
            {/* Staff Info Display */}
            {selectedStaff && (
              <div className="bg-muted/30 p-4 rounded-lg space-y-3">
                <div className="flex gap-3">
                  {/* Staff Photo - No Border */}
                  <div className="flex-shrink-0">
                    <div className="overflow-hidden flex items-center justify-center w-[50px] h-[80px]">
                      {selectedStaff.photo_url ? (
                        <img src={selectedStaff.photo_url} alt={selectedStaff.name} className="w-full h-full object-cover" />
                      ) : (
                        <User className="w-12 h-12 text-muted-foreground" />
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
              <Select 
                value={attendanceStatus} 
                onValueChange={(value: 'wfo' | 'wfh' | 'dinas') => setAttendanceStatus(value)}
                disabled={isCheckedIn} // Disable when checking out
              >
                <SelectTrigger className="h-12 border-2 hover:border-primary transition-colors">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border shadow-lg z-50">
                  <SelectItem value="wfo">🏢 WFO (Work From Office)</SelectItem>
                  <SelectItem value="wfh">🏠 WFH (Work From Home)</SelectItem>
                  <SelectItem value="dinas">🚗 Dinas Luar</SelectItem>
                </SelectContent>
              </Select>
              {isCheckedIn && (
                <p className="text-xs text-muted-foreground">
                  Status mengikuti check-in ({attendanceStatus.toUpperCase()})
                </p>
              )}
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
                  {todayAttendance.checkin_location_address && (
                    <div>
                      <span className="text-muted-foreground block">Lokasi Check In:</span>
                      <span className="font-medium text-xs mb-2 block">
                        {todayAttendance.status === 'wfo' && wfoLocationName ? wfoLocationName : (todayAttendance.checkin_location_address || '-')}
                      </span>
                      <span className="text-muted-foreground block text-xs">Koordinat:</span>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">
                          📍 {todayAttendance.checkin_location_lat}, {todayAttendance.checkin_location_lng}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => window.open(
                            `https://www.google.com/maps?q=${todayAttendance.checkin_location_lat},${todayAttendance.checkin_location_lng}`,
                            '_blank'
                          )}
                          className="text-xs h-6"
                        >
                          🗺️ Maps
                        </Button>
                      </div>
                    </div>
                  )}
                  {todayAttendance.checkout_location_address && (
                    <div className="mt-2">
                      <span className="text-muted-foreground block">Lokasi Check Out:</span>
                      <span className="font-medium text-xs mb-2 block">
                        {todayAttendance.checkout_location_address || '-'}
                      </span>
                      <span className="text-muted-foreground block text-xs">Koordinat:</span>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">
                          📍 {todayAttendance.checkout_location_lat}, {todayAttendance.checkout_location_lng}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => window.open(
                            `https://www.google.com/maps?q=${todayAttendance.checkout_location_lat},${todayAttendance.checkout_location_lng}`,
                            '_blank'
                          )}
                          className="text-xs h-6"
                        >
                          🗺️ Maps
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
              disabled={!selectedStaff || loading || !!isCompleted || isButtonProcessing}
              className="w-full h-14 text-lg font-semibold gradient-primary border-0 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
              size="lg"
            >
              {loading && attendanceStatus === 'wfo' ? (
                <>
                  <MapPin className="h-5 w-5 mr-3 animate-pulse" />
                  Mengambil Koordinat...
                </>
              ) : (
                <>
                  <Camera className="h-5 w-5 mr-3" />
                  {isCompleted 
                    ? "✅ Absen Hari Ini Selesai" 
                    : isCheckedIn 
                      ? "📤 Check Out" 
                      : "📥 Check In"
                  }
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        <div className="text-center text-xs text-muted-foreground mt-2 space-y-2">
          <div>Versi Aplikasi: v1.0.5 IT Dept. 2025</div>
          <div className="flex items-center justify-center gap-3">
            <Button variant="outline" size="sm" onClick={handleClearCache}>
              Update (Hapus Cache)
            </Button>
            <PermissionIndicators 
              permissions={permissions} 
              onPermissionsUpdate={savePermissions}
            />
          </div>
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
                setIsButtonProcessing(false);
              }}>
                Batal
              </Button>
              <Button onClick={handleCheckoutReasonSubmit}>
                Lanjutkan
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Camera Modal - Only for WFH and Dinas */}
        {showCamera && attendanceStatus !== 'wfo' && (
          <CameraCapture
            onCapture={handlePhotoCapture}
            onClose={() => {
              setShowCamera(false);
              setCheckoutReason('');
              setPendingCheckoutLocation(null);
              setIsButtonProcessing(false);
            }}
            loading={loading}
            onCameraError={handleCameraError}
          />
        )}
      </div>
    </div>
  );
};

export default AttendanceForm;
