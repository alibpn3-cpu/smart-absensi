import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Settings, Save, Image } from 'lucide-react';

const AppSettings = () => {
  const [logoUrl, setLogoUrl] = useState('');
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
        .select('setting_value')
        .eq('setting_key', 'app_logo_url')
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      setLogoUrl(data?.setting_value || '');
    } catch (error) {
      console.error('Error fetching settings:', error);
      toast({
        title: "Error",
        description: "Failed to load settings",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('app_settings')
        .upsert({
          setting_key: 'app_logo_url',
          setting_value: logoUrl,
          description: 'URL for the application logo displayed in the header'
        }, {
          onConflict: 'setting_key'
        });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Settings saved successfully"
      });
    } catch (error) {
      console.error('Error saving settings:', error);
      toast({
        title: "Error",
        description: "Failed to save settings",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="bg-white/10 border-white/20 backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-white">
          <Settings className="h-5 w-5" />
          Application Settings
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {loading ? (
          <div className="text-center py-8 text-white">Loading settings...</div>
        ) : (
          <div className="space-y-4">
            {/* Logo URL Setting */}
            <div className="space-y-2">
              <Label htmlFor="logoUrl" className="text-white flex items-center gap-2">
                <Image className="h-4 w-4" />
                Logo URL
              </Label>
              <Input
                id="logoUrl"
                type="url"
                value={logoUrl}
                onChange={(e) => setLogoUrl(e.target.value)}
                placeholder="https://example.com/logo.png"
                className="bg-white/10 border-white/20 text-white placeholder:text-slate-400"
              />
              <p className="text-xs text-slate-300">
                Enter the URL of your company logo. It will be displayed in the main page header.
              </p>
            </div>

            {/* Logo Preview */}
            {logoUrl && (
              <div className="space-y-2">
                <Label className="text-white">Logo Preview</Label>
                <div className="bg-white/5 border border-white/20 rounded-lg p-4 flex items-center gap-3">
                  <img 
                    src={logoUrl} 
                    alt="Logo Preview" 
                    className="h-10 w-10 object-contain rounded-lg"
                    onError={(e) => {
                      e.currentTarget.src = '';
                      e.currentTarget.alt = 'Invalid URL';
                    }}
                  />
                  <div>
                    <p className="text-white text-sm font-medium">Smart Zone Absensi</p>
                    <p className="text-slate-300 text-xs">Modern Attendance Management System</p>
                  </div>
                </div>
              </div>
            )}

            {/* Save Button */}
            <div className="flex justify-end">
              <Button
                onClick={saveSettings}
                disabled={saving}
                className="bg-white/20 border-white/30 text-white hover:bg-white/30"
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