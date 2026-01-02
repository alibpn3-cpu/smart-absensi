import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { LogIn, User, Lock, ArrowLeft, Loader2 } from 'lucide-react';
import ChangePasswordDialog from '@/components/ChangePasswordDialog';

interface UserSession {
  uid: string;
  name: string;
  position: string;
  work_area: string;
  division?: string;
  photo_url?: string;
  is_admin: boolean;
  employee_type?: string;
}

const UserLogin = () => {
  const navigate = useNavigate();
  const [credentials, setCredentials] = useState({ uid: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [pendingUser, setPendingUser] = useState<UserSession | null>(null);
  const [appTitle, setAppTitle] = useState('Digital Presensi');
  const [logoUrl, setLogoUrl] = useState('');

  useEffect(() => {
    // Check if already logged in
    const userSession = localStorage.getItem('userSession');
    if (userSession) {
      navigate('/');
      return;
    }

    // Fetch app settings
    fetchAppSettings();
  }, [navigate]);

  const fetchAppSettings = async () => {
    const { data } = await supabase
      .from('app_settings')
      .select('setting_key, setting_value')
      .in('setting_key', ['app_title', 'app_logo_url']);

    if (data) {
      const titleSetting = data.find(d => d.setting_key === 'app_title');
      const logoSetting = data.find(d => d.setting_key === 'app_logo_url');
      if (titleSetting?.setting_value) setAppTitle(titleSetting.setting_value);
      if (logoSetting?.setting_value) setLogoUrl(logoSetting.setting_value);
    }
  };

  const getDefaultPassword = async (): Promise<string> => {
    try {
      const { data } = await supabase
        .from('app_settings')
        .select('setting_value')
        .eq('setting_key', 'default_user_password')
        .maybeSingle();
      return data?.setting_value || 'PTG2025';
    } catch {
      return 'PTG2025';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!credentials.uid.trim() || !credentials.password.trim()) {
      toast({
        title: "Gagal",
        description: "Masukkan UID dan password",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);

    try {
      // Find staff by UID
      const { data: staff, error } = await supabase
        .from('staff_users')
        .select('uid, name, position, work_area, division, photo_url, is_active, password_hash, is_first_login, is_admin, employee_type')
        .eq('uid', credentials.uid.toUpperCase().trim())
        .maybeSingle();

      if (error) throw error;

      if (!staff) {
        toast({
          title: "Gagal",
          description: "UID tidak ditemukan",
          variant: "destructive"
        });
        setLoading(false);
        return;
      }

      if (!staff.is_active) {
        toast({
          title: "Gagal",
          description: "Akun Anda tidak aktif. Hubungi admin.",
          variant: "destructive"
        });
        setLoading(false);
        return;
      }

      // Get default password from database
      const defaultPassword = await getDefaultPassword();

      // Verify password (plain text comparison)
      const storedPassword = staff.password_hash || defaultPassword;
      const isPasswordValid = credentials.password === storedPassword;

      if (!isPasswordValid) {
        toast({
          title: "Gagal",
          description: "Password salah",
          variant: "destructive"
        });
        setLoading(false);
        return;
      }

      // Create user session
      const userSession: UserSession = {
        uid: staff.uid,
        name: staff.name,
        position: staff.position,
        work_area: staff.work_area,
        division: staff.division || undefined,
        photo_url: staff.photo_url || undefined,
        is_admin: staff.is_admin || false,
        employee_type: staff.employee_type || 'staff'
      };

      // Check if first login - require password change
      if (staff.is_first_login) {
        setPendingUser(userSession);
        setShowChangePassword(true);
        setLoading(false);
        return;
      }

      // Save session and redirect
      localStorage.setItem('userSession', JSON.stringify(userSession));
      toast({
        title: "Berhasil",
        description: `Selamat datang, ${staff.name}!`
      });
      navigate('/');
    } catch (error) {
      console.error('Login error:', error);
      toast({
        title: "Gagal",
        description: "Terjadi kesalahan saat login",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordChanged = () => {
    if (pendingUser) {
      localStorage.setItem('userSession', JSON.stringify(pendingUser));
      toast({
        title: "Berhasil",
        description: `Selamat datang, ${pendingUser.name}!`
      });
      navigate('/');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          {logoUrl && (
            <img src={logoUrl} alt="Logo" className="h-16 w-16 mx-auto object-contain" />
          )}
          <h1 className="text-2xl font-bold text-foreground">{appTitle}</h1>
          <p className="text-muted-foreground">Login dengan User Anda</p>
        </div>

        <Card className="border-2 shadow-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <LogIn className="h-5 w-5 text-primary" />
              Login Staff
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="uid" className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  User Staff
                </Label>
                <Input
                  id="uid"
                  type="text"
                  placeholder="Masukkan User Anda"
                  value={credentials.uid}
                  onChange={(e) => setCredentials({ ...credentials, uid: e.target.value.toUpperCase() })}
                  disabled={loading}
                  className="h-12 text-lg uppercase"
                  autoComplete="username"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="flex items-center gap-2">
                  <Lock className="h-4 w-4" />
                  Password
                </Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Masukkan password"
                  value={credentials.password}
                  onChange={(e) => setCredentials({ ...credentials, password: e.target.value })}
                  disabled={loading}
                  className="h-12"
                  autoComplete="current-password"
                />                
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full h-12 text-lg font-semibold"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                    Memproses...
                  </>
                ) : (
                  <>
                    <LogIn className="h-5 w-5 mr-2" />
                    Login
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Back to home for kiosk mode devices */}
        <div className="text-center">
          <Button
            variant="ghost"
            onClick={() => navigate('/')}
            className="text-muted-foreground"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Kembali
          </Button>
        </div>
      </div>

      {/* Change Password Dialog */}
      {pendingUser && (
        <ChangePasswordDialog
          isOpen={showChangePassword}
          onClose={() => {
            setShowChangePassword(false);
            setPendingUser(null);
          }}
          userUid={pendingUser.uid}
          userName={pendingUser.name}
          onPasswordChanged={handlePasswordChanged}
        />
      )}
    </div>
  );
};

export default UserLogin;
