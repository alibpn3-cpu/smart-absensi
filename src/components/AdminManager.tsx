import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Shield, Plus, Edit, Trash2, Key } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import bcrypt from 'bcryptjs';

interface AdminUser {
  id: string;
  username: string;
  created_at: string;
}

const AdminManager = () => {
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);
  const [editingAdmin, setEditingAdmin] = useState<AdminUser | null>(null);
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    confirmPassword: ''
  });
  const [passwordData, setPasswordData] = useState({
    newPassword: '',
    confirmPassword: ''
  });

  useEffect(() => {
    fetchAdmins();
  }, []);

  const fetchAdmins = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('admin_accounts')
      .select('id, username, created_at')
      .order('created_at', { ascending: false });

    if (error) {
      toast({
        title: "Gagal",
        description: "Gagal memuat akun admin",
        variant: "destructive"
      });
    } else {
      setAdmins(data || []);
    }
    setLoading(false);
  };

  const resetForm = () => {
    setFormData({
      username: '',
      password: '',
      confirmPassword: ''
    });
    setEditingAdmin(null);
  };

  const resetPasswordForm = () => {
    setPasswordData({
      newPassword: '',
      confirmPassword: ''
    });
  };

  const openDialog = (admin?: AdminUser) => {
    if (admin) {
      setEditingAdmin(admin);
      setFormData({
        username: admin.username,
        password: '',
        confirmPassword: ''
      });
    } else {
      resetForm();
    }
    setIsDialogOpen(true);
  };

  const openPasswordDialog = (admin: AdminUser) => {
    setEditingAdmin(admin);
    resetPasswordForm();
    setIsPasswordDialogOpen(true);
  };

  const hashPassword = async (password: string) => {
    const saltRounds = 10;
    return await bcrypt.hash(password, saltRounds);
  };

  const logActivity = async (actionType: string, targetName: string, details?: any) => {
    try {
      const sessionData = localStorage.getItem('adminSession');
      if (!sessionData) return;
      
      const session = JSON.parse(sessionData);
      await supabase.from('admin_activity_logs').insert({
        admin_username: session.username,
        action_type: actionType,
        target_type: 'admin',
        target_name: targetName,
        details: details || {}
      });
    } catch (error) {
      console.error('Error logging activity:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.username) {
      toast({
        title: "Gagal",
        description: "Username wajib diisi",
        variant: "destructive"
      });
      return;
    }

    if (!editingAdmin && !formData.password) {
      toast({
        title: "Gagal",
        description: "Password wajib diisi untuk admin baru",
        variant: "destructive"
      });
      return;
    }

    if (formData.password && formData.password !== formData.confirmPassword) {
      toast({
        title: "Gagal",
        description: "Password tidak cocok",
        variant: "destructive"
      });
      return;
    }

    try {
      if (editingAdmin) {
        // Update existing admin (username only)
        const { error } = await supabase
          .from('admin_accounts')
          .update({ username: formData.username })
          .eq('id', editingAdmin.id);

        if (error) throw error;
        
        await logActivity('update', formData.username, { action: 'Edit username' });
        
        toast({
          title: "Berhasil",
          description: "Akun admin berhasil diperbarui"
        });
      } else {
        // Check if username already exists
        const { data: existingAdmin } = await supabase
          .from('admin_accounts')
          .select('username')
          .eq('username', formData.username)
          .single();

        if (existingAdmin) {
          toast({
            title: "Gagal",
            description: "Username sudah ada",
            variant: "destructive"
          });
          return;
        }

        // Create new admin
        const hashedPassword = await hashPassword(formData.password);
        const { error } = await supabase
          .from('admin_accounts')
          .insert([{
            username: formData.username,
            password_hash: hashedPassword
          }]);

        if (error) throw error;
        
        await logActivity('create', formData.username, { action: 'Create new admin' });
        
        toast({
          title: "Berhasil",
          description: "Akun admin berhasil dibuat"
        });
      }

      setIsDialogOpen(false);
      resetForm();
      fetchAdmins();
    } catch (error) {
      console.error('Error saving admin:', error);
      toast({
        title: "Gagal",
        description: "Gagal menyimpan akun admin",
        variant: "destructive"
      });
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!passwordData.newPassword) {
      toast({
        title: "Gagal",
        description: "Password baru wajib diisi",
        variant: "destructive"
      });
      return;
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast({
        title: "Gagal",
        description: "Password tidak cocok",
        variant: "destructive"
      });
      return;
    }

    if (passwordData.newPassword.length < 6) {
      toast({
        title: "Gagal",
        description: "Password minimal 6 karakter",
        variant: "destructive"
      });
      return;
    }

    try {
      const hashedPassword = await hashPassword(passwordData.newPassword);
      const { error } = await supabase
        .from('admin_accounts')
        .update({ password_hash: hashedPassword })
        .eq('id', editingAdmin?.id);

      if (error) throw error;

      await logActivity('update', editingAdmin?.username || '', { action: 'Change password' });

      toast({
        title: "Berhasil",
        description: "Password berhasil diperbarui"
      });
      setIsPasswordDialogOpen(false);
      resetPasswordForm();
    } catch (error) {
      toast({
        title: "Gagal",
        description: "Gagal memperbarui password",
        variant: "destructive"
      });
    }
  };

  const deleteAdmin = async (admin: AdminUser) => {
    if (admins.length === 1) {
      toast({
        title: "Gagal",
        description: "Tidak dapat menghapus akun admin terakhir",
        variant: "destructive"
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('admin_accounts')
        .delete()
        .eq('id', admin.id);

      if (error) throw error;

      await logActivity('delete', admin.username, { action: 'Delete admin account' });

      toast({
        title: "Berhasil",
        description: "Akun admin berhasil dihapus"
      });
      fetchAdmins();
    } catch (error) {
      toast({
        title: "Gagal",
        description: "Gagal menghapus akun admin",
        variant: "destructive"
      });
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Admin Management
          </CardTitle>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => openDialog()} className="gradient-primary">
                <Plus className="h-4 w-4 mr-2" />
                Add Admin
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>
                  {editingAdmin ? 'Edit Admin' : 'Add New Admin'}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="username">Username *</Label>
                  <Input
                    id="username"
                    value={formData.username}
                    onChange={(e) => setFormData({...formData, username: e.target.value})}
                    placeholder="Enter username"
                  />
                </div>
                
                {!editingAdmin && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="password">Password *</Label>
                      <Input
                        id="password"
                        type="password"
                        value={formData.password}
                        onChange={(e) => setFormData({...formData, password: e.target.value})}
                        placeholder="Enter password (min 6 characters)"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="confirmPassword">Confirm Password *</Label>
                      <Input
                        id="confirmPassword"
                        type="password"
                        value={formData.confirmPassword}
                        onChange={(e) => setFormData({...formData, confirmPassword: e.target.value})}
                        placeholder="Confirm password"
                      />
                    </div>
                  </>
                )}
                
                <div className="flex gap-2 pt-4">
                  <Button type="submit" className="flex-1 gradient-primary">
                    {editingAdmin ? 'Update' : 'Create'} Admin
                  </Button>
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => {
                      setIsDialogOpen(false);
                      resetForm();
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-center py-8">Loading admin accounts...</div>
        ) : admins.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No admin accounts found.
          </div>
        ) : (
          <div className="space-y-4">
            {admins.map((admin) => (
              <div
                key={admin.id}
                className="border rounded-lg p-4 flex items-center justify-between hover:bg-muted/50 transition-colors"
              >
                <div className="flex-1">
                  <h3 className="font-semibold">{admin.username}</h3>
                  <p className="text-sm text-muted-foreground">
                    Created: {new Date(admin.created_at).toLocaleDateString('id-ID')}
                  </p>
                </div>
                
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openPasswordDialog(admin)}
                  >
                    <Key className="h-4 w-4" />
                  </Button>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openDialog(admin)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button 
                        variant="outline" 
                        size="sm"
                        disabled={admins.length === 1}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Admin</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to delete admin "{admin.username}"? This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => deleteAdmin(admin)}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Password Change Dialog */}
        <Dialog open={isPasswordDialogOpen} onOpenChange={setIsPasswordDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Change Password</DialogTitle>
            </DialogHeader>
            <form onSubmit={handlePasswordChange} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="newPassword">New Password *</Label>
                <Input
                  id="newPassword"
                  type="password"
                  value={passwordData.newPassword}
                  onChange={(e) => setPasswordData({...passwordData, newPassword: e.target.value})}
                  placeholder="Enter new password (min 6 characters)"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="confirmNewPassword">Confirm New Password *</Label>
                <Input
                  id="confirmNewPassword"
                  type="password"
                  value={passwordData.confirmPassword}
                  onChange={(e) => setPasswordData({...passwordData, confirmPassword: e.target.value})}
                  placeholder="Confirm new password"
                />
              </div>
              
              <div className="flex gap-2 pt-4">
                <Button type="submit" className="flex-1 gradient-primary">
                  Change Password
                </Button>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => {
                    setIsPasswordDialogOpen(false);
                    resetPasswordForm();
                  }}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};

export default AdminManager;