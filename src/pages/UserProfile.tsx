import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { toast } from '@/hooks/use-toast';
import { ArrowLeft, User, MapPin, Briefcase, Building2, LogOut, Lock, Shield, FileText, Phone, Mail, Save, Loader2, Camera, Bell, BellOff, Sunrise } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import ChangePasswordDialog from '@/components/ChangePasswordDialog';
import QRCodeDisplay from '@/components/QRCodeDisplay';
import { usePushNotifications } from '@/hooks/usePushNotifications';

interface UserSession {
  uid: string;
  name: string;
  position: string;
  work_area: string;
  division?: string;
  photo_url?: string;
  is_admin: boolean;
}

const UserProfile = () => {
  const navigate = useNavigate();
  const [userSession, setUserSession] = useState<UserSession | null>(null);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [email, setEmail] = useState('');
  const [morningReminder, setMorningReminder] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [photoUrl, setPhotoUrl] = useState<string | undefined>(undefined);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const push = usePushNotifications(userSession?.uid);

  useEffect(() => {
    const sessionData = localStorage.getItem('userSession');
    if (!sessionData) {
      navigate('/user-login');
      return;
    }

    try {
      const session = JSON.parse(sessionData) as UserSession;
      setUserSession(session);
      setPhotoUrl(session.photo_url);
      fetchContactInfo(session.uid);
    } catch (error) {
      console.error('Error parsing session:', error);
      navigate('/user-login');
    }
  }, [navigate]);

  const fetchContactInfo = async (uid: string) => {
    setIsLoading(true);
    const { data } = await supabase
      .from('staff_users')
      .select('phone_number, email, photo_url, morning_reminder_enabled')
      .eq('uid', uid)
      .maybeSingle();

    if (data) {
      setPhoneNumber(data.phone_number || '');
      setEmail((data as any).email || '');
      setPhotoUrl((data as any).photo_url || undefined);
      setMorningReminder((data as any).morning_reminder_enabled !== false);
    }
    setIsLoading(false);
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !userSession) return;
    if (!file.type.startsWith('image/')) {
      toast({ title: 'Gagal', description: 'File harus berupa gambar', variant: 'destructive' });
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast({ title: 'Gagal', description: 'Ukuran maksimal 2MB', variant: 'destructive' });
      return;
    }
    setUploadingPhoto(true);
    try {
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
      const path = `${userSession.uid}-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from('staff-photos').upload(path, file, {
        cacheControl: '3600', upsert: false, contentType: file.type,
      });
      if (upErr) throw upErr;
      const { data: { publicUrl } } = supabase.storage.from('staff-photos').getPublicUrl(path);

      const { error: dbErr } = await supabase
        .from('staff_users')
        .update({ photo_url: publicUrl })
        .eq('uid', userSession.uid);
      if (dbErr) throw dbErr;

      setPhotoUrl(publicUrl);
      // Refresh session in localStorage so other pages pick it up
      const updated = { ...userSession, photo_url: publicUrl };
      setUserSession(updated);
      localStorage.setItem('userSession', JSON.stringify(updated));
      toast({ title: 'Berhasil', description: 'Foto profil diperbarui' });
    } catch (err: any) {
      toast({ title: 'Gagal', description: err.message || 'Upload gagal', variant: 'destructive' });
    } finally {
      setUploadingPhoto(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleToggleMorningReminder = async (v: boolean) => {
    if (!userSession) return;
    setMorningReminder(v);
    const { error } = await supabase
      .from('staff_users')
      .update({ morning_reminder_enabled: v } as any)
      .eq('uid', userSession.uid);
    if (error) {
      setMorningReminder(!v);
      toast({ title: 'Gagal', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Tersimpan', description: v ? 'Reminder pagi aktif' : 'Reminder pagi dimatikan' });
    }
  };

  const handleTogglePush = async (v: boolean) => {
    if (v) {
      const ok = await push.subscribe();
      if (!ok) {
        if (push.permission === 'denied') {
          toast({ title: 'Diblokir', description: 'Izinkan notifikasi di pengaturan browser', variant: 'destructive' });
        } else {
          toast({ title: 'Gagal', description: 'Tidak dapat mengaktifkan push', variant: 'destructive' });
        }
      } else {
        toast({ title: 'Berhasil', description: 'Push notifikasi diaktifkan' });
      }
    } else {
      await push.unsubscribe();
      toast({ title: 'Tersimpan', description: 'Push notifikasi dimatikan' });
    }
  };

  const handleSaveContact = async () => {
    if (!userSession) return;
    setIsSaving(true);

    const { error } = await supabase
      .from('staff_users')
      .update({ phone_number: phoneNumber || null, email: email || null } as any)
      .eq('uid', userSession.uid);

    setIsSaving(false);

    if (error) {
      toast({ title: "Gagal", description: "Gagal menyimpan data kontak", variant: "destructive" });
    } else {
      toast({ title: "Berhasil", description: "Data kontak berhasil disimpan" });
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('userSession');
    localStorage.removeItem('last_selected_staff');
    localStorage.removeItem('attendance_status');
    toast({
      title: "Berhasil",
      description: "Anda telah logout"
    });
    navigate('/user-login');
  };

  const handlePasswordChanged = () => {
    setShowChangePassword(false);
    toast({
      title: "Berhasil",
      description: "Password berhasil diubah"
    });
  };

  if (!userSession) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted p-4">
      <div className="max-w-md mx-auto space-y-6">
        {/* Back Button */}
        <Button
          variant="ghost"
          onClick={() => navigate('/')}
          className="text-muted-foreground"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Kembali
        </Button>

        {/* Profile Card */}
        <Card className="border-2 shadow-xl overflow-hidden">
          {/* Header with gradient */}
          <div className="h-24 bg-gradient-to-r from-primary to-primary/70" />
          
          {/* Avatar overlapping header */}
          <div className="px-6 -mt-12 relative w-fit">
            <Avatar className="h-24 w-24 border-4 border-background shadow-lg">
              <AvatarImage src={photoUrl} alt={userSession.name} />
              <AvatarFallback className="text-2xl font-bold bg-primary text-primary-foreground">
                {userSession.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
              </AvatarFallback>
            </Avatar>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingPhoto}
              className="absolute bottom-0 right-0 h-8 w-8 rounded-full bg-primary text-primary-foreground shadow-md flex items-center justify-center hover:scale-105 transition disabled:opacity-50"
              title="Ganti foto profil"
            >
              {uploadingPhoto ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handlePhotoUpload}
            />
          </div>


          <CardHeader className="pt-2">
            <div className="flex items-center gap-2 flex-wrap">
              <CardTitle className="text-2xl">{userSession.name}</CardTitle>
              {userSession.is_admin && (
                <Badge variant="secondary" className="bg-amber-100 text-amber-800 border-amber-300">
                  <Shield className="h-3 w-3 mr-1" />
                  Admin
                </Badge>
              )}
            </div>
            <p className="text-muted-foreground font-mono">{userSession.uid}</p>
          </CardHeader>

          <CardContent className="space-y-4">
            {/* Info Items */}
            <div className="grid gap-3">
              <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Briefcase className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Jabatan</p>
                  <p className="font-medium">{userSession.position}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <MapPin className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Area Tugas</p>
                  <p className="font-medium">{userSession.work_area}</p>
                </div>
              </div>

              {userSession.division && (
                <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <Building2 className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Divisi</p>
                    <p className="font-medium">{userSession.division}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Contact Info - Editable */}
            <div className="space-y-3 pt-4 border-t">
              <p className="text-sm font-semibold text-muted-foreground">Informasi Kontak</p>
              
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                  <Input
                    placeholder="Nomor WhatsApp (cth: 6281234567890)"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    disabled={isLoading}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                  <Input
                    type="email"
                    placeholder="Alamat Email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={isLoading}
                  />
                </div>
                <Button
                  onClick={handleSaveContact}
                  disabled={isSaving || isLoading}
                  className="w-full"
                  size="sm"
                >
                  {isSaving ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  Simpan Kontak
                </Button>
              </div>
            </div>

            </div>

            {/* Preferensi Notifikasi */}
            <div className="space-y-3 pt-4 border-t">
              <p className="text-sm font-semibold text-muted-foreground">Preferensi Notifikasi</p>

              {push.supported && (
                <div className="flex items-center justify-between gap-3 p-3 bg-muted/40 rounded-lg">
                  <div className="flex items-center gap-3 min-w-0">
                    {push.subscribed ? <Bell className="h-4 w-4 text-primary shrink-0" /> : <BellOff className="h-4 w-4 text-muted-foreground shrink-0" />}
                    <div className="min-w-0">
                      <div className="text-sm font-medium">Push Notifikasi</div>
                      <div className="text-xs text-muted-foreground">Terima notifikasi langsung di perangkat ini.</div>
                    </div>
                  </div>
                  <Switch
                    checked={push.subscribed}
                    onCheckedChange={handleTogglePush}
                    disabled={push.loading}
                  />
                </div>
              )}

              <div className="flex items-center justify-between gap-3 p-3 bg-muted/40 rounded-lg">
                <div className="flex items-center gap-3 min-w-0">
                  <Sunrise className="h-4 w-4 text-amber-500 shrink-0" />
                  <div className="min-w-0">
                    <div className="text-sm font-medium">Reminder Clock-In Pagi</div>
                    <div className="text-xs text-muted-foreground">Pengingat otomatis jika belum absen di pagi hari.</div>
                  </div>
                </div>
                <Switch
                  checked={morningReminder}
                  onCheckedChange={handleToggleMorningReminder}
                  disabled={isLoading}
                />
              </div>
            </div>

            {/* Actions */}
            <div className="space-y-3 pt-4 border-t">

              <Button
                variant="outline"
                className="w-full justify-start h-12"
                onClick={() => navigate('/requests')}
              >
                <FileText className="h-5 w-5 mr-3" />
                Permintaan Cuti & Ijin
              </Button>

              <Button
                variant="outline"
                className="w-full justify-start h-12"
                onClick={() => setShowChangePassword(true)}
              >
                <Lock className="h-5 w-5 mr-3" />
                Ubah Password
              </Button>

              <Button
                variant="destructive"
                className="w-full justify-start h-12"
                onClick={handleLogout}
              >
                <LogOut className="h-5 w-5 mr-3" />
                Logout
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* QR Code Card */}
        <QRCodeDisplay 
          uid={userSession.uid} 
          name={userSession.name} 
          size={200}
          showDownload={true}
        />
      </div>

      {/* Change Password Dialog */}
      <ChangePasswordDialog
        isOpen={showChangePassword}
        onClose={() => setShowChangePassword(false)}
        userUid={userSession.uid}
        userName={userSession.name}
        onPasswordChanged={handlePasswordChanged}
        currentPasswordRequired={true}
      />
    </div>
  );
};

export default UserProfile;
