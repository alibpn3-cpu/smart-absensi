import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Lock, Eye, EyeOff, Loader2, AlertTriangle } from 'lucide-react';

interface ChangePasswordDialogProps {
  isOpen: boolean;
  onClose: () => void;
  userUid: string;
  userName: string;
  onPasswordChanged: () => void;
  currentPasswordRequired?: boolean; // For profile page
}

const ChangePasswordDialog: React.FC<ChangePasswordDialogProps> = ({
  isOpen,
  onClose,
  userUid,
  userName,
  onPasswordChanged,
  currentPasswordRequired = false
}) => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const resetForm = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate new password
    if (newPassword.length < 6) {
      toast({
        title: "Gagal",
        description: "Password baru minimal 6 karakter",
        variant: "destructive"
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      toast({
        title: "Gagal",
        description: "Konfirmasi password tidak cocok",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);

    try {
      // If current password is required, verify it first
      if (currentPasswordRequired) {
        const { data: staff } = await supabase
          .from('staff_users')
          .select('password_hash')
          .eq('uid', userUid)
          .maybeSingle();

        if (staff?.password_hash) {
          // Plain text comparison
          const isValid = currentPassword === staff.password_hash;
          if (!isValid) {
            toast({
              title: "Gagal",
              description: "Password lama tidak benar",
              variant: "destructive"
            });
            setLoading(false);
            return;
          }
        }

        // Check if new password is same as old
        if (currentPassword === newPassword) {
          toast({
            title: "Gagal",
            description: "Password baru tidak boleh sama dengan password lama",
            variant: "destructive"
          });
          setLoading(false);
          return;
        }
      }

      // Update password in database (plain text)
      const { error } = await supabase
        .from('staff_users')
        .update({
          password_hash: newPassword,
          is_first_login: false
        })
        .eq('uid', userUid);

      if (error) throw error;

      toast({
        title: "Berhasil",
        description: "Password berhasil diubah"
      });

      resetForm();
      onPasswordChanged();
    } catch (error) {
      console.error('Password change error:', error);
      toast({
        title: "Gagal",
        description: "Gagal mengubah password",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-primary" />
            Ubah Password
          </DialogTitle>
          <DialogDescription>
            {currentPasswordRequired 
              ? `Ubah password untuk akun ${userName}`
              : `Hai ${userName}! Ini adalah login pertama Anda. Silakan ubah password untuk keamanan akun.`
            }
          </DialogDescription>
        </DialogHeader>

        {!currentPasswordRequired && (
          <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg">
            <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
            <div className="text-sm text-amber-800 dark:text-amber-200">
              <p className="font-medium">Perhatian!</p>
              <p>Anda wajib mengganti password default sebelum melanjutkan.</p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {currentPasswordRequired && (
            <div className="space-y-2">
              <Label htmlFor="currentPassword">Password Lama</Label>
              <div className="relative">
                <Input
                  id="currentPassword"
                  type={showCurrentPassword ? 'text' : 'password'}
                  placeholder="Masukkan password lama"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  disabled={loading}
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                >
                  {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="newPassword">Password Baru</Label>
            <div className="relative">
              <Input
                id="newPassword"
                type={showNewPassword ? 'text' : 'password'}
                placeholder="Minimal 6 karakter"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                disabled={loading}
                className="pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3"
                onClick={() => setShowNewPassword(!showNewPassword)}
              >
                {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Konfirmasi Password Baru</Label>
            <div className="relative">
              <Input
                id="confirmPassword"
                type={showConfirmPassword ? 'text' : 'password'}
                placeholder="Ulangi password baru"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={loading}
                className="pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              >
                {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          <DialogFooter className="gap-2 pt-4">
            {currentPasswordRequired && (
              <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
                Batal
              </Button>
            )}
            <Button type="submit" disabled={loading} className="flex-1">
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Menyimpan...
                </>
              ) : (
                'Simpan Password'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default ChangePasswordDialog;
