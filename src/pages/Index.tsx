import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { Shield, User, LogIn } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import AttendanceForm from '../components/AttendanceForm';
import AdPopup from '../components/AdPopup';

interface UserSession {
  uid: string;
  name: string;
  position: string;
  work_area: string;
  division?: string;
  photo_url?: string;
  is_admin: boolean;
}

const Index = () => {
  const navigate = useNavigate();
  const [logoUrl, setLogoUrl] = useState('');
  const [companyLogoUrl, setCompanyLogoUrl] = useState('');
  const [appTitle, setAppTitle] = useState('Digital Presensi');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [userSession, setUserSession] = useState<UserSession | null>(null);
  const [sharedDeviceMode, setSharedDeviceMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [secretClickCount, setSecretClickCount] = useState(0);
  const secretClickTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Hidden click handler for superadmin access
  const handleSecretClick = () => {
    const newCount = secretClickCount + 1;
    setSecretClickCount(newCount);
    
    // Reset counter after 3 seconds of no clicks
    if (secretClickTimeoutRef.current) {
      clearTimeout(secretClickTimeoutRef.current);
    }
    secretClickTimeoutRef.current = setTimeout(() => {
      setSecretClickCount(0);
    }, 3000);
    
    // Navigate to superadmin login after 5 clicks
    if (newCount >= 5) {
      navigate('/login');
      setSecretClickCount(0);
      if (secretClickTimeoutRef.current) {
        clearTimeout(secretClickTimeoutRef.current);
      }
    }
  };

  // Auto-detect timezone from device
  const getDeviceTimezone = () => {
    const stored = localStorage.getItem('user_timezone');
    if (stored) return stored;

    // Auto-detect based on device UTC offset
    const offset = -new Date().getTimezoneOffset() / 60;
    let detectedTz = 'WIB'; // Default
    
    if (offset >= 8.5) detectedTz = 'WIT';  // UTC+9
    else if (offset >= 7.5) detectedTz = 'WITA'; // UTC+8
    else detectedTz = 'WIB'; // UTC+7
    
    localStorage.setItem('user_timezone', detectedTz);
    return detectedTz;
  };

  const [timezone, setTimezone] = useState(getDeviceTimezone());

  useEffect(() => {
    // Check shared device mode (kiosk)
    const kioskMode = localStorage.getItem('shared_device_mode') === 'true';
    setSharedDeviceMode(kioskMode);

    // Check user session
    const sessionData = localStorage.getItem('userSession');
    if (sessionData) {
      try {
        const session = JSON.parse(sessionData) as UserSession;
        setUserSession(session);
      } catch (error) {
        console.error('Error parsing session:', error);
        localStorage.removeItem('userSession');
      }
    }

    // If not kiosk mode and not logged in, redirect to login
    if (!kioskMode && !sessionData) {
      setLoading(false);
      navigate('/user-login');
      return;
    }

    setLoading(false);

    // Fetch logo URL and app title from settings
    const fetchSettings = async () => {
      try {
        const { data } = await supabase
          .from('app_settings')
          .select('setting_key, setting_value')
          .in('setting_key', ['app_logo_url', 'company_logo_url', 'app_title']);
        
        if (data && data.length > 0) {
          const logoSetting = data.find(item => item.setting_key === 'app_logo_url');
          const companyLogoSetting = data.find(item => item.setting_key === 'company_logo_url');
          const titleSetting = data.find(item => item.setting_key === 'app_title');
          
          if (logoSetting?.setting_value) {
            setLogoUrl(logoSetting.setting_value);
          }
          if (companyLogoSetting?.setting_value) {
            setCompanyLogoUrl(companyLogoSetting.setting_value);
          }
          if (titleSetting?.setting_value) {
            setAppTitle(titleSetting.setting_value);
          }
        }
      } catch (error) {
        console.log('Settings not configured');
      }
    };
    
    fetchSettings();

    // Update time every second
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, [navigate]);

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
    const seconds = localTime.getSeconds().toString().padStart(2, '0');
    
    return `${hours}:${minutes}:${seconds} ${tz}`;
  };

  // Show loading while checking session
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Ad Popup */}
      <AdPopup />
      
      {/* Animated background elements */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-20 left-20 w-32 h-32 bg-primary/20 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-20 right-20 w-48 h-48 bg-primary/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-accent/10 rounded-full blur-3xl animate-pulse delay-2000"></div>
      </div>

      {/* Header */}
      <div className="relative z-10 flex flex-col items-center text-center p-4 sm:p-6 pb-2 space-y-2">
        <div className="flex flex-col items-center space-y-2">
          <div className="flex items-center justify-between w-full max-w-md gap-3">
            <div className="flex items-center gap-3 flex-1 justify-center">
              {/* Logo in header - only for NON-kiosk mode */}
              {logoUrl && !sharedDeviceMode && (
                <img 
                  src={logoUrl} 
                  alt="Company Logo" 
                  className="h-12 w-12 sm:h-16 sm:w-16 object-contain bg-transparent"
                  onError={(e) => {
                    console.log('Logo failed to load');
                  }}
                />
              )}
              <div onClick={handleSecretClick} className="cursor-default select-none">
                <h1 className="text-2xl sm:text-3xl font-bold text-title-primary">{appTitle}</h1>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              {/* Profile button - only show when logged in (not kiosk) */}
              {userSession && !sharedDeviceMode && (
                <Button
                  variant="outline" 
                  size="sm"
                  onClick={() => navigate('/user-profile')}
                  className="bg-primary/10 border-primary/20 text-primary hover:bg-primary/20 backdrop-blur-sm transition-all duration-300 hover:scale-105 p-2"
                >
                  <User className="h-4 w-4" />
                </Button>
              )}

              {/* Login button for kiosk mode - to access personal mode */}
              {sharedDeviceMode && (
                <Button
                  variant="outline" 
                  size="sm"
                  onClick={() => navigate('/user-login')}
                  className="bg-primary/10 border-primary/20 text-primary hover:bg-primary/20 backdrop-blur-sm transition-all duration-300 hover:scale-105 p-2"
                  title="Login Personal"
                >
                  <LogIn className="h-4 w-4" />
                </Button>
              )}

              {/* Admin Dashboard button - show for superadmin or staff with is_admin=true */}
              {(userSession?.is_admin || localStorage.getItem('adminSession')) && (
                <Button
                  variant="outline" 
                  size="sm"
                  onClick={() => navigate('/dashboard')}
                  className="bg-amber-500/10 border-amber-500/20 text-amber-600 hover:bg-amber-500/20 backdrop-blur-sm transition-all duration-300 hover:scale-105 p-2"
                  title="Admin Dashboard"
                >
                  <Shield className="h-4 w-4" />
                </Button>
              )}

            </div>
          </div>
        </div>
      </div>


      {/* Main Attendance Form */}
      <div className="relative z-10 flex items-center justify-center px-4 pt-2">
        <div className="w-full max-w-md">
          <AttendanceForm companyLogoUrl={companyLogoUrl} />
          
          {/* App Logo at Bottom - ONLY for Kiosk Mode */}
          {sharedDeviceMode && logoUrl && (
            <div className="mt-6 flex justify-center">
              <div className="p-4 bg-card/50 rounded-xl backdrop-blur-sm border border-border/50">
                <img 
                  src={logoUrl} 
                  alt="App Logo" 
                  className="h-20 w-auto max-w-[200px] object-contain"
                  onError={(e) => {
                    console.log('App logo failed to load');
                  }}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Index;
