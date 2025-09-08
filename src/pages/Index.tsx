import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { Settings, MapPin, Users, Clock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import AttendanceForm from '../components/AttendanceForm';

const Index = () => {
  const navigate = useNavigate();
  const [logoUrl, setLogoUrl] = useState('');

  useEffect(() => {
    // Fetch logo URL from settings
    const fetchLogo = async () => {
      try {
        const { data } = await supabase
          .from('app_settings')
          .select('setting_value')
          .eq('setting_key', 'app_logo_url')
          .single();
        
        if (data?.setting_value) {
          setLogoUrl(data.setting_value);
        }
      } catch (error) {
        console.log('Logo not configured');
      }
    };
    
    fetchLogo();
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
      <div className="relative z-10 flex justify-between items-center p-4 sm:p-6">
        <div className="flex items-center gap-3">
          {logoUrl && (
            <img 
              src={logoUrl} 
              alt="Company Logo" 
              className="h-10 w-10 object-contain rounded-lg"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          )}
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-white">Smart Zone Absensi</h1>
            <p className="text-slate-300 text-sm">Modern Attendance Management System</p>
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

      {/* Hero Section */}
      <div className="relative z-10 text-center px-4 py-8">
        <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-4 animate-fade-in">
          Sistem Absensi <span className="text-blue-400">Terdepan</span>
        </h2>
        <p className="text-slate-300 text-lg sm:text-xl mb-8 max-w-2xl mx-auto animate-fade-in">
          Solusi absensi modern dengan teknologi geofence, selfie verification, dan real-time monitoring
        </p>
        
        {/* Feature highlights */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 max-w-4xl mx-auto mb-12">
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20 hover:bg-white/20 transition-all duration-300 animate-slide-up">
            <MapPin className="h-8 w-8 text-blue-400 mx-auto mb-3" />
            <h3 className="text-white font-semibold mb-2">Geofence Technology</h3>
            <p className="text-slate-300 text-sm">Absen hanya di lokasi yang ditentukan dengan teknologi GPS</p>
          </div>
          
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20 hover:bg-white/20 transition-all duration-300 animate-slide-up delay-100">
            <Users className="h-8 w-8 text-green-400 mx-auto mb-3" />
            <h3 className="text-white font-semibold mb-2">Selfie Verification</h3>
            <p className="text-slate-300 text-sm">Verifikasi identitas dengan foto selfie untuk keamanan maksimal</p>
          </div>
          
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20 hover:bg-white/20 transition-all duration-300 animate-slide-up delay-200">
            <Clock className="h-8 w-8 text-purple-400 mx-auto mb-3" />
            <h3 className="text-white font-semibold mb-2">Real-time Monitoring</h3>
            <p className="text-slate-300 text-sm">Pantau kehadiran karyawan secara real-time dan akurat</p>
          </div>
        </div>
      </div>

      {/* Main Attendance Form */}
      <div className="relative z-10 flex items-center justify-center px-4 pb-8">
        <div className="w-full max-w-md">
          <AttendanceForm />
        </div>
      </div>
    </div>
  );
};

export default Index;
