import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Settings, Save, Image, Sparkles, Upload, Loader2, X, KeyRound, Eye, EyeOff } from 'lucide-react';
import FeatureFlagSettings from './FeatureFlagSettings';

const AppSettings = () => {
  const [logoUrl, setLogoUrl] = useState('');
  const [appTitle, setAppTitle] = useState('');
  const [appVersion, setAppVersion] = useState('');
  const [changelog, setChangelog] = useState('');
  const [defaultPassword, setDefaultPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('app_settings')
        .select('setting_key, setting_value')
        .in('setting_key', ['app_logo_url', 'app_title', 'app_current_version', 'app_version_changelog', 'default_user_password']);

      if (error && error.code !== 'PGRST116') throw error;

      if (data && data.length > 0) {
        setLogoUrl(data.find(item => item.setting_key === 'app_logo_url')?.setting_value || '');
        setAppTitle(data.find(item => item.setting_key === 'app_title')?.setting_value || 'Digital Absensi');
        setAppVersion(data.find(item => item.setting_key === 'app_current_version')?.setting_value || 'v2.2.0');
        setChangelog(data.find(item => item.setting_key === 'app_version_changelog')?.setting_value || '');
        setDefaultPassword(data.find(item => item.setting_key === 'default_user_password')?.setting_value || 'PTG2025');
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
      toast({ title: "Gagal", description: "Gagal memuat pengaturan", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast({ title: "Error", description: "Pilih file gambar (PNG, JPG, etc.)", variant: "destructive" });
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast({ title: "Error", description: "Ukuran file maksimal 2MB", variant: "destructive" });
      return;
    }

    setUploadingLogo(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `app-logo-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('staff-photos')
        .upload(fileName, file, { cacheControl: '3600', upsert: false });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from('staff-photos').getPublicUrl(fileName);

      setLogoUrl(publicUrl);

      toast({ title: "Berhasil", description: "Logo Aplikasi berhasil diupload" });
    } catch (error) {
      console.error('Error uploading logo:', error);
      toast({ title: "Gagal", description: "Gagal mengupload logo", variant: "destructive" });
    } finally {
      setUploadingLogo(false);
    }
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      const settingsToUpdate = [
        { setting_key: 'app_logo_url', setting_value: logoUrl, description: 'Logo aplikasi untuk header dan favicon' },
        { setting_key: 'app_title', setting_value: appTitle, description: 'Application title' },
        { setting_key: 'app_current_version', setting_value: appVersion, description: 'Current version' },
        { setting_key: 'app_version_changelog', setting_value: changelog, description: 'Changelog' },
        { setting_key: 'default_user_password', setting_value: defaultPassword, description: 'Default password untuk user baru atau reset password' }
      ];

      if (appTitle) document.title = appTitle;
      if (logoUrl) {
        let favicon = document.querySelector("link[rel*='icon']") as HTMLLinkElement;
        if (!favicon) { favicon = document.createElement('link'); favicon.rel = 'icon'; document.head.appendChild(favicon); }
        favicon.href = logoUrl;
      }

      const { error } = await supabase.from('app_settings').upsert(settingsToUpdate, { onConflict: 'setting_key' });
      if (error) throw error;

      toast({ title: "Berhasil", description: "Pengaturan berhasil disimpan." });
    } catch (error) {
      console.error('Error saving settings:', error);
      toast({ title: "Gagal", description: "Gagal menyimpan pengaturan", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Card className="bg-white border-gray-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-black">
            <Settings className="h-5 w-5" />
            Application Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {loading ? (
            <div className="text-center py-8 text-black">Loading settings...</div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="appTitle" className="text-black flex items-center gap-2">
                  <Settings className="h-4 w-4" />
                  Application Title
                </Label>
                <Input id="appTitle" type="text" value={appTitle} onChange={(e) => setAppTitle(e.target.value)} placeholder="Smart Zone Absensi" className="bg-white border-gray-300 text-black" />
              </div>

              {/* App Logo Upload */}
              <div className="space-y-2">
                <Label className="text-black flex items-center gap-2">
                  <Image className="h-4 w-4" />
                  Logo Aplikasi (Header, Favicon)
                </Label>
                <div className="flex gap-2">
                  <input ref={fileInputRef} type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
                  <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={uploadingLogo} className="flex-1">
                    {uploadingLogo ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Uploading...</> : <><Upload className="h-4 w-4 mr-2" />Upload Logo Aplikasi</>}
                  </Button>
                  {logoUrl && <Button type="button" variant="outline" onClick={() => setLogoUrl('')} className="text-destructive"><X className="h-4 w-4" /></Button>}
                </div>
                {logoUrl && <img src={logoUrl} alt="App Logo" className="h-12 w-12 object-contain rounded-lg border" />}
              </div>

              {/* Security Settings */}
              <div className="space-y-4 pt-4 border-t border-gray-200">
                <h3 className="font-semibold text-black flex items-center gap-2"><KeyRound className="h-4 w-4" />Security Settings</h3>
                <div className="space-y-2">
                  <Label htmlFor="defaultPassword" className="text-black">Default User Password</Label>
                  <p className="text-xs text-muted-foreground">Password default untuk user baru atau saat reset password</p>
                  <div className="relative">
                    <Input 
                      id="defaultPassword" 
                      type={showPassword ? "text" : "password"} 
                      value={defaultPassword} 
                      onChange={(e) => setDefaultPassword(e.target.value)} 
                      placeholder="Masukkan password default" 
                      className="bg-white border-gray-300 text-black pr-10" 
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4 text-gray-500" /> : <Eye className="h-4 w-4 text-gray-500" />}
                    </Button>
                  </div>
                </div>
              </div>

              {/* Version Control */}
              <div className="space-y-4 pt-4 border-t border-gray-200">
                <h3 className="font-semibold text-black flex items-center gap-2"><Sparkles className="h-4 w-4" />Version Control</h3>
                <div className="space-y-2">
                  <Label htmlFor="appVersion" className="text-black">App Version</Label>
                  <Input id="appVersion" type="text" value={appVersion} onChange={(e) => setAppVersion(e.target.value)} placeholder="v2.2.0" className="bg-white border-gray-300 text-black" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="changelog" className="text-black">Changelog</Label>
                  <p className="text-xs text-muted-foreground">Gunakan ---PAGE--- untuk memisahkan halaman carousel</p>
                  <Textarea id="changelog" value={changelog} onChange={(e) => setChangelog(e.target.value)} placeholder="• Fitur baru&#10;---PAGE---&#10;# Panduan&#10;1. Langkah pertama" rows={6} className="bg-white border-gray-300 text-black resize-none" />
                </div>
              </div>

              <div className="flex justify-end pt-4">
                <Button onClick={saveSettings} disabled={saving} className="bg-blue-600 text-white hover:bg-blue-700">
                  <Save className="h-4 w-4 mr-2" />{saving ? 'Saving...' : 'Save Settings'}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Feature Flags Section */}
      <div className="mt-6">
        <FeatureFlagSettings />
      </div>
    </>
  );
};

export default AppSettings;
