import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Settings, Save, Image, Monitor, AlertTriangle, Sparkles, Upload, Loader2, X, Building2, MapPin } from 'lucide-react';
import FeatureFlagSettings from './FeatureFlagSettings';

interface GeofenceArea {
  id: string;
  name: string;
  is_active: boolean;
}

const AppSettings = () => {
  const [logoUrl, setLogoUrl] = useState('');
  const [companyLogoUrl, setCompanyLogoUrl] = useState('');
  const [appTitle, setAppTitle] = useState('');
  const [timezone, setTimezone] = useState('WIB');
  const [sharedDeviceMode, setSharedDeviceMode] = useState(false);
  const [kioskGeofenceArea, setKioskGeofenceArea] = useState<string>('');
  const [geofenceAreas, setGeofenceAreas] = useState<GeofenceArea[]>([]);
  const [appVersion, setAppVersion] = useState('');
  const [changelog, setChangelog] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingCompanyLogo, setUploadingCompanyLogo] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const companyFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchSettings();
    fetchGeofenceAreas();
    const localKioskMode = localStorage.getItem('shared_device_mode');
    setSharedDeviceMode(localKioskMode === 'true');
    const localKioskGeofence = localStorage.getItem('kiosk_geofence_area');
    if (localKioskGeofence) {
      setKioskGeofenceArea(localKioskGeofence);
    }
  }, []);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('app_settings')
        .select('setting_key, setting_value')
        .in('setting_key', ['app_logo_url', 'company_logo_url', 'app_title', 'app_timezone', 'app_current_version', 'app_version_changelog']);

      if (error && error.code !== 'PGRST116') throw error;

      if (data && data.length > 0) {
        setLogoUrl(data.find(item => item.setting_key === 'app_logo_url')?.setting_value || '');
        setCompanyLogoUrl(data.find(item => item.setting_key === 'company_logo_url')?.setting_value || '');
        setAppTitle(data.find(item => item.setting_key === 'app_title')?.setting_value || 'Digital Absensi');
        setTimezone(data.find(item => item.setting_key === 'app_timezone')?.setting_value || 'WIB');
        setAppVersion(data.find(item => item.setting_key === 'app_current_version')?.setting_value || 'v2.2.0');
        setChangelog(data.find(item => item.setting_key === 'app_version_changelog')?.setting_value || '');
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
      toast({ title: "Gagal", description: "Gagal memuat pengaturan", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const fetchGeofenceAreas = async () => {
    try {
      const { data, error } = await supabase
        .from('geofence_areas')
        .select('id, name, is_active')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setGeofenceAreas(data || []);
    } catch (error) {
      console.error('Error fetching geofence areas:', error);
    }
  };

  const handleSharedDeviceModeChange = (checked: boolean) => {
    setSharedDeviceMode(checked);
    if (checked) {
      localStorage.setItem('shared_device_mode', 'true');
    } else {
      localStorage.removeItem('shared_device_mode');
      // Also clear geofence area when disabling kiosk mode
      localStorage.removeItem('kiosk_geofence_area');
      setKioskGeofenceArea('');
    }
    toast({
      title: checked ? "Kiosk Mode Aktif" : "Kiosk Mode Nonaktif",
      description: checked ? "Mode kiosk aktif untuk browser/device ini" : "Mode kiosk dinonaktifkan untuk browser/device ini"
    });
  };

  const handleKioskGeofenceChange = (geofenceId: string) => {
    setKioskGeofenceArea(geofenceId);
    if (geofenceId && geofenceId !== 'none') {
      localStorage.setItem('kiosk_geofence_area', geofenceId);
      const selectedArea = geofenceAreas.find(g => g.id === geofenceId);
      toast({
        title: "Area Kiosk Diset",
        description: `Device ini akan menggunakan area "${selectedArea?.name}" untuk absensi kiosk`
      });
    } else {
      localStorage.removeItem('kiosk_geofence_area');
      toast({
        title: "Area Kiosk Dihapus",
        description: "Device ini akan menggunakan GPS untuk validasi lokasi"
      });
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>, isCompanyLogo = false) => {
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

    isCompanyLogo ? setUploadingCompanyLogo(true) : setUploadingLogo(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${isCompanyLogo ? 'company' : 'app'}-logo-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('staff-photos')
        .upload(fileName, file, { cacheControl: '3600', upsert: false });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from('staff-photos').getPublicUrl(fileName);

      if (isCompanyLogo) {
        setCompanyLogoUrl(publicUrl);
      } else {
        setLogoUrl(publicUrl);
      }

      toast({ title: "Berhasil", description: `${isCompanyLogo ? 'Logo Perusahaan' : 'Logo Aplikasi'} berhasil diupload` });
    } catch (error) {
      console.error('Error uploading logo:', error);
      toast({ title: "Gagal", description: "Gagal mengupload logo", variant: "destructive" });
    } finally {
      isCompanyLogo ? setUploadingCompanyLogo(false) : setUploadingLogo(false);
    }
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      const settingsToUpdate = [
        { setting_key: 'app_logo_url', setting_value: logoUrl, description: 'Logo aplikasi untuk header dan favicon' },
        { setting_key: 'company_logo_url', setting_value: companyLogoUrl, description: 'Logo perusahaan untuk Kiosk Mode' },
        { setting_key: 'app_title', setting_value: appTitle, description: 'Application title' },
        { setting_key: 'app_timezone', setting_value: timezone, description: 'Application timezone' },
        { setting_key: 'app_current_version', setting_value: appVersion, description: 'Current version' },
        { setting_key: 'app_version_changelog', setting_value: changelog, description: 'Changelog' }
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
                  <input ref={fileInputRef} type="file" accept="image/*" onChange={(e) => handleLogoUpload(e, false)} className="hidden" />
                  <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={uploadingLogo} className="flex-1">
                    {uploadingLogo ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Uploading...</> : <><Upload className="h-4 w-4 mr-2" />Upload Logo Aplikasi</>}
                  </Button>
                  {logoUrl && <Button type="button" variant="outline" onClick={() => setLogoUrl('')} className="text-destructive"><X className="h-4 w-4" /></Button>}
                </div>
                {logoUrl && <img src={logoUrl} alt="App Logo" className="h-12 w-12 object-contain rounded-lg border" />}
              </div>

              {/* Company Logo Upload */}
              <div className="space-y-2">
                <Label className="text-black flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  Logo Perusahaan (Kiosk Mode - Card Besar)
                </Label>
                <div className="flex gap-2">
                  <input ref={companyFileInputRef} type="file" accept="image/*" onChange={(e) => handleLogoUpload(e, true)} className="hidden" />
                  <Button type="button" variant="outline" onClick={() => companyFileInputRef.current?.click()} disabled={uploadingCompanyLogo} className="flex-1">
                    {uploadingCompanyLogo ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Uploading...</> : <><Upload className="h-4 w-4 mr-2" />Upload Logo Perusahaan</>}
                  </Button>
                  {companyLogoUrl && <Button type="button" variant="outline" onClick={() => setCompanyLogoUrl('')} className="text-destructive"><X className="h-4 w-4" /></Button>}
                </div>
                {companyLogoUrl && <img src={companyLogoUrl} alt="Company Logo" className="h-20 w-auto object-contain rounded-lg border p-2" />}
                <p className="text-xs text-gray-600">Logo ini akan tampil sebagai card besar di Kiosk Mode</p>
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
                  <Textarea id="changelog" value={changelog} onChange={(e) => setChangelog(e.target.value)} placeholder="• Fitur baru" rows={4} className="bg-white border-gray-300 text-black resize-none" />
                </div>
              </div>

              {/* Kiosk Mode */}
              <div className="space-y-4 pt-4 border-t border-gray-200">
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="sharedDeviceMode" className="text-black flex items-center gap-2"><Monitor className="h-4 w-4" />Shared Device Mode (Kiosk)</Label>
                    <p className="text-xs text-gray-600">Mode untuk perangkat absensi bersama.</p>
                  </div>
                  <Switch id="sharedDeviceMode" checked={sharedDeviceMode} onCheckedChange={handleSharedDeviceModeChange} />
                </div>

                {/* Kiosk Device Area - Only show when Kiosk mode is enabled */}
                {sharedDeviceMode && (
                  <div className="space-y-2 pl-6 border-l-2 border-primary/30">
                    <Label className="text-black flex items-center gap-2">
                      <MapPin className="h-4 w-4" />
                      Area Device Kiosk
                    </Label>
                    <Select value={kioskGeofenceArea || 'none'} onValueChange={handleKioskGeofenceChange}>
                      <SelectTrigger className="bg-white border-gray-300 text-black">
                        <SelectValue placeholder="Pilih area geofence..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">-- Gunakan GPS (Default) --</SelectItem>
                        {geofenceAreas.map((area) => (
                          <SelectItem key={area.id} value={area.id}>
                            {area.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-gray-600">
                      {kioskGeofenceArea && kioskGeofenceArea !== 'none' 
                        ? "✅ Device ini akan bypass GPS check dan menggunakan area yang dipilih"
                        : "⚠️ Device ini akan menggunakan GPS untuk validasi lokasi"}
                    </p>
                  </div>
                )}
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
