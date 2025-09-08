import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { Settings, MapPin, Users, Clock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import AttendanceForm from '../components/AttendanceForm';

const Index = () => {
  const navigate = useNavigate();
  const [logoUrl, setLogoUrl] = useState('');
  const [appTitle, setAppTitle] = useState('Smart Zone Absensi');

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
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 relative overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0 opacity-20">
        <div className="absolute top-20 left-20 w-32 h-32 bg-blue-500/20 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-20 right-20 w-48 h-48 bg-purple-500/20 rounded-full blur-3xl animate-pulse delay-1000"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl animate-pulse delay-2000"></div>
      </div>

      {/* Header */}
      <div className="relative z-10 flex flex-col items-center text-center p-4 sm:p-6 space-y-6">
        <div className="flex flex-col items-center space-y-4">
          <div className="flex items-center justify-center gap-3">
            {logoUrl && (
              <img 
                src={logoUrl} 
                alt="Company Logo" 
                className="h-12 w-12 sm:h-16 sm:w-16 object-contain rounded-lg shadow-lg"
                onError={(e) => {
                  console.log('Logo failed to load');
                }}
              />
            )}
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white">{appTitle}</h1>
            </div>
          </div>
        </div>
        
        <Button 
          variant="outline" 
          onClick={() => navigate('/login')}
          className="bg-white/10 border-white/20 text-white hover:bg-white/20 backdrop-blur-sm transition-all duration-300 hover:scale-105"
        >
          <Settings className="h-4 w-4 mr-2" />
          <span className="hidden sm:inline">Admin Login</span>
          <span className="sm:hidden">Admin</span>
        </Button>
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
