import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Menu, User, FileText, RefreshCw, Bug, MapPin, Camera, Satellite, Star,
  LogOut, Info, Lock, Shield, ChevronRight, BarChart3, MapPinned
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { getMonthlyAccumulatedScore } from '@/hooks/useScoreCalculation';
import { useFeatureFlags } from '@/hooks/useFeatureFlags';
import DebugLogger from './DebugLogger';
import ChangePasswordDialog from './ChangePasswordDialog';

interface UserSession {
  uid: string;
  name: string;
  position: string;
  work_area: string;
  division?: string;
  photo_url?: string;
  is_admin: boolean;
  is_site_admin?: boolean;
  is_manager?: boolean;
  employee_type?: string;
}

const UserSidebar: React.FC = () => {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [userSession, setUserSession] = useState<UserSession | null>(null);
  const [appVersion, setAppVersion] = useState('v2.2.0');
  const [permissions, setPermissions] = useState({ location: false, camera: false });
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [monthlyScore, setMonthlyScore] = useState<number | null>(null);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [isSubAdmin, setIsSubAdmin] = useState(false);
  const featureFlags = useFeatureFlags();

  useEffect(() => {
    if (!open) return;

    const sessionData = localStorage.getItem('userSession');
    if (sessionData) {
      setUserSession(JSON.parse(sessionData));
    }

    // Load permissions
    const storedPerms = localStorage.getItem('attendance_permissions');
    if (storedPerms) {
      setPermissions(JSON.parse(storedPerms));
    }

    // Fetch version
    supabase.from('app_settings').select('setting_value').eq('setting_key', 'app_current_version').maybeSingle()
      .then(({ data }) => { if (data?.setting_value) setAppVersion(data.setting_value); });
  }, [open]);

  // Fetch score & GPS when opened
  useEffect(() => {
    if (!open || !userSession) return;

    getMonthlyAccumulatedScore(userSession.uid).then(setMonthlyScore);
    checkGps();

    // Check sub-admin status from DB
    supabase
      .from('staff_users')
      .select('show_attendance_status, is_admin, is_site_admin, work_area')
      .eq('uid', userSession.uid)
      .maybeSingle()
      .then(({ data }) => {
        setIsSubAdmin(!!data?.show_attendance_status);
        if (data) {
          const refreshedSession = {
            ...userSession,
            is_admin: !!data.is_admin,
            is_site_admin: !!(data as any).is_site_admin,
            work_area: data.work_area || userSession.work_area,
          };
          setUserSession(refreshedSession);
          localStorage.setItem('userSession', JSON.stringify(refreshedSession));
        }
      });
  }, [open, userSession?.uid]);

  const hasAdminDashboardAccess = !!userSession?.is_admin || !!userSession?.is_site_admin;

  const checkGps = async () => {
    setGpsLoading(true);
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true, timeout: 10000, maximumAge: 0
        });
      });
      setGpsAccuracy(pos.coords.accuracy);
      setPermissions(prev => ({ ...prev, location: true }));
    } catch {
      setGpsAccuracy(null);
    }
    setGpsLoading(false);
  };

  const requestPermissions = async () => {
    const newPerms = { location: false, camera: false };

    try {
      await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true, timeout: 10000, maximumAge: 0
        });
      });
      newPerms.location = true;
    } catch {}

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }, audio: false
      });
      stream.getTracks().forEach(t => t.stop());
      newPerms.camera = true;
    } catch {}

    localStorage.setItem('attendance_permissions', JSON.stringify(newPerms));
    setPermissions(newPerms);

    if (newPerms.location && newPerms.camera) {
      toast({ title: '✅ Berhasil', description: 'Semua izin diberikan' });
    } else {
      toast({ title: '⚠️ Perhatian', description: 'Beberapa izin belum diberikan', variant: 'destructive' });
    }
  };

  const handleClearCache = async () => {
    try {
      const kioskMode = localStorage.getItem('shared_device_mode');
      const deviceId = localStorage.getItem('device_id');
      const userTimezone = localStorage.getItem('user_timezone');
      const installedVersion = localStorage.getItem('app_installed_version');

      localStorage.clear();
      sessionStorage.clear();

      if (kioskMode) localStorage.setItem('shared_device_mode', kioskMode);
      if (deviceId) localStorage.setItem('device_id', deviceId);
      if (userTimezone) localStorage.setItem('user_timezone', userTimezone);
      if (installedVersion) localStorage.setItem('app_installed_version', installedVersion);

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
      toast({ title: 'Berhasil', description: 'Cache dibersihkan. Memuat ulang...' });
    } catch {
      toast({ title: 'Gagal', description: 'Tidak dapat membersihkan cache', variant: 'destructive' });
    } finally {
      setTimeout(() => window.location.reload(), 500);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('userSession');
    localStorage.removeItem('last_selected_staff');
    localStorage.removeItem('attendance_status');
    toast({ title: 'Berhasil', description: 'Anda telah logout' });
    setOpen(false);
    navigate('/user-login');
  };

  const currentMonth = new Date().toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });

  const getGpsLabel = () => {
    if (gpsLoading) return { label: 'Mengambil...', color: 'text-muted-foreground' };
    if (gpsAccuracy === null) return { label: 'Tidak tersedia', color: 'text-destructive' };
    if (gpsAccuracy <= 10) return { label: `${gpsAccuracy.toFixed(0)}m - Sangat Akurat`, color: 'text-green-600' };
    if (gpsAccuracy <= 30) return { label: `${gpsAccuracy.toFixed(0)}m - Cukup Akurat`, color: 'text-yellow-600' };
    return { label: `${gpsAccuracy.toFixed(0)}m - Kurang Akurat`, color: 'text-destructive' };
  };

  const gps = getGpsLabel();

  return (
    <>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="bg-primary/10 border-primary/20 text-primary hover:bg-primary/20 backdrop-blur-sm transition-all duration-300 hover:scale-105 p-2"
          >
            <Menu className="h-4 w-4" />
          </Button>
        </SheetTrigger>
        <SheetContent side="right" className="w-[85vw] max-w-[340px] overflow-y-auto">
          <SheetHeader className="text-left">
            <SheetTitle className="text-lg">Menu</SheetTitle>
          </SheetHeader>

          {userSession && (
            <div className="space-y-4 mt-4">
              {/* Profile Section */}
              <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                <Avatar className="h-12 w-12">
                  <AvatarImage src={userSession.photo_url} />
                  <AvatarFallback className="bg-primary text-primary-foreground font-bold">
                    {userSession.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate">{userSession.name}</p>
                  <p className="text-xs text-muted-foreground font-mono">{userSession.uid}</p>
                  <p className="text-xs text-muted-foreground">{userSession.position}</p>
                </div>
                {hasAdminDashboardAccess && (
                  <Badge variant="secondary" className={`${userSession.is_site_admin ? 'bg-emerald-100 text-emerald-800 border-emerald-300' : 'bg-amber-100 text-amber-800 border-amber-300'} text-[10px]`}>
                    {userSession.is_site_admin ? <MapPinned className="h-3 w-3 mr-0.5" /> : <Shield className="h-3 w-3 mr-0.5" />}
                    {userSession.is_site_admin ? 'Site Admin' : 'Admin'}
                  </Badge>
                )}
              </div>

              {/* Score Card */}
              {featureFlags.scoreEnabled && monthlyScore !== null && (
                <div className="flex items-center justify-between p-3 bg-amber-50 dark:bg-amber-950/20 rounded-lg">
                  <div>
                    <p className="text-sm font-medium text-amber-800 dark:text-amber-200">Total Bintang</p>
                    <p className="text-xs text-amber-600 dark:text-amber-400">{currentMonth}</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Star className="h-5 w-5 fill-yellow-400 text-yellow-400" />
                    <span className="text-lg font-bold text-amber-800 dark:text-amber-200">
                      {monthlyScore % 1 === 0 ? monthlyScore.toFixed(0) : monthlyScore.toFixed(1)}
                    </span>
                  </div>
                </div>
              )}

              {/* GPS Accuracy */}
              <div className="p-3 bg-muted/50 rounded-lg space-y-2">
                <div className="flex items-center gap-2">
                  <Satellite className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">Akurasi GPS</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className={`text-sm ${gps.color}`}>{gps.label}</span>
                  <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={checkGps}>
                    <RefreshCw className={`h-3 w-3 mr-1 ${gpsLoading ? 'animate-spin' : ''}`} />
                    Refresh
                  </Button>
                </div>
              </div>

              {/* Permissions */}
              <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    <div className={`w-2 h-2 rounded-full ${permissions.location ? 'bg-green-500' : 'bg-red-500'}`} />
                    <MapPin className={`h-3.5 w-3.5 ${permissions.location ? 'text-green-600' : 'text-red-600'}`} />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className={`w-2 h-2 rounded-full ${permissions.camera ? 'bg-green-500' : 'bg-red-500'}`} />
                    <Camera className={`h-3.5 w-3.5 ${permissions.camera ? 'text-green-600' : 'text-red-600'}`} />
                  </div>
                </div>
                {(!permissions.location || !permissions.camera) && (
                  <Button variant="outline" size="sm" className="h-7 text-xs" onClick={requestPermissions}>
                    Minta Izin
                  </Button>
                )}
              </div>

              <Separator />

              {/* Navigation Items */}
              <div className="space-y-1">
                {(featureFlags.leaveRequestEnabled || featureFlags.permissionRequestEnabled) && (
                  <Button
                    variant="ghost"
                    className="w-full justify-between h-11"
                    onClick={() => { setOpen(false); navigate('/requests'); }}
                  >
                    <div className="flex items-center gap-3">
                      <FileText className="h-4 w-4 text-primary" />
                      <span>Permintaan Cuti & Ijin</span>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </Button>
                )}

                {isSubAdmin && (
                  <Button
                    variant="ghost"
                    className="w-full justify-between h-11"
                    onClick={() => { setOpen(false); navigate('/reports'); }}
                  >
                    <div className="flex items-center gap-3">
                      <BarChart3 className="h-4 w-4 text-primary" />
                      <span>Laporan Sub-Admin</span>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </Button>
                )}

                {hasAdminDashboardAccess && (
                  <Button
                    variant="ghost"
                    className="w-full justify-between h-11"
                    onClick={() => { setOpen(false); navigate('/dashboard'); }}
                  >
                    <div className="flex items-center gap-3">
                      {userSession.is_site_admin ? (
                        <MapPinned className="h-4 w-4 text-primary" />
                      ) : (
                        <Shield className="h-4 w-4 text-primary" />
                      )}
                      <span>{userSession.is_site_admin ? 'Menu Site Admin' : 'Menu Admin'}</span>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </Button>
                )}

                <Button
                  variant="ghost"
                  className="w-full justify-between h-11"
                  onClick={() => { setOpen(false); navigate('/user-profile'); }}
                >
                  <div className="flex items-center gap-3">
                    <User className="h-4 w-4 text-primary" />
                    <span>Profil Saya</span>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </Button>

                <Button
                  variant="ghost"
                  className="w-full justify-start gap-3 h-11"
                  onClick={() => setShowChangePassword(true)}
                >
                  <Lock className="h-4 w-4 text-primary" />
                  <span>Ubah Password</span>
                </Button>
              </div>

              <Separator />

              {/* Tools */}
              <div className="space-y-1">
                <Button
                  variant="ghost"
                  className="w-full justify-start gap-3 h-11"
                  onClick={handleClearCache}
                >
                  <RefreshCw className="h-4 w-4 text-primary" />
                  <span>Update (Hapus Cache)</span>
                </Button>

                {/* Debug Logger inline */}
                <div className="px-1">
                  <DebugLogger
                    staffUid={userSession.uid}
                    staffName={userSession.name}
                    workAreas={[]}
                    permissions={permissions}
                  />
                </div>
              </div>

              <Separator />

              {/* Logout */}
              <Button
                variant="destructive"
                className="w-full justify-start gap-3 h-11"
                onClick={handleLogout}
              >
                <LogOut className="h-4 w-4" />
                <span>Logout</span>
              </Button>

              {/* Version */}
              <div className="text-center text-xs text-muted-foreground pt-2">
                <p>Versi: {appVersion}</p>
                <p className="mt-0.5">IT Division</p>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Change Password Dialog */}
      {userSession && (
        <ChangePasswordDialog
          isOpen={showChangePassword}
          onClose={() => setShowChangePassword(false)}
          userUid={userSession.uid}
          userName={userSession.name}
          onPasswordChanged={() => {
            setShowChangePassword(false);
            toast({ title: 'Berhasil', description: 'Password berhasil diubah' });
          }}
          currentPasswordRequired={true}
        />
      )}
    </>
  );
};

export default UserSidebar;
