import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { toast } from '@/hooks/use-toast';
import { ArrowLeft, User, MapPin, Briefcase, Building2, LogOut, Lock, Shield } from 'lucide-react';
import ChangePasswordDialog from '@/components/ChangePasswordDialog';

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

  useEffect(() => {
    const sessionData = localStorage.getItem('userSession');
    if (!sessionData) {
      navigate('/user-login');
      return;
    }

    try {
      const session = JSON.parse(sessionData) as UserSession;
      setUserSession(session);
    } catch (error) {
      console.error('Error parsing session:', error);
      navigate('/user-login');
    }
  }, [navigate]);

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
          <div className="px-6 -mt-12">
            <Avatar className="h-24 w-24 border-4 border-background shadow-lg">
              <AvatarImage src={userSession.photo_url} alt={userSession.name} />
              <AvatarFallback className="text-2xl font-bold bg-primary text-primary-foreground">
                {userSession.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
              </AvatarFallback>
            </Avatar>
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

            {/* Actions */}
            <div className="space-y-3 pt-4 border-t">
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
