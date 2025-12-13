import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Settings, Save, Image, Clock, Monitor, AlertTriangle } from 'lucide-react';

const AppSettings = () => {
  const [logoUrl, setLogoUrl] = useState('');
  const [appTitle, setAppTitle] = useState('');
  const [timezone, setTimezone] = useState('WIB');
  const [sharedDeviceMode, setSharedDeviceMode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('app_settings')
        .select('setting_key, setting_value')
        .in('setting_key', ['app_logo_url', 'app_title', 'app_timezone', 'shared_device_mode']);

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (data && data.length > 0) {
        const logoSetting = data.find(item => item.setting_key === 'app_logo_url');
        const titleSetting = data.find(item => item.setting_key === 'app_title');
        const timezoneSetting = data.find(item => item.setting_key === 'app_timezone');
        const sharedDeviceSetting = data.find(item => item.setting_key === 'shared_device_mode');
        
        setLogoUrl(logoSetting?.setting_value || '');
        setAppTitle(titleSetting?.setting_value || 'Digital Absensi');
        setTimezone(timezoneSetting?.setting_value || 'WIB');
        setSharedDeviceMode(sharedDeviceSetting?.setting_value === 'true');
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
          setting_key: 'shared_device_mode',
          setting_value: sharedDeviceMode ? 'true' : 'false',
          description: 'Enable shared device mode for kiosk attendance terminals'
        }
      ];

      // Update browser tab title and favicon
      if (appTitle) {
        document.title = appTitle;
      }
      if (logoUrl) {
        // Update favicon
        let favicon = document.querySelector("link[rel*='icon']") as HTMLLinkElement;
        if (!favicon) {
          favicon = document.createElement('link');
          favicon.rel = 'icon';
          document.head.appendChild(favicon);
        }
        favicon.href = logoUrl;
      }

      const { error } = await supabase
        .from('app_settings')
        .upsert(settingsToUpdate, {
          onConflict: 'setting_key'
        });

      if (error) throw error;

      toast({
        title: "Berhasil",
        description: "Pengaturan berhasil disimpan"
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
            {/* Timezone Setting */}
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
              <p className="text-xs text-gray-600">
                Enter the title for your application. It will be displayed on the main page and browser tab.
              </p>
            </div>

            {/* Logo URL Setting */}
            <div className="space-y-2">
              <Label htmlFor="logoUrl" className="text-black flex items-center gap-2">
                <Image className="h-4 w-4" />
                Logo URL (Browser Tab Icon)
              </Label>
              <Input
                id="logoUrl"
                type="url"
                value={logoUrl}
                onChange={(e) => setLogoUrl(e.target.value)}
                placeholder="https://example.com/logo.png"
                className="bg-white border-gray-300 text-black placeholder:text-gray-500"
              />
              <p className="text-xs text-gray-600">
                Enter the URL of your company logo. It will be displayed in the main page header and browser tab icon.
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
                      className="h-10 w-10 object-contain rounded-lg"
                      onError={(e) => {
                        e.currentTarget.src = '';
                        e.currentTarget.alt = 'Invalid URL';
                      }}
                    />
                  )}
                  <div>
                    <p className="text-black text-sm font-medium">{appTitle || 'Smart Zone Absensi'}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Shared Device Mode */}
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
                  onCheckedChange={setSharedDeviceMode}
                />
              </div>
              
              {sharedDeviceMode && (
                <div className="flex items-start gap-2 mt-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                  <div className="text-xs text-amber-800">
                    <p className="font-medium">Mode Kiosk Aktif</p>
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
            <div className="flex justify-end">
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