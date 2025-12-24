import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Flag, Star, LogIn, Code } from 'lucide-react';

interface FeatureFlag {
  key: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  value: boolean;
}

const FeatureFlagSettings = () => {
  const [flags, setFlags] = useState<FeatureFlag[]>([
    {
      key: 'score_feature_enabled',
      label: 'Fitur Star Score',
      description: 'Aktifkan sistem penilaian bintang untuk kehadiran',
      icon: <Star className="h-4 w-4" />,
      value: false
    },
    {
      key: 'login_required',
      label: 'Wajib Login',
      description: 'Wajibkan user login (bukan pilih nama dari dropdown)',
      icon: <LogIn className="h-4 w-4" />,
      value: false
    },
    {
      key: 'beta_mode_enabled',
      label: 'Mode Beta/Developer',
      description: 'Aktifkan mode beta untuk testing fitur baru di device tertentu',
      icon: <Code className="h-4 w-4" />,
      value: false
    }
  ]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchFlags();
  }, []);

  const fetchFlags = async () => {
    try {
      const { data, error } = await supabase
        .from('app_settings')
        .select('setting_key, setting_value')
        .in('setting_key', ['score_feature_enabled', 'login_required', 'beta_mode_enabled']);

      if (error) throw error;

      setFlags(prev => prev.map(flag => {
        const dbValue = data?.find(d => d.setting_key === flag.key);
        return {
          ...flag,
          value: dbValue?.setting_value === 'true'
        };
      }));
    } catch (error) {
      console.error('Error fetching feature flags:', error);
      toast.error('Gagal memuat feature flags');
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggle = (key: string) => {
    setFlags(prev => prev.map(flag => 
      flag.key === key ? { ...flag, value: !flag.value } : flag
    ));
  };

  const saveFlags = async () => {
    setIsSaving(true);
    try {
      for (const flag of flags) {
        const { error } = await supabase
          .from('app_settings')
          .update({ 
            setting_value: flag.value.toString(),
            updated_at: new Date().toISOString()
          })
          .eq('setting_key', flag.key);

        if (error) throw error;
      }

      toast.success('Feature flags berhasil disimpan');
    } catch (error) {
      console.error('Error saving feature flags:', error);
      toast.error('Gagal menyimpan feature flags');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-muted rounded w-1/3"></div>
            <div className="h-10 bg-muted rounded"></div>
            <div className="h-10 bg-muted rounded"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Flag className="h-5 w-5" />
          Feature Flags
        </CardTitle>
        <CardDescription>
          Kontrol fitur yang aktif di aplikasi. Fitur dengan flag OFF tidak akan terlihat oleh user.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {flags.map((flag) => (
          <div key={flag.key} className="flex items-center justify-between p-4 border rounded-lg">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-primary/10 rounded-lg text-primary">
                {flag.icon}
              </div>
              <div>
                <Label htmlFor={flag.key} className="text-base font-medium cursor-pointer">
                  {flag.label}
                </Label>
                <p className="text-sm text-muted-foreground mt-1">
                  {flag.description}
                </p>
              </div>
            </div>
            <Switch
              id={flag.key}
              checked={flag.value}
              onCheckedChange={() => handleToggle(flag.key)}
            />
          </div>
        ))}

        <div className="pt-4 border-t">
          <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-4 mb-4">
            <p className="text-sm text-amber-800 dark:text-amber-200">
              <strong>Mode Beta:</strong> Jika diaktifkan, user dengan <code className="bg-amber-100 dark:bg-amber-900 px-1 rounded">localStorage.developer_mode = 'true'</code> akan dapat mengakses fitur yang belum dirilis.
            </p>
          </div>
          
          <Button onClick={saveFlags} disabled={isSaving} className="w-full">
            {isSaving ? 'Menyimpan...' : 'Simpan Feature Flags'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default FeatureFlagSettings;
