import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Settings, Save, Image, Monitor, AlertTriangle, Sparkles, Upload, Loader2, X } from 'lucide-react';

const AppSettings = () => {
  const [logoUrl, setLogoUrl] = useState('');
  const [appTitle, setAppTitle] = useState('');
  const [timezone, setTimezone] = useState('WIB');
  const [sharedDeviceMode, setSharedDeviceMode] = useState(false);
  const [appVersion, setAppVersion] = useState('');
  const [changelog, setChangelog] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchSettings();
    // Load shared device mode from localStorage (per-device setting)
    const localKioskMode = localStorage.getItem('shared_device_mode');
    setSharedDeviceMode(localKioskMode === 'true');
  }, []);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('app_settings')
        .select('setting_key, setting_value')
        .in('setting_key', ['app_logo_url', 'app_title', 'app_timezone', 'app_current_version', 'app_version_changelog']);

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (data && data.length > 0) {
        const logoSetting = data.find(item => item.setting_key === 'app_logo_url');
        const titleSetting = data.find(item => item.setting_key === 'app_title');
        const timezoneSetting = data.find(item => item.setting_key === 'app_timezone');
        const versionSetting = data.find(item => item.setting_key === 'app_current_version');
        const changelogSetting = data.find(item => item.setting_key === 'app_version_changelog');
        
        setLogoUrl(logoSetting?.setting_value || '');
        setAppTitle(titleSetting?.setting_value || 'Digital Absensi');
        setTimezone(timezoneSetting?.setting_value || 'WIB');
        setAppVersion(versionSetting?.setting_value || 'v2.2.0');
        setChangelog(changelogSetting?.setting_value || '');
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
      toast({
        title: "Gagal",
        description: "Gagal memuat pengaturan",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSharedDeviceModeChange = (checked: boolean) => {
    setSharedDeviceMode(checked);
    // Save to localStorage (per-device setting)
    if (checked) {
      localStorage.setItem('shared_device_mode', 'true');
    } else {
      localStorage.removeItem('shared_device_mode');
    }
    toast({
      title: checked ? "Kiosk Mode Aktif" : "Kiosk Mode Nonaktif",
      description: checked 
        ? "Mode kiosk aktif untuk browser/device ini" 
        : "Mode kiosk dinonaktifkan untuk browser/device ini"
    });
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Error",
        description: "Pilih file gambar (PNG, JPG, etc.)",
        variant: "destructive"
      });
      return;
    }

    // Check file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast({
        title: "Error",
        description: "Ukuran file maksimal 2MB",
        variant: "destructive"
      });
      return;
    }

    setUploadingLogo(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `company-logo-${Date.now()}.${fileExt}`;

      // Upload to staff-photos bucket (public bucket)
      const { error: uploadError } = await supabase.storage
        .from('staff-photos')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('staff-photos')
        .getPublicUrl(fileName);

      setLogoUrl(publicUrl);

      toast({
        title: "Berhasil",
        description: "Logo berhasil diupload"
      });
    } catch (error) {
      console.error('Error uploading logo:', error);
      toast({
        title: "Gagal",
        description: "Gagal mengupload logo",
        variant: "destructive"
      });
    } finally {
      setUploadingLogo(false);
    }
  };

  const removeLogo = () => {
    setLogoUrl('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      const settingsToUpdate = [
        {
          setting_key: 'app_logo_url',
          setting_value: logoUrl,
          description: 'URL for the application logo displayed in the header'
        },
        {
          setting_key: 'app_title',
          setting_value: appTitle,
          description: 'Application title displayed on main page and forms'
        },
        {
          setting_key: 'app_timezone',
          setting_value: timezone,
          description: 'Application timezone for clock display'
        },
        {
          setting_key: 'app_current_version',
          setting_value: appVersion,
          description: 'Current application version'
        },
        {
          setting_key: 'app_version_changelog',
          setting_value: changelog,
          description: 'Changelog for current version'
        }
      ];

      // Update browser tab title and favicon
      if (appTitle) {
        document.title = appTitle;
      }
      if (logoUrl) {
        let favicon = document.querySelector("link[rel*='icon']") as HTMLLinkElement;
        if (!favicon) {
          favicon = document.createElement('link');
          favicon.rel = 'icon';
          document.head.appendChild(favicon);
        }
        favicon.href = logoUrl;

        // Also update apple-touch-icon
        let appleTouchIcon = document.querySelector("link[rel='apple-touch-icon']") as HTMLLinkElement;
        if (!appleTouchIcon) {
          appleTouchIcon = document.createElement('link');
          appleTouchIcon.rel = 'apple-touch-icon';
          document.head.appendChild(appleTouchIcon);
        }
        appleTouchIcon.href = logoUrl;
      }

      const { error } = await supabase
        .from('app_settings')
        .upsert(settingsToUpdate, {
          onConflict: 'setting_key'
        });

      if (error) throw error;

      toast({
        title: "Berhasil",
        description: "Pengaturan berhasil disimpan. Semua user akan menerima notifikasi update."
      });
    } catch (error) {
      console.error('Error saving settings:', error);
      toast({
        title: "Gagal",
        description: "Gagal menyimpan pengaturan",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  return (
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
            {/* Application Title */}
            <div className="space-y-2">
              <Label htmlFor="appTitle" className="text-black flex items-center gap-2">
                <Settings className="h-4 w-4" />
                Application Title
              </Label>
              <Input
                id="appTitle"
                type="text"
                value={appTitle}
                onChange={(e) => setAppTitle(e.target.value)}
                placeholder="Smart Zone Absensi"
                className="bg-white border-gray-300 text-black placeholder:text-gray-500"
              />
            </div>

            {/* Logo Upload */}
            <div className="space-y-2">
              <Label className="text-black flex items-center gap-2">
                <Image className="h-4 w-4" />
                Logo Perusahaan (untuk Kiosk, Favicon, App Icon)
              </Label>
              
              <div className="flex gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleLogoUpload}
                  className="hidden"
                  id="logo-upload"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingLogo}
                  className="flex-1"
                >
                  {uploadingLogo ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 mr-2" />
                      Upload Logo
                    </>
                  )}
                </Button>
                {logoUrl && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={removeLogo}
                    className="text-destructive"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
              <p className="text-xs text-gray-600">
                Format: PNG, JPG, WebP. Maksimal 2MB.
              </p>
            </div>

            {/* Logo Preview */}
            {(logoUrl || appTitle) && (
              <div className="space-y-2">
                <Label className="text-black">Preview</Label>
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 flex items-center gap-3">
                  {logoUrl && (
                    <img 
                      src={logoUrl} 
                      alt="Logo Preview" 
                      className="h-16 w-16 object-contain rounded-lg"
                      onError={(e) => {
                        e.currentTarget.src = '';
                        e.currentTarget.alt = 'Invalid URL';
                      }}
                    />
                  )}
                  <div>
                    <p className="text-black text-sm font-medium">{appTitle || 'Smart Zone Absensi'}</p>
                    <p className="text-xs text-gray-500">Logo akan tampil di Kiosk Mode dan sebagai favicon</p>
                  </div>
                </div>
              </div>
            )}

            {/* Version Control Section */}
            <div className="space-y-4 pt-4 border-t border-gray-200">
              <h3 className="font-semibold text-black flex items-center gap-2">
                <Sparkles className="h-4 w-4" />
                Version Control (Force Update)
              </h3>
              
              <div className="space-y-2">
                <Label htmlFor="appVersion" className="text-black">
                  App Version
                </Label>
                <Input
                  id="appVersion"
                  type="text"
                  value={appVersion}
                  onChange={(e) => setAppVersion(e.target.value)}
                  placeholder="v2.2.0"
                  className="bg-white border-gray-300 text-black placeholder:text-gray-500"
                />
                <p className="text-xs text-gray-600">
                  Saat versi berubah, semua user akan menerima popup update
                </p>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="changelog" className="text-black">
                  Changelog (per baris)
                </Label>
                <Textarea
                  id="changelog"
                  value={changelog}
                  onChange={(e) => setChangelog(e.target.value)}
                  placeholder="• Fitur baru A&#10;• Perbaikan bug B&#10;• Peningkatan performa"
                  rows={5}
                  className="bg-white border-gray-300 text-black placeholder:text-gray-500 resize-none"
                />
                <p className="text-xs text-gray-600">
                  Tulis satu fitur per baris. Akan ditampilkan di popup update.
                </p>
              </div>
            </div>

            {/* Shared Device Mode (Per-Device) */}
            <div className="space-y-2 pt-4 border-t border-gray-200">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="sharedDeviceMode" className="text-black flex items-center gap-2">
                    <Monitor className="h-4 w-4" />
                    Shared Device Mode (Kiosk)
                  </Label>
                  <p className="text-xs text-gray-600">
                    Mode untuk perangkat absensi bersama. Staff akan auto-reset setelah absensi.
                  </p>
                </div>
                <Switch
                  id="sharedDeviceMode"
                  checked={sharedDeviceMode}
                  onCheckedChange={handleSharedDeviceModeChange}
                />
              </div>
              
              <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <Monitor className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
                <div className="text-xs text-blue-800">
                  <p className="font-medium">⚠️ Setting Per-Device</p>
                  <p>Mode ini hanya berlaku untuk browser/device ini saja. Aktifkan di setiap perangkat kiosk secara terpisah.</p>
                </div>
              </div>
              
              {sharedDeviceMode && (
                <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                  <div className="text-xs text-amber-800">
                    <p className="font-medium">🖥️ Kiosk Mode Aktif</p>
                    <ul className="list-disc ml-4 mt-1 space-y-0.5">
                      <li>Staff tidak akan tersimpan di browser</li>
                      <li>Form akan reset otomatis setelah absensi</li>
                      <li>Cocok untuk terminal absensi bersama (30+ user/hari)</li>
                    </ul>
                  </div>
                </div>
              )}
            </div>

            {/* Save Button */}
            <div className="flex justify-end pt-4">
              <Button
                onClick={saveSettings}
                disabled={saving}
                className="bg-blue-600 text-white hover:bg-blue-700"
              >
                <Save className="h-4 w-4 mr-2" />
                {saving ? 'Saving...' : 'Save Settings'}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default AppSettings;
