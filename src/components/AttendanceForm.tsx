import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Camera, MapPin, Clock, CheckCircle, Calendar, Users, Globe, User, QrCode, Building2, Briefcase } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import CameraCapture from './CameraCapture';
import BirthdayCard from './BirthdayCard';
import PermissionIndicators from './PermissionIndicators';
import QRCodeScanner from './QRCodeScanner';
import AttendanceStatusList from './AttendanceStatusList';
import StatusPresensiDialog from './StatusPresensiDialog';
import DebugLogger from './DebugLogger';
import { format } from 'date-fns';

interface StaffUser {
  uid: string;
  name: string;
  position: string;
  work_area: string;
  photo_url?: string;
  division?: string;
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
  attendance_type?: 'regular' | 'overtime';
  hours_worked?: number | null;
}

interface PermissionsState {
  location: boolean;
  camera: boolean;
}

interface AttendanceFormProps {
  companyLogoUrl?: string;
}

const AttendanceForm: React.FC<AttendanceFormProps> = ({ companyLogoUrl }) => {
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
  const [regularAttendance, setRegularAttendance] = useState<AttendanceRecord | null>(null);
  const [overtimeAttendance, setOvertimeAttendance] = useState<AttendanceRecord | null>(null);
  const [currentAttendanceType, setCurrentAttendanceType] = useState<'regular' | 'overtime'>('regular');
  const [showExtendButtons, setShowExtendButtons] = useState(false);
  const [loading, setLoading] = useState(false);
  const [currentDateTime, setCurrentDateTime] = useState(new Date());
  const [permissions, setPermissions] = useState<PermissionsState>({ location: false, camera: false });
  const [showCheckoutReasonDialog, setShowCheckoutReasonDialog] = useState(false);
  const [checkoutReason, setCheckoutReason] = useState('');
  const [pendingCheckoutLocation, setPendingCheckoutLocation] = useState<{ lat: number; lng: number; address: string; coordinates: string; accuracy?: number } | null>(null);
  const [isButtonProcessing, setIsButtonProcessing] = useState(false);
  const [cameraAttempts, setCameraAttempts] = useState(0);
  const [bypassCamera, setBypassCamera] = useState(false);
  const [showWfoFastCheckoutDialog, setShowWfoFastCheckoutDialog] = useState(false);
  const [manualCheckInTime, setManualCheckInTime] = useState({ hour: '08', minute: '00' });
  const [wfoFastCheckoutReason, setWfoFastCheckoutReason] = useState('');
  const [showDinasFastCheckoutDialog, setShowDinasFastCheckoutDialog] = useState(false);
  const [dinasFastCheckoutReason, setDinasFastCheckoutReason] = useState('');
  const [isDinasFastCheckout, setIsDinasFastCheckout] = useState(false);
  const [showQRScanner, setShowQRScanner] = useState(false);
  
  // StatusPresensiDialog state
  const [showStatusDialog, setShowStatusDialog] = useState(false);
  const [pendingAction, setPendingAction] = useState<{ type: 'regular' | 'overtime'; action: 'check-in' | 'check-out' } | null>(null);
  const [statusDialogLoading, setStatusDialogLoading] = useState(false);
  
  // Kiosk mode state
  const [kioskPendingAction, setKioskPendingAction] = useState<{ type: 'regular' | 'overtime'; action: 'check-in' | 'check-out' } | null>(null);
  
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
  const [sharedDeviceMode, setSharedDeviceMode] = useState(false);
  const [appVersion, setAppVersion] = useState('v2.2.0');
  
  // Check if user is logged in (non-kiosk mode)
  const [isUserLoggedIn, setIsUserLoggedIn] = useState(false);

  // Load shared device mode from localStorage (per-device setting)
  const loadSharedDeviceMode = () => {
    const localKioskMode = localStorage.getItem('shared_device_mode');
    setSharedDeviceMode(localKioskMode === 'true');
  };

  // Fetch app version from database
  const fetchAppVersion = async () => {
    const { data } = await supabase
      .from('app_settings')
      .select('setting_value')
      .eq('setting_key', 'app_current_version')
      .maybeSingle();
    if (data?.setting_value) {
      setAppVersion(data.setting_value);
    }
  };

  // Load user session for non-kiosk mode
  useEffect(() => {
    const localKioskMode = localStorage.getItem('shared_device_mode') === 'true';
    setSharedDeviceMode(localKioskMode);
    
    if (!localKioskMode) {
      // Non-kiosk: load user session
      const sessionData = localStorage.getItem('userSession');
      if (sessionData) {
        try {
          const session = JSON.parse(sessionData);
          setIsUserLoggedIn(true);
          setSelectedStaff({
            uid: session.uid,
            name: session.name,
            position: session.position,
            work_area: session.work_area,
            photo_url: session.photo_url,
            division: session.division
          });
          setSelectedWorkArea(session.work_area);
        } catch (error) {
          console.error('Error parsing session:', error);
        }
      }
    }
  }, []);

  useEffect(() => {
    fetchStaffUsers();
    checkStoredPermissions();
    loadSharedDeviceMode();
    fetchAppVersion();
    
    // Only load saved staff in kiosk mode
    const localKioskMode = localStorage.getItem('shared_device_mode') === 'true';
    if (localKioskMode) {
      // Load saved work area for kiosk mode
      const savedWorkArea = localStorage.getItem('last_selected_work_area');
      if (savedWorkArea) {
        setSelectedWorkArea(savedWorkArea);
      }
    }
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
      
      // Extract unique work areas
      const areas = [...new Set(staff.map(s => s.work_area))].sort();
      setWorkAreas(areas);
      
      // Apply saved work area filter after loading staff
      const savedWorkArea = localStorage.getItem('last_selected_work_area');
      if (savedWorkArea && savedWorkArea !== 'all') {
        setFilteredStaffUsers(staff.filter(s => s.work_area === savedWorkArea));
      } else {
        setFilteredStaffUsers(staff);
      }
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
    
    // Fetch regular attendance
    const { data: regularData } = await supabase
      .from('attendance_records')
      .select('*')
      .eq('staff_uid', selectedStaff.uid)
      .eq('date', today)
      .eq('attendance_type', 'regular')
      .maybeSingle();
    
    // Fetch overtime attendance
    const { data: overtimeData } = await supabase
      .from('attendance_records')
      .select('*')
      .eq('staff_uid', selectedStaff.uid)
      .eq('date', today)
      .eq('attendance_type', 'overtime')
      .maybeSingle();
    
    setRegularAttendance(regularData as AttendanceRecord);
    setOvertimeAttendance(overtimeData as AttendanceRecord);
    
    // Backward compatibility - set todayAttendance to regular
    setTodayAttendance(regularData as AttendanceRecord);
    
    // Restore attendance status from existing record
    if (regularData && regularData.check_in_time && !regularData.check_out_time) {
      console.log('📝 Restoring attendance status from existing check-in:', regularData.status);
      setAttendanceStatus(regularData.status as 'wfo' | 'wfh' | 'dinas');
    }
  };

  const requestLocationPermission = (): Promise<{ lat: number; lng: number; address: string; coordinates: string; accuracy?: number }> => {
    return new Promise(async (resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation not supported'));
        return;
      }

      const processPosition = async (position: GeolocationPosition) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        const accuracy = position.coords.accuracy;
        
        console.log(`📍 Got location: ${lat}, ${lng} (accuracy: ${accuracy}m)`);
        
        try {
          const locationData = await getAddressFromCoords(lat, lng);
          resolve({ lat, lng, address: locationData.address, coordinates: locationData.coordinates, accuracy });
        } catch (error) {
          console.error('❌ Geocoding failed:', error);
          // Even if geocoding fails, return coordinates
          const locationCode = generateLocationCode(lat, lng);
          resolve({ 
            lat, 
            lng, 
            address: `${locationCode} - Lokasi tidak dikenal`, 
            coordinates: `${lat.toFixed(6)}, ${lng.toFixed(6)}`,
            accuracy 
          });
        }
      };

      const handleError = (error: GeolocationPositionError) => {
        console.error('❌ Geolocation error:', error);
        reject(error);
      };

      // If we already have permission, use it
      if (permissions.location) {
        navigator.geolocation.getCurrentPosition(
          processPosition,
          handleError,
          { enableHighAccuracy: true, timeout: 15000, maximumAge: 300000 }
        );
        return;
      }

      // Request permission for the first time
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          // Save permission
          savePermissions({ ...permissions, location: true });
          await processPosition(position);
        },
        handleError,
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 300000 }
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
      
      // Helper function to fetch with timeout
      const fetchWithTimeout = (url: string, options: RequestInit, timeout = 8000) => {
        return Promise.race([
          fetch(url, options),
          new Promise<Response>((_, reject) => 
            setTimeout(() => reject(new Error('Timeout')), timeout)
          )
        ]);
      };
      
      // Try OpenStreetMap Nominatim first (more detailed for Indonesia)
      try {
        console.log('🌐 Trying OpenStreetMap Nominatim...');
        const nominatimResponse = await fetchWithTimeout(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1&accept-language=id&zoom=18`,
          {
            headers: {
              'User-Agent': 'AttendanceApp/1.0'
            }
          },
          8000
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
          const bigDataResponse = await fetchWithTimeout(
            `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=id`,
            {},
            8000
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

    // Tighter geofence tolerance - max 15 meters
    // If accuracy is poor, add minimal tolerance based on reported accuracy
    const accuracyTolerance = accuracy ? Math.min(accuracy * 0.3, 15) : 0;
    console.log(`📏 Accuracy: ${accuracy}m, adding tolerance: ${accuracyTolerance}m (max 15m)`);

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

  // Check ANY geofence (for Dinas status to display geofence name instead of address)
  const checkAnyGeofence = async (lat: number, lng: number): Promise<string | null> => {
    const { data: geofences, error } = await supabase
      .from('geofence_areas')
      .select('*')
      .eq('is_active', true);

    if (error || !geofences) return null;

    for (const geofence of geofences) {
      if (geofence.center_lat && geofence.center_lng && geofence.radius) {
        const distance = calculateDistance(
          lat, lng, 
          parseFloat(geofence.center_lat.toString()), 
          parseFloat(geofence.center_lng.toString())
        );
        
        // Use a small tolerance for geofence matching
        const effectiveRadius = geofence.radius + 50; // 50m tolerance
        
        if (distance <= effectiveRadius) {
          console.log(`📍 Dinas: Found matching geofence "${geofence.name}" at ${distance.toFixed(0)}m`);
          return geofence.name;
        }
      }
    }

    return null;
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

  // Handle QR Code scan result for Kiosk mode
  const handleQRScanSuccess = async (staffUid: string) => {
    setShowQRScanner(false);
    
    const staff = staffUsers.find(s => s.uid === staffUid);
    if (!staff) {
      toast({
        title: "❌ Staff Tidak Ditemukan",
        description: `UID "${staffUid}" tidak terdaftar dalam sistem`,
        variant: "destructive"
      });
      resetKioskState();
      return;
    }
    
    // In kiosk mode, process WFO attendance directly after QR scan
    if (sharedDeviceMode && kioskPendingAction) {
      setSelectedStaff(staff);
      await processKioskAttendance(staff, kioskPendingAction);
    } else {
      // Non-kiosk mode - just select the staff
      setSelectedStaff(staff);
      toast({
        title: "✅ Staff Ditemukan",
        description: `${staff.name} - ${staff.position}`
      });
    }
  };

  const resetKioskState = () => {
    setKioskPendingAction(null);
    setSelectedStaff(null);
    setLoading(false);
    setIsButtonProcessing(false);
  };

  const processKioskAttendance = async (staff: StaffUser, action: { type: 'regular' | 'overtime'; action: 'check-in' | 'check-out' }) => {
    setLoading(true);
    
    try {
      // Get location
      const location = await requestLocationPermission();
      
      // Check geofence for WFO
      const geofenceResult = await checkGeofence(location.lat, location.lng, location.accuracy);
      
      if (!geofenceResult.isInGeofence && action.action === 'check-in') {
        toast({
          title: "❌ Di Luar Area Kantor",
          description: "Anda harus berada di area kantor untuk check in WFO di Kiosk Mode",
          variant: "destructive"
        });
        resetKioskState();
        return;
      }
      
      // Get today's attendance for this staff
      const nowLocal = new Date();
      const pad = (n: number) => String(n).padStart(2, '0');
      const today = `${nowLocal.getFullYear()}-${pad(nowLocal.getMonth() + 1)}-${pad(nowLocal.getDate())}`;
      
      const { data: existingAttendance } = await supabase
        .from('attendance_records')
        .select('*')
        .eq('staff_uid', staff.uid)
        .eq('date', today)
        .eq('attendance_type', action.type)
        .maybeSingle();
      
      // Validate action
      if (action.action === 'check-in' && existingAttendance?.check_in_time) {
        toast({
          title: "❌ Sudah Clock In",
          description: `${staff.name} sudah melakukan clock in hari ini`,
          variant: "destructive"
        });
        resetKioskState();
        return;
      }
      
      if (action.action === 'check-out' && !existingAttendance?.check_in_time) {
        toast({
          title: "❌ Belum Clock In",
          description: `${staff.name} belum melakukan clock in hari ini`,
          variant: "destructive"
        });
        resetKioskState();
        return;
      }
      
      if (action.action === 'check-out' && existingAttendance?.check_out_time) {
        toast({
          title: "❌ Sudah Clock Out",
          description: `${staff.name} sudah melakukan clock out hari ini`,
          variant: "destructive"
        });
        resetKioskState();
        return;
      }
      
      // Process attendance
      const now = new Date();
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
      
      const locationAddress = geofenceResult.geofenceName || location.address;
      
      if (action.action === 'check-in') {
        const { error } = await supabase
          .from('attendance_records')
          .insert({
            staff_uid: staff.uid,
            staff_name: staff.name,
            date: today,
            status: 'wfo',
            attendance_type: action.type,
            check_in_time: formattedTime,
            checkin_location_address: locationAddress,
            checkin_location_lat: location.lat,
            checkin_location_lng: location.lng
          });
        
        if (error) throw error;
        
        toast({
          title: `✅ Clock In Berhasil`,
          description: `${staff.name} - ${locationAddress}\n📍 ${location.coordinates}`
        });
      } else {
        const hoursWorked = existingAttendance?.check_in_time 
          ? calculateHoursWorked(existingAttendance.check_in_time, formattedTime)
          : undefined;
        
        const { error } = await supabase
          .from('attendance_records')
          .update({
            check_out_time: formattedTime,
            checkout_location_address: locationAddress,
            checkout_location_lat: location.lat,
            checkout_location_lng: location.lng,
            hours_worked: hoursWorked
          })
          .eq('id', existingAttendance.id);
        
        if (error) throw error;
        
        toast({
          title: `✅ Clock Out Berhasil`,
          description: `${staff.name} - ${locationAddress}\n📍 ${location.coordinates}`
        });
      }
      
      // Reset for next user
      setTimeout(() => {
        resetKioskState();
        toast({
          title: "🔄 Siap untuk user berikutnya",
          description: "Silakan scan QR Code untuk absensi"
        });
      }, 2000);
      
    } catch (error) {
      console.error('Kiosk attendance error:', error);
      toast({
        title: "❌ Gagal",
        description: "Terjadi kesalahan saat memproses absensi",
        variant: "destructive"
      });
      resetKioskState();
    }
  };

  const handleWorkAreaSelect = (area: string) => {
    setSelectedWorkArea(area);
    // Save work area to localStorage for kiosk mode persistence
    localStorage.setItem('last_selected_work_area', area);
    
    if (area === 'all') {
      setFilteredStaffUsers(staffUsers);
    } else {
      setFilteredStaffUsers(staffUsers.filter(staff => staff.work_area === area));
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

  const handlePhotoCapture = async (
    photoBlob: Blob,
    forcedLocation?: { lat: number; lng: number; address: string; coordinates: string; accuracy?: number }
  ) => {
    const usedLocation = forcedLocation || currentLocation;
    if (!selectedStaff || !usedLocation) {
      console.error('❌ Missing required data:', { selectedStaff, currentLocation: usedLocation });
      setLoading(false);
      setIsButtonProcessing(false);
      toast({
        title: "Data Lokasi Belum Siap",
        description: "Mohon ulangi klik In, sistem sedang membaca lokasi.",
        variant: "destructive"
      });
      return;
    }

    // proceed with provided location to avoid race conditions

    setLoading(true);
    console.log('📸 Starting attendance submission for:', selectedStaff.name);
    
    try {
      // Check if this is Dinas fast checkout
      if (isDinasFastCheckout) {
        console.log('📱 Processing Dinas Fast Checkout with manual check-in time');
        const now = new Date();
        
        // Create manual check-in time
        const manualCheckIn = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate(),
          parseInt(manualCheckInTime.hour),
          parseInt(manualCheckInTime.minute),
          0
        );
        
        const pad = (n: number) => String(n).padStart(2, '0');
        const formatTimestamp = (date: Date) => {
          const y = date.getFullYear();
          const M = pad(date.getMonth() + 1);
          const d = pad(date.getDate());
          const h = pad(date.getHours());
          const m = pad(date.getMinutes());
          const s = pad(date.getSeconds());
          const ms = String(date.getMilliseconds()).padStart(3, '0');
          const tzMin = -date.getTimezoneOffset();
          const sign = tzMin >= 0 ? '+' : '-';
          const offH = pad(Math.floor(Math.abs(tzMin) / 60));
          const offM = pad(Math.abs(tzMin) % 60);
          return `${y}-${M}-${d} ${h}:${m}:${s}.${ms}${sign}${offH}:${offM}`;
        };
        
        // Upload photo
        let photoPath = null;
        if (photoBlob.size > 0) {
          console.log('📸 Compressing thumbnail for Dinas...');
          const thumbnailBlob = await compressThumbnail(photoBlob);
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
        }
        
        const checkInFormatted = formatTimestamp(manualCheckIn);
        const checkOutFormatted = formatTimestamp(now);
        const hoursWorked = calculateHoursWorked(checkInFormatted, checkOutFormatted);
        
        const { error } = await supabase
          .from('attendance_records')
          .insert({
            staff_uid: selectedStaff!.uid,
            staff_name: selectedStaff!.name,
            date: format(now, 'yyyy-MM-dd'),
            status: 'dinas',
            attendance_type: 'regular',
            check_in_time: checkInFormatted,
            check_out_time: checkOutFormatted,
            checkin_location_address: 'Manual - Dinas Luar',
            checkin_location_lat: null,
            checkin_location_lng: null,
            checkout_location_address: usedLocation.address,
            checkout_location_lat: usedLocation.lat,
            checkout_location_lng: usedLocation.lng,
            selfie_checkout_url: photoPath,
            reason: dinasFastCheckoutReason,
            hours_worked: hoursWorked
          });
        
        if (error) throw error;
        
        toast({
          title: "✅ Checkout Dinas Berhasil",
          description: `Check-in manual: ${manualCheckInTime.hour}:${manualCheckInTime.minute}. Total jam: ${hoursWorked} jam`
        });
        
        await fetchTodayAttendance();
        setShowCamera(false);
        setIsDinasFastCheckout(false);
        setDinasFastCheckoutReason('');
        setLoading(false);
        setIsButtonProcessing(false);
        return;
      }
      
      // Check if this is check-out
      const isCheckOut = todayAttendance?.check_in_time && !todayAttendance?.check_out_time;
      const currentRecord = currentAttendanceType === 'regular' ? regularAttendance : overtimeAttendance;
      
      // Check geofence for WFO status and get geofence name
      let locationAddress = usedLocation.address;
      
      if (attendanceStatus === 'wfo') {
        console.log('🏢 Checking WFO geofence for location:', usedLocation.lat, usedLocation.lng);
        const geofenceResult = await checkGeofence(usedLocation.lat, usedLocation.lng, usedLocation.accuracy);
        
        if (geofenceResult.isInGeofence && geofenceResult.geofenceName) {
          locationAddress = geofenceResult.geofenceName;
          console.log('📍 Using geofence name as location:', locationAddress);
        }
      }
      
      // For Dinas, check if in any geofence and use that name
      if (attendanceStatus === 'dinas') {
        const matchingGeofence = await checkAnyGeofence(usedLocation.lat, usedLocation.lng);
        if (matchingGeofence) {
          locationAddress = matchingGeofence;
          console.log('📍 Dinas: Using matched geofence name:', locationAddress);
        }
      }
      
      // Upload photo if present
      let photoPath = null;
      if (photoBlob.size > 0) {
        console.log('📸 Compressing and uploading photo...');
        const thumbnailBlob = await compressThumbnail(photoBlob);
        const fileName = `${selectedStaff.uid}_${Date.now()}.jpg`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('attendance-photos')
          .upload(fileName, thumbnailBlob);

        if (uploadError) {
          console.error('❌ Photo upload error:', uploadError);
          throw uploadError;
        }
        photoPath = uploadData.path;
        console.log('✅ Photo uploaded:', photoPath);
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
        attendance_type: currentAttendanceType,
        reason: finalReason,
        ...(isCheckOut 
          ? { 
              check_out_time: formattedTime,
              checkout_location_lat: usedLocation.lat,
              checkout_location_lng: usedLocation.lng,
              checkout_location_address: locationAddress,
              selfie_checkout_url: photoPath,
              hours_worked: currentAttendanceType === 'overtime' ? calculateHoursWorked(currentRecord!.check_in_time!, formattedTime) : undefined
            }
          : { 
              check_in_time: formattedTime,
              checkin_location_lat: usedLocation.lat,
              checkin_location_lng: usedLocation.lng,
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
          checkout_location_lat: usedLocation.lat,
          checkout_location_lng: usedLocation.lng,
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
        description: `Berhasil ${isCheckOut ? 'clock out' : 'clock in'}! Lokasi: ${locationAddress}`
      });

      setShowCamera(false);
      setReason('');
      setCheckoutReason('');
      setPendingCheckoutLocation(null);
      
      // Reset for shared device mode after successful attendance (both check-in AND check-out)
      if (sharedDeviceMode) {
        console.log('📱 Shared device mode: Resetting form after attendance');
        setTimeout(() => {
          setSelectedStaff(null);
          setAttendanceStatus('wfo');
          setReason('');
          setTodayAttendance(null);
          setRegularAttendance(null);
          setOvertimeAttendance(null);
          localStorage.removeItem('last_selected_staff');
          localStorage.removeItem('attendance_status');
          toast({
            title: "✅ Absensi Berhasil",
            description: "Silakan scan QR Code untuk user berikutnya"
          });
        }, 2000);
      }
      
      // Always fetch attendance after successful action
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
      setIsButtonProcessing(false);
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
    // Camera error is now handled by confirmation dialog in CameraCapture component
    // No auto-processing, let user decide via dialog
    console.log('⚠️ Camera error:', error);
  };

  const calculateHoursWorked = (checkIn: string, checkOut: string): number => {
    try {
      const start = new Date(checkIn.replace(' ', 'T'));
      const end = new Date(checkOut.replace(' ', 'T'));
      const diffMs = end.getTime() - start.getTime();
      const hours = diffMs / (1000 * 60 * 60);
      return Math.round(hours * 100) / 100;
    } catch {
      return 0;
    }
  };

  const handleWfoOvertimeWithoutPhoto = async (isCheckOut: boolean) => {
    try {
      const location = await requestLocationPermission();
      if (!location) {
        setLoading(false);
        return;
      }
      
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
      
      if (!isCheckOut) {
        // Overtime Check-In
        const { error } = await supabase
          .from('attendance_records')
          .insert({
            staff_uid: selectedStaff!.uid,
            staff_name: selectedStaff!.name,
            date: `${y}-${M}-${d}`,
            status: 'wfo',
            attendance_type: 'overtime',
            check_in_time: formattedTime,
            checkin_location_address: location.address,
            checkin_location_lat: location.lat,
            checkin_location_lng: location.lng
          });
        
        if (error) throw error;
        
        toast({ title: "✅ Overtime Clock In Berhasil" });
      } else {
        // Overtime Check-Out
        const hoursWorked = calculateHoursWorked(
          overtimeAttendance!.check_in_time!,
          formattedTime
        );
        
        const { error } = await supabase
          .from('attendance_records')
          .update({
            check_out_time: formattedTime,
            checkout_location_address: location.address,
            checkout_location_lat: location.lat,
            checkout_location_lng: location.lng,
            hours_worked: hoursWorked
          })
          .eq('id', overtimeAttendance!.id);
        
        if (error) throw error;
        
        toast({ 
          title: "✅ Overtime Clock Out Berhasil",
          description: `Total jam lembur: ${hoursWorked} jam`
        });
      }
      
      await fetchTodayAttendance();
    } catch (error) {
      console.error('WFO overtime error:', error);
      toast({
        title: "❌ Gagal",
        description: "Gagal menyimpan absensi lembur",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
      setIsButtonProcessing(false);
    }
  };

  const handleWfoFastCheckout = async () => {
    if (!wfoFastCheckoutReason.trim()) {
      toast({
        title: "Alasan Diperlukan",
        description: "Silakan masukkan alasan clock out WFO",
        variant: "destructive"
      });
      return;
    }
    
    try {
      const location = await requestLocationPermission();
      const now = new Date();
      
      // Create manual check-in time
      const manualCheckIn = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
        parseInt(manualCheckInTime.hour),
        parseInt(manualCheckInTime.minute),
        0
      );
      
      // Validation: Clock-in must be before clock-out
      if (manualCheckIn >= now) {
        toast({
          title: "Waktu Tidak Valid",
          description: "Jam clock-in harus lebih awal dari sekarang",
          variant: "destructive"
        });
        return;
      }
      
      const pad = (n: number) => String(n).padStart(2, '0');
      const formatTimestamp = (date: Date) => {
        const y = date.getFullYear();
        const M = pad(date.getMonth() + 1);
        const d = pad(date.getDate());
        const h = pad(date.getHours());
        const m = pad(date.getMinutes());
        const s = pad(date.getSeconds());
        const ms = String(date.getMilliseconds()).padStart(3, '0');
        const tzMin = -date.getTimezoneOffset();
        const sign = tzMin >= 0 ? '+' : '-';
        const offH = pad(Math.floor(Math.abs(tzMin) / 60));
        const offM = pad(Math.abs(tzMin) % 60);
        return `${y}-${M}-${d} ${h}:${m}:${s}.${ms}${sign}${offH}:${offM}`;
      };
      
      const checkInFormatted = formatTimestamp(manualCheckIn);
      const checkOutFormatted = formatTimestamp(now);
      const hoursWorked = calculateHoursWorked(checkInFormatted, checkOutFormatted);
      
      const { error } = await supabase
        .from('attendance_records')
        .insert({
          staff_uid: selectedStaff!.uid,
          staff_name: selectedStaff!.name,
          date: format(now, 'yyyy-MM-dd'),
          status: 'wfo',
          attendance_type: 'regular',
          check_in_time: checkInFormatted,
          check_out_time: checkOutFormatted,
          checkin_location_address: 'Manual - Absen Fisik Kantor',
          checkin_location_lat: null,
          checkin_location_lng: null,
          checkout_location_address: location.address,
          checkout_location_lat: location.lat,
          checkout_location_lng: location.lng,
          reason: wfoFastCheckoutReason,
          hours_worked: hoursWorked
        });
      
      if (error) throw error;
      
      toast({
        title: "✅ Checkout WFO Berhasil",
        description: `Check-in manual: ${manualCheckInTime.hour}:${manualCheckInTime.minute}. Total jam: ${hoursWorked} jam`
      });
      
      await fetchTodayAttendance();
      setShowWfoFastCheckoutDialog(false);
      setWfoFastCheckoutReason('');
    } catch (error) {
      console.error('WFO fast checkout error:', error);
      toast({
        title: "❌ Gagal",
        description: "Gagal menyimpan checkout WFO",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
      setIsButtonProcessing(false);
    }
  };

  const handleDinasFastCheckoutConfirm = async () => {
    if (!dinasFastCheckoutReason.trim()) {
      toast({
        title: "Alasan Diperlukan",
        description: "Silakan masukkan alasan checkout Dinas",
        variant: "destructive"
      });
      return;
    }
    
    // Validation: Check-in must be before checkout
    const now = new Date();
    const manualCheckIn = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      parseInt(manualCheckInTime.hour),
      parseInt(manualCheckInTime.minute),
      0
    );
    
    if (manualCheckIn >= now) {
      toast({
        title: "Waktu Tidak Valid",
        description: "Jam check-in harus lebih awal dari sekarang",
        variant: "destructive"
      });
      return;
    }
    
    // Close dialog and trigger camera for selfie
    setShowDinasFastCheckoutDialog(false);
    setIsDinasFastCheckout(true);
    
    try {
      const location = await requestLocationPermission();
      setCurrentLocation(location);
      setShowCamera(true);
    } catch (error) {
      console.error('Location error:', error);
      toast({
        title: "Error Lokasi",
        description: "Silakan aktifkan akses lokasi untuk melanjutkan",
        variant: "destructive"
      });
      setIsDinasFastCheckout(false);
    }
  };

  // Handler for button clicks - User Login Mode uses StatusPresensiDialog
  const handleAttendanceButtonClick = (
    attendanceType: 'regular' | 'overtime',
    action: 'check-in' | 'check-out'
  ) => {
    if (isButtonProcessing) return;
    
    playClickSound();
    
    // Kiosk mode - show QR scanner first, staff akan dipilih setelah scan
    if (sharedDeviceMode) {
      setKioskPendingAction({ type: attendanceType, action });
      setShowQRScanner(true);
      return;
    }
    
    // User Login Mode - perlu selectedStaff
    if (!selectedStaff) {
      toast({
        title: "Gagal",
        description: "Data staff tidak ditemukan",
        variant: "destructive"
      });
      return;
    }
    
    // Show StatusPresensiDialog
    setPendingAction({ type: attendanceType, action });
    setShowStatusDialog(true);
  };

  // Handle status dialog confirmation
  const handleStatusDialogConfirm = async (status: 'wfo' | 'wfh' | 'dinas', dialogReason: string) => {
    if (!pendingAction) return;
    
    setStatusDialogLoading(true);
    setAttendanceStatus(status);
    setReason(dialogReason);
    
    // Close dialog first
    setShowStatusDialog(false);
    
    // Now process the attendance with selected status
    await handleAttendanceAction(pendingAction.type, pendingAction.action, status, dialogReason);
    
    setStatusDialogLoading(false);
    setPendingAction(null);
  };

  const handleAttendanceAction = async (
    attendanceType: 'regular' | 'overtime',
    action: 'check-in' | 'check-out',
    status?: 'wfo' | 'wfh' | 'dinas',
    actionReason?: string
  ) => {
    if (isButtonProcessing) return; // Prevent multiple clicks
    
    if (!selectedStaff) {
      toast({
        title: "Gagal",
        description: "Silakan pilih nama staff",
        variant: "destructive"
      });
      return;
    }
    
    const effectiveStatus = status || attendanceStatus;
    const effectiveReason = actionReason || reason;
    
    // Play click sound and set processing state
    setCurrentAttendanceType(attendanceType);
    setIsButtonProcessing(true);
    setLoading(true);
    
    const currentRecord = attendanceType === 'regular' ? regularAttendance : overtimeAttendance;
    const isCheckOut = action === 'check-out';
    
    // SPECIAL CASE: WFO/Dinas regular checkout without check-in (Fast Checkout)
    if (attendanceType === 'regular' && 
        isCheckOut && 
        (effectiveStatus === 'wfo' || effectiveStatus === 'dinas') && 
        !regularAttendance?.check_in_time) {
      if (effectiveStatus === 'wfo') {
        setShowWfoFastCheckoutDialog(true);
      } else {
        setShowDinasFastCheckoutDialog(true);
      }
      return; // Dialog will handle rest
    }
    
    // SPECIAL CASE: WFO overtime - SKIP CAMERA
    if (attendanceType === 'overtime' && effectiveStatus === 'wfo') {
      // Handle WFO overtime without photo
      await handleWfoOvertimeWithoutPhoto(isCheckOut);
      return;
    }

    // Determine location: use detected coordinates if available; otherwise request permission
    let resolvedLocation: { lat: number; lng: number; address: string; coordinates: string; accuracy?: number } | null = null;
    if (currentLocation) {
      console.log('📍 Using cached coordinates');
      resolvedLocation = currentLocation;
    } else {
      try {
        console.log('🔍 Requesting location permission...');
        resolvedLocation = await requestLocationPermission();
        console.log('✅ Location obtained:', resolvedLocation);
      } catch (err) {
        console.error('❌ Failed to obtain location:', err);
        toast({
          title: "Izin Lokasi Diperlukan",
          description: "Silakan izinkan akses lokasi untuk melanjutkan absensi",
          variant: "destructive"
        });
        setLoading(false);
        setIsButtonProcessing(false);
        return;
      }
    }

    try {
      const location = resolvedLocation!;
      console.log('📍 Processing location:', { lat: location.lat, lng: location.lng, accuracy: location.accuracy });
      
      if (effectiveStatus === 'wfo') {
        // WFO mode: Check geofence for both check-in and check-out
        console.log('🏢 Checking WFO geofence for location:', location.lat, location.lng, 'accuracy:', location.accuracy);
        const geofenceResult = await checkGeofence(location.lat, location.lng, location.accuracy);
        console.log('📍 Geofence check result:', geofenceResult);
        
        if (!geofenceResult.isInGeofence) {
          if (isCheckOut) {
            // WFO check-out outside geofence - ask for reason
            console.log('⚠️ WFO checkout outside geofence, asking for reason');
            setPendingCheckoutLocation(location);
            setShowCheckoutReasonDialog(true);
            setLoading(false);
            setIsButtonProcessing(false);
            return;
          } else {
            // Outside geofence for WFO check-in - show error
            console.error('❌ Not in geofence area for check-in');
            toast({
              title: "Di Luar Area Kantor",
              description: "Anda harus berada di area kantor untuk check in WFO. Silakan pilih status WFH atau Dinas jika bekerja di luar kantor.",
              variant: "destructive"
            });
            setLoading(false);
            setIsButtonProcessing(false);
            return;
          }
        }
        
        // Inside geofence: Process without camera
        console.log('✅ Inside geofence, processing WFO attendance');
        setCurrentLocation(location);
        handlePhotoCapture(new Blob(), location); // Pass location directly to avoid state race
      } else {
        // WFH/Dinas: Check if bypass enabled
        setCurrentLocation(location);
        if (bypassCamera) {
          // Skip camera, process directly
          handlePhotoCapture(new Blob(), location);
        } else {
          // Normal flow with camera
          setShowCamera(true);
          setLoading(false);
          setIsButtonProcessing(false);
        }
      }
    } catch (error) {
      console.error('❌ Location error:', error);
      toast({
        title: "Error Lokasi", 
        description: "Silakan aktifkan akses lokasi untuk melanjutkan",
        variant: "destructive"
      });
      setLoading(false);
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
      const loc = pendingCheckoutLocation;
      // Process immediately with provided location (no camera for WFO)
      await handlePhotoCapture(new Blob(), loc as any);
    } else {
      // For WFH/Dinas, show camera
      setCurrentLocation(pendingCheckoutLocation);
      setShowCamera(true);
    }
  };

  // Clear app cache/cookies and SW, then reload - PRESERVE kiosk mode
  const handleClearCache = async () => {
    try {
      // Preserve important device settings before clearing
      const kioskMode = localStorage.getItem('shared_device_mode');
      const deviceId = localStorage.getItem('device_id');
      const userTimezone = localStorage.getItem('user_timezone');
      const installedVersion = localStorage.getItem('app_installed_version');
      
      localStorage.clear();
      sessionStorage.clear();
      
      // Restore preserved settings
      if (kioskMode) localStorage.setItem('shared_device_mode', kioskMode);
      if (deviceId) localStorage.setItem('device_id', deviceId);
      if (userTimezone) localStorage.setItem('user_timezone', userTimezone);
      if (installedVersion) localStorage.setItem('app_installed_version', installedVersion);
      
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
                  {sharedDeviceMode && (
                    <Badge variant="outline" className="bg-amber-500/20 text-amber-700 border-amber-500 text-xs">
                      🖥️ Kiosk Mode
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Attendance Status List - Shows who has/hasn't checked in */}
        <AttendanceStatusList selectedWorkArea={isUserLoggedIn && !sharedDeviceMode ? selectedStaff?.work_area || 'all' : selectedWorkArea} />

        {/* KIOSK MODE: Show Area Tugas dropdown */}
        {sharedDeviceMode && (
          <Card className="border-0 shadow-xl">
            <CardContent className="p-4">
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
                  <SelectContent 
                    className="bg-popover border-border shadow-lg max-h-[280px] overflow-y-auto z-50 data-[state=open]:duration-100"
                    position="popper"
                  >
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
            </CardContent>
          </Card>
        )}

        {/* USER LOGIN MODE: Show User Profile Card */}
        {isUserLoggedIn && !sharedDeviceMode && selectedStaff && (
          <Card className="border-0 shadow-xl bg-gradient-to-br from-primary/5 to-primary/10">
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16 border-2 border-primary/20">
                  <AvatarImage src={selectedStaff.photo_url} alt={selectedStaff.name} />
                  <AvatarFallback className="bg-primary/10 text-primary text-lg font-bold">
                    {selectedStaff.name.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-lg truncate">{selectedStaff.name}</h3>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Briefcase className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{selectedStaff.position}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <MapPin className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{selectedStaff.work_area}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                    <User className="h-3 w-3 shrink-0" />
                    <span>UID: {selectedStaff.uid}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Today's Attendance Status - Show for logged in user */}
        {isUserLoggedIn && !sharedDeviceMode && todayAttendance && (
          <Card className="border-0 shadow-xl">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  <span className="font-semibold">Status Hari Ini</span>
                </div>
                <Badge variant={
                  todayAttendance.status === 'wfo' ? 'default' :
                  todayAttendance.status === 'wfh' ? 'secondary' : 'outline'
                }>
                  {todayAttendance.status?.toUpperCase()}
                </Badge>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Clock In:</span>
                  <span className="font-medium">
                    {formatCheckTime(todayAttendance.check_in_time as string)}
                  </span>
                </div>
                {todayAttendance.check_out_time && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Clock Out:</span>
                    <span className="font-medium">
                      {formatCheckTime(todayAttendance.check_out_time as string)}
                    </span>
                  </div>
                )}
                {todayAttendance.checkin_location_address && (
                  <div>
                    <span className="text-muted-foreground block">Lokasi:</span>
                    <span className="font-medium text-xs">
                      {todayAttendance.status === 'wfo' && wfoLocationName ? wfoLocationName : (todayAttendance.checkin_location_address || '-')}
                    </span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Action Buttons */}
        <Card className="border-0 shadow-xl">
          <CardContent className="p-6">
            <div className="flex flex-col gap-3">
              {/* Main In/Out Buttons */}
              <div className="flex items-center justify-center gap-4">
                {/* Regular Check In */}
                <Button 
                  onClick={() => handleAttendanceButtonClick('regular', 'check-in')}
                  disabled={
                    sharedDeviceMode 
                      ? loading || isButtonProcessing  // Kiosk: staff dipilih via QR
                      : !!regularAttendance?.check_in_time || loading || !selectedStaff  // Login mode
                  }
                  variant="outline"
                  className="h-12 w-24 rounded-full border-2 active:scale-95 transition-all duration-200 hover:bg-[#39ff14]/10"
                  style={{
                    borderColor: (sharedDeviceMode 
                      ? loading || isButtonProcessing
                      : !!regularAttendance?.check_in_time || loading || !selectedStaff) 
                      ? '#9ca3af' 
                      : '#39ff14',
                    color: (sharedDeviceMode 
                      ? loading || isButtonProcessing
                      : !!regularAttendance?.check_in_time || loading || !selectedStaff)
                      ? '#9ca3af'
                      : '#39ff14',
                    fontWeight: 'bold',
                    opacity: (sharedDeviceMode 
                      ? loading || isButtonProcessing
                      : !!regularAttendance?.check_in_time || loading || !selectedStaff) ? 0.5 : 1
                  }}
                >
                  In
                </Button>
                
                {/* Regular Check Out */}
                <Button 
                  onClick={() => handleAttendanceButtonClick('regular', 'check-out')}
                  disabled={
                    sharedDeviceMode 
                      ? loading || isButtonProcessing  // Kiosk: staff dipilih via QR
                      : !!regularAttendance?.check_out_time || loading || !selectedStaff  // Login mode
                  }
                  variant="outline"
                  className="h-12 w-24 rounded-full border-2 active:scale-95 transition-all duration-200 hover:bg-[#ff073a]/10"
                  style={{
                    borderColor: (sharedDeviceMode 
                      ? loading || isButtonProcessing
                      : !!regularAttendance?.check_out_time || loading || !selectedStaff)
                      ? '#9ca3af'
                      : '#ff073a',
                    color: (sharedDeviceMode 
                      ? loading || isButtonProcessing
                      : !!regularAttendance?.check_out_time || loading || !selectedStaff)
                      ? '#9ca3af'
                      : '#ff073a',
                    fontWeight: 'bold',
                    opacity: (sharedDeviceMode 
                      ? loading || isButtonProcessing
                      : !!regularAttendance?.check_out_time || loading || !selectedStaff) ? 0.5 : 1
                  }}
                >
                  Out
                </Button>
              </div>

              {/* Extend Toggle Button */}
              <div className="flex justify-center">
                <Button
                  onClick={() => setShowExtendButtons(!showExtendButtons)}
                  variant="ghost"
                  size="sm"
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  {showExtendButtons ? '▲ Sembunyikan Extend' : '▼ Tampilkan Extend'}
                </Button>
              </div>

              {/* Extend In/Out Buttons - Conditional */}
              {showExtendButtons && (
                <div className="flex items-center justify-center gap-4 animate-fade-in">
                  {/* Overtime Check In */}
                  <Button 
                    onClick={() => handleAttendanceButtonClick('overtime', 'check-in')}
                    disabled={
                      sharedDeviceMode
                        ? loading || isButtonProcessing  // Kiosk: staff dipilih via QR
                        : !regularAttendance?.check_out_time || !!overtimeAttendance?.check_in_time || loading || !selectedStaff
                    }
                    variant="outline"
                    className="h-12 w-28 rounded-full border-2 active:scale-95 transition-all duration-200 hover:bg-[#39ff14]/10"
                    style={{
                      borderColor: (sharedDeviceMode
                        ? loading || isButtonProcessing
                        : !regularAttendance?.check_out_time || !!overtimeAttendance?.check_in_time || loading || !selectedStaff
                      )
                        ? '#9ca3af'
                        : '#39ff14',
                      color: (sharedDeviceMode
                        ? loading || isButtonProcessing
                        : !regularAttendance?.check_out_time || !!overtimeAttendance?.check_in_time || loading || !selectedStaff
                      )
                        ? '#9ca3af'
                        : '#39ff14',
                      fontWeight: 'bold',
                      fontSize: '0.85rem',
                      opacity: (sharedDeviceMode
                        ? loading || isButtonProcessing
                        : !regularAttendance?.check_out_time || !!overtimeAttendance?.check_in_time || loading || !selectedStaff
                      ) ? 0.5 : 1
                    }}
                  >
                    In Extend
                  </Button>
                  
                  {/* Overtime Check Out */}
                  <Button 
                    onClick={() => handleAttendanceButtonClick('overtime', 'check-out')}
                    disabled={
                      sharedDeviceMode
                        ? loading || isButtonProcessing  // Kiosk: staff dipilih via QR
                        : !overtimeAttendance?.check_in_time || !!overtimeAttendance?.check_out_time || loading
                    }
                    variant="outline"
                    className="h-12 w-28 rounded-full border-2 active:scale-95 transition-all duration-200 hover:bg-[#ff073a]/10"
                    style={{
                      borderColor: (sharedDeviceMode
                        ? loading || isButtonProcessing
                        : !overtimeAttendance?.check_in_time || !!overtimeAttendance?.check_out_time || loading)
                        ? '#9ca3af'
                        : '#ff073a',
                      color: (sharedDeviceMode
                        ? loading || isButtonProcessing
                        : !overtimeAttendance?.check_in_time || !!overtimeAttendance?.check_out_time || loading)
                        ? '#9ca3af'
                        : '#ff073a',
                      fontWeight: 'bold',
                      fontSize: '0.85rem',
                      opacity: (sharedDeviceMode
                        ? loading || isButtonProcessing
                        : !overtimeAttendance?.check_in_time || !!overtimeAttendance?.check_out_time || loading) ? 0.5 : 1
                    }}
                  >
                    Out Extend
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Company Logo Card - ONLY for Kiosk Mode */}
        {sharedDeviceMode && companyLogoUrl && (
          <Card className="border-0 shadow-xl">
            <CardContent className="p-6 flex items-center justify-center" style={{ minHeight: '180px' }}>
              <img 
                src={companyLogoUrl} 
                alt="Company Logo" 
                className="max-h-[160px] max-w-full object-contain"
                onError={(e) => {
                  console.log('Company logo failed to load');
                  e.currentTarget.style.display = 'none';
                }}
              />
            </CardContent>
          </Card>
        )}

        <div className="text-center text-xs text-muted-foreground mt-2 space-y-2">
          <div>Versi aplikasi : {appVersion} IT Division 2025</div>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <Button variant="outline" size="sm" onClick={handleClearCache}>
              Update (Hapus Cache)
            </Button>
            <DebugLogger 
              staffUid={selectedStaff?.uid}
              staffName={selectedStaff?.name}
              workAreas={workAreas}
              permissions={permissions}
            />
            <PermissionIndicators 
              permissions={permissions} 
              onPermissionsUpdate={savePermissions}
            />
          </div>
        </div>

        {/* StatusPresensiDialog - For User Login Mode */}
        <StatusPresensiDialog
          isOpen={showStatusDialog}
          onClose={() => {
            setShowStatusDialog(false);
            setPendingAction(null);
          }}
          onConfirm={handleStatusDialogConfirm}
          actionType={pendingAction?.action === 'check-in' ? 'check-in' : 
                     pendingAction?.action === 'check-out' ? 'check-out' :
                     pendingAction?.type === 'overtime' && pendingAction?.action === 'check-in' ? 'in-extend' : 'out-extend'}
          defaultStatus={attendanceStatus}
          loading={statusDialogLoading}
        />

        {/* QR Code Scanner Modal */}
        <QRCodeScanner
          isOpen={showQRScanner}
          onClose={() => {
            setShowQRScanner(false);
            setKioskPendingAction(null);
          }}
          onScanSuccess={handleQRScanSuccess}
        />

        {/* WFO Fast Checkout Dialog */}
        <Dialog open={showWfoFastCheckoutDialog} onOpenChange={(open) => {
          setShowWfoFastCheckoutDialog(open);
          if (!open) {
            // Reset states when dialog is closed
            setWfoFastCheckoutReason('');
            setLoading(false);
            setIsButtonProcessing(false);
          }
        }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold">Input Clock In Manual</DialogTitle>
              <DialogDescription className="text-left text-sm">
                Anda clock out saja? apakah anda sudah clock in di absen fisik? 
                jika ya silahkan masukan jam perkiraan clock in anda di absen fisik, 
                serta masukan alasan clock out wfo diluar geofence kantor
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label className="text-sm font-medium mb-2 block">Jam Clock In Perkiraan</Label>
                <div className="flex gap-3 items-center">
                  <Select value={manualCheckInTime.hour} onValueChange={(val) => setManualCheckInTime({...manualCheckInTime, hour: val})}>
                    <SelectTrigger className="flex-1"><SelectValue placeholder="Jam" /></SelectTrigger>
                    <SelectContent className="max-h-60">
                      {Array.from({length: 24}, (_, i) => (
                        <SelectItem key={i} value={String(i).padStart(2, '0')}>{String(i).padStart(2, '0')}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <span className="text-2xl font-bold">:</span>
                  <Select value={manualCheckInTime.minute} onValueChange={(val) => setManualCheckInTime({...manualCheckInTime, minute: val})}>
                    <SelectTrigger className="flex-1"><SelectValue placeholder="Menit" /></SelectTrigger>
                    <SelectContent className="max-h-60">
                      {Array.from({length: 60}, (_, i) => (
                        <SelectItem key={i} value={String(i).padStart(2, '0')}>{String(i).padStart(2, '0')}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label className="text-sm font-medium mb-2 block">Alasan Clock Out WFO Diluar Geofence</Label>
                <Textarea
                  placeholder="Contoh: Sudah clock in fingerprint pukul 08:15. Clock out diluar kantor karena urusan mendadak"
                  value={wfoFastCheckoutReason}
                  onChange={(e) => setWfoFastCheckoutReason(e.target.value)}
                  rows={4}
                  className="resize-none"
                />
              </div>
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => { setShowWfoFastCheckoutDialog(false); setWfoFastCheckoutReason(''); setLoading(false); setIsButtonProcessing(false); }} className="flex-1">Batal</Button>
              <Button onClick={handleWfoFastCheckout} className="flex-1 bg-primary">Konfirmasi</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dinas Fast Checkout Dialog */}
        <Dialog open={showDinasFastCheckoutDialog} onOpenChange={(open) => {
          setShowDinasFastCheckoutDialog(open);
          if (!open) {
            // Reset states when dialog is closed
            setDinasFastCheckoutReason('');
            setLoading(false);
            setIsButtonProcessing(false);
          }
        }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold">Input Clock In Manual - Dinas</DialogTitle>
              <DialogDescription className="text-left text-sm">
                Anda clock out saja dengan status Dinas Luar? 
                Silahkan masukan jam perkiraan clock in anda dan alasan,
                kemudian sistem akan meminta foto selfie untuk clock out
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label className="text-sm font-medium mb-2 block">Jam Clock In Perkiraan</Label>
                <div className="flex gap-3 items-center">
                  <Select value={manualCheckInTime.hour} onValueChange={(val) => setManualCheckInTime({...manualCheckInTime, hour: val})}>
                    <SelectTrigger className="flex-1"><SelectValue placeholder="Jam" /></SelectTrigger>
                    <SelectContent className="max-h-60">
                      {Array.from({length: 24}, (_, i) => (
                        <SelectItem key={i} value={String(i).padStart(2, '0')}>{String(i).padStart(2, '0')}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <span className="text-2xl font-bold">:</span>
                  <Select value={manualCheckInTime.minute} onValueChange={(val) => setManualCheckInTime({...manualCheckInTime, minute: val})}>
                    <SelectTrigger className="flex-1"><SelectValue placeholder="Menit" /></SelectTrigger>
                    <SelectContent className="max-h-60">
                      {Array.from({length: 60}, (_, i) => (
                        <SelectItem key={i} value={String(i).padStart(2, '0')}>{String(i).padStart(2, '0')}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label className="text-sm font-medium mb-2 block">Alasan Clock Out Dinas Luar</Label>
                <Textarea
                  placeholder="Contoh: Sudah clock in pukul 08:00 untuk dinas ke lokasi X"
                  value={dinasFastCheckoutReason}
                  onChange={(e) => setDinasFastCheckoutReason(e.target.value)}
                  rows={4}
                  className="resize-none"
                />
              </div>
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => { setShowDinasFastCheckoutDialog(false); setDinasFastCheckoutReason(''); setLoading(false); setIsButtonProcessing(false); }} className="flex-1">Batal</Button>
              <Button onClick={handleDinasFastCheckoutConfirm} className="flex-1 bg-primary">OK - Ambil Foto</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Checkout Reason Dialog - WFO outside geofence */}
        <Dialog open={showCheckoutReasonDialog} onOpenChange={(open) => {
          setShowCheckoutReasonDialog(open);
          if (!open) {
            // Reset states when dialog is closed
            setCheckoutReason('');
            setPendingCheckoutLocation(null);
            setLoading(false);
            setIsButtonProcessing(false);
          }
        }}>
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
