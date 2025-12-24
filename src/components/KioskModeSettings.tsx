import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Monitor, Upload, Loader2, X, Building2, MapPin } from 'lucide-react';

interface GeofenceArea {
  id: string;
  name: string;
  is_active: boolean;
}

const KioskModeSettings = () => {
  const [companyLogoUrl, setCompanyLogoUrl] = useState('');
  const [sharedDeviceMode, setSharedDeviceMode] = useState(false);
  const [kioskGeofenceArea, setKioskGeofenceArea] = useState<string>('');
  const [geofenceAreas, setGeofenceAreas] = useState<GeofenceArea[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploadingCompanyLogo, setUploadingCompanyLogo] = useState(false);
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
        .eq('setting_key', 'company_logo_url');

      if (error && error.code !== 'PGRST116') throw error;

      if (data && data.length > 0) {
        setCompanyLogoUrl(data[0]?.setting_value || '');
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

    setUploadingCompanyLogo(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `company-logo-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('staff-photos')
        .upload(fileName, file, { cacheControl: '3600', upsert: false });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from('staff-photos').getPublicUrl(fileName);

      setCompanyLogoUrl(publicUrl);

      // Save to app_settings
      await supabase.from('app_settings').upsert({
        setting_key: 'company_logo_url',
        setting_value: publicUrl,
        description: 'Logo perusahaan untuk Kiosk Mode'
      }, { onConflict: 'setting_key' });

      toast({ title: "Berhasil", description: "Logo Perusahaan berhasil diupload" });
    } catch (error) {
      console.error('Error uploading logo:', error);
      toast({ title: "Gagal", description: "Gagal mengupload logo", variant: "destructive" });
    } finally {
      setUploadingCompanyLogo(false);
    }
  };

  const handleRemoveLogo = async () => {
    try {
      setCompanyLogoUrl('');
      await supabase.from('app_settings').upsert({
        setting_key: 'company_logo_url',
        setting_value: '',
        description: 'Logo perusahaan untuk Kiosk Mode'
      }, { onConflict: 'setting_key' });
      toast({ title: "Berhasil", description: "Logo Perusahaan dihapus" });
    } catch (error) {
      console.error('Error removing logo:', error);
      toast({ title: "Gagal", description: "Gagal menghapus logo", variant: "destructive" });
    }
  };

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-foreground">
          <Monitor className="h-5 w-5" />
          Kiosk Mode Settings
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {loading ? (
          <div className="text-center py-8 text-foreground">Loading settings...</div>
        ) : (
          <div className="space-y-6">
            {/* Kiosk Mode Toggle */}
            <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
              <div>
                <Label htmlFor="sharedDeviceMode" className="text-foreground flex items-center gap-2 font-medium">
                  <Monitor className="h-4 w-4" />
                  Shared Device Mode (Kiosk)
                </Label>
                <p className="text-sm text-muted-foreground mt-1">
                  Aktifkan mode ini untuk perangkat absensi bersama. Mode ini akan menyembunyikan menu navigasi dan menampilkan interface khusus kiosk.
                </p>
              </div>
              <Switch id="sharedDeviceMode" checked={sharedDeviceMode} onCheckedChange={handleSharedDeviceModeChange} />
            </div>

            {/* Kiosk Device Area - Only show when Kiosk mode is enabled */}
            {sharedDeviceMode && (
              <div className="space-y-4 p-4 border-l-4 border-primary/50 bg-primary/5 rounded-r-lg">
                <div className="space-y-2">
                  <Label className="text-foreground flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    Area Device Kiosk
                  </Label>
                  <Select value={kioskGeofenceArea || 'none'} onValueChange={handleKioskGeofenceChange}>
                    <SelectTrigger className="bg-background border-border text-foreground">
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
                  <p className="text-sm text-muted-foreground">
                    {kioskGeofenceArea && kioskGeofenceArea !== 'none' 
                      ? "✅ Device ini akan bypass GPS check dan menggunakan area yang dipilih"
                      : "⚠️ Device ini akan menggunakan GPS untuk validasi lokasi"}
                  </p>
                </div>
              </div>
            )}

            {/* Company Logo Upload */}
            <div className="space-y-4 pt-4 border-t border-border">
              <Label className="text-foreground flex items-center gap-2 font-medium">
                <Building2 className="h-4 w-4" />
                Logo Perusahaan (Kiosk Mode - Card Besar)
              </Label>
              <div className="flex gap-2">
                <input ref={companyFileInputRef} type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
                <Button type="button" variant="outline" onClick={() => companyFileInputRef.current?.click()} disabled={uploadingCompanyLogo} className="flex-1">
                  {uploadingCompanyLogo ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Uploading...</> : <><Upload className="h-4 w-4 mr-2" />Upload Logo Perusahaan</>}
                </Button>
                {companyLogoUrl && <Button type="button" variant="outline" onClick={handleRemoveLogo} className="text-destructive"><X className="h-4 w-4" /></Button>}
              </div>
              {companyLogoUrl && (
                <div className="p-4 bg-muted/50 rounded-lg">
                  <img src={companyLogoUrl} alt="Company Logo" className="h-24 w-auto object-contain rounded-lg border mx-auto" />
                </div>
              )}
              <p className="text-sm text-muted-foreground">Logo ini akan tampil sebagai card besar di Kiosk Mode</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default KioskModeSettings;
