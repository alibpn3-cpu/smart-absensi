import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Settings, Save, Image, Clock } from 'lucide-react';

const AppSettings = () => {
  const [logoUrl, setLogoUrl] = useState('');
  const [appTitle, setAppTitle] = useState('');
  const [timezone, setTimezone] = useState('WIB');
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
        .in('setting_key', ['app_logo_url', 'app_title', 'app_timezone']);

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (data && data.length > 0) {
        const logoSetting = data.find(item => item.setting_key === 'app_logo_url');
        const titleSetting = data.find(item => item.setting_key === 'app_title');
        const timezoneSetting = data.find(item => item.setting_key === 'app_timezone');
        
        setLogoUrl(logoSetting?.setting_value || '');
        setAppTitle(titleSetting?.setting_value || 'Digital Absensi');
        setTimezone(timezoneSetting?.setting_value || 'WIB');
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
              <Label htmlFor="timezone" className="text-black flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Time Zone
              </Label>
              <Select
                value={timezone}
                onValueChange={setTimezone}
              >
                <SelectTrigger className="bg-white border-gray-300 text-black">
                  <SelectValue placeholder="Select timezone" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="WIB">WIB (UTC+7) - Waktu Indonesia Barat</SelectItem>
                  <SelectItem value="WITA">WITA (UTC+8) - Waktu Indonesia Tengah</SelectItem>
                  <SelectItem value="WIT">WIT (UTC+9) - Waktu Indonesia Timur</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-600">
                Choose the timezone for your location. This will affect the clock display on the main page.
              </p>
            </div>

            {/* App Title Setting */}
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