import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { Settings, MapPin, Users, Clock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import AttendanceForm from '../components/AttendanceForm';

const Index = () => {
  const navigate = useNavigate();
  const [logoUrl, setLogoUrl] = useState('');
  const [appTitle, setAppTitle] = useState('Digital Absensi');
  const [currentTime, setCurrentTime] = useState(new Date());

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
    // Fetch logo URL and app title from settings
    const fetchSettings = async () => {
      try {
        const { data } = await supabase
          .from('app_settings')
          .select('setting_key, setting_value')
          .in('setting_key', ['app_logo_url', 'app_title']);
        
        if (data && data.length > 0) {
          const logoSetting = data.find(item => item.setting_key === 'app_logo_url');
          const titleSetting = data.find(item => item.setting_key === 'app_title');
          
          if (logoSetting?.setting_value) {
            setLogoUrl(logoSetting.setting_value);
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
  }, []);

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

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-20 left-20 w-32 h-32 bg-primary/20 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-20 right-20 w-48 h-48 bg-primary/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-accent/10 rounded-full blur-3xl animate-pulse delay-2000"></div>
      </div>

      {/* Header */}
      <div className="relative z-10 flex flex-col items-center text-center p-4 sm:p-6 space-y-6">
        <div className="flex flex-col items-center space-y-4">
          <div className="flex items-center justify-between w-full max-w-md gap-3">
            <div className="flex items-center gap-3 flex-1 justify-center">
              {logoUrl && (
                <img 
                  src={logoUrl} 
                  alt="Company Logo" 
                  className="h-12 w-12 sm:h-16 sm:w-16 object-contain bg-transparent"
                  onError={(e) => {
                    console.log('Logo failed to load');
                  }}
                />
              )}
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-title-primary">{appTitle}</h1>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Button
                variant="outline" 
                size="sm"
                onClick={() => navigate('/login')}
                className="bg-primary/10 border-primary/20 text-primary hover:bg-primary/20 backdrop-blur-sm transition-all duration-300 hover:scale-105 p-2"
              >
                <Settings className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>


      {/* Main Attendance Form */}
      <div className="relative z-10 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-md">
          <AttendanceForm />
        </div>
      </div>
    </div>
  );
};

export default Index;
