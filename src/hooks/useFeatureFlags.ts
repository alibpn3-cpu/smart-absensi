import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface FeatureFlags {
  scoreEnabled: boolean;
  loginRequired: boolean;
  betaMode: boolean;
  isDeveloper: boolean;
  attendanceStatusListEnabled: boolean;
  leaveRequestEnabled: boolean;
  permissionRequestEnabled: boolean;
  isLoading: boolean;
}

export const useFeatureFlags = (): FeatureFlags => {
  const [flags, setFlags] = useState<FeatureFlags>({
    scoreEnabled: false,
    loginRequired: false,
    betaMode: false,
    isDeveloper: false,
    attendanceStatusListEnabled: true,
    leaveRequestEnabled: false,
    permissionRequestEnabled: false,
    isLoading: true
  });

  useEffect(() => {
    const fetchFlags = async () => {
      try {
        const { data, error } = await supabase
          .from('app_settings')
          .select('setting_key, setting_value')
          .in('setting_key', ['score_feature_enabled', 'login_required', 'beta_mode_enabled', 'attendance_status_list_enabled', 'leave_request_enabled', 'permission_request_enabled']);

        if (error) {
          console.error('Error fetching feature flags:', error);
          return;
        }

        const flagsMap: Record<string, boolean> = {};
        data?.forEach(row => {
          flagsMap[row.setting_key] = row.setting_value === 'true';
        });

        const isDeveloper = localStorage.getItem('developer_mode') === 'true';
        const betaMode = flagsMap['beta_mode_enabled'] || false;

        setFlags({
          scoreEnabled: flagsMap['score_feature_enabled'] || (betaMode && isDeveloper),
          loginRequired: flagsMap['login_required'] || false,
          betaMode,
          isDeveloper,
          attendanceStatusListEnabled: flagsMap['attendance_status_list_enabled'] !== false,
          leaveRequestEnabled: flagsMap['leave_request_enabled'] || false,
          permissionRequestEnabled: flagsMap['permission_request_enabled'] || false,
          isLoading: false
        });
      } catch (error) {
        console.error('Error in fetchFlags:', error);
        setFlags(prev => ({ ...prev, isLoading: false }));
      }
    };

    fetchFlags();
  }, []);

  return flags;
};
