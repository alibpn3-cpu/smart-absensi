import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

const LOCAL_VERSION_KEY = 'app_installed_version';
const CHECK_INTERVAL = 30 * 1000; // 30 seconds

interface VersionCheckResult {
  showUpdateModal: boolean;
  newVersion: string;
  changelog: string;
  handleUpdate: () => void;
}

export const useVersionCheck = (currentAppVersion: string): VersionCheckResult => {
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [newVersion, setNewVersion] = useState('');
  const [changelog, setChangelog] = useState('');

  const checkVersion = useCallback(async () => {
    try {
      // Fetch current version from database
      const { data, error } = await supabase
        .from('app_settings')
        .select('setting_key, setting_value')
        .in('setting_key', ['app_current_version', 'app_version_changelog']);

      if (error) {
        console.error('Error checking version:', error);
        return;
      }

      const versionSetting = data?.find(d => d.setting_key === 'app_current_version');
      const changelogSetting = data?.find(d => d.setting_key === 'app_version_changelog');
      
      const dbVersion = versionSetting?.setting_value || '';
      const dbChangelog = changelogSetting?.setting_value || '';

      // Get locally installed version
      const installedVersion = localStorage.getItem(LOCAL_VERSION_KEY) || currentAppVersion;

      // Compare versions
      if (dbVersion && dbVersion !== installedVersion) {
        console.log(`🔄 New version available: ${dbVersion} (installed: ${installedVersion})`);
        setNewVersion(dbVersion);
        setChangelog(dbChangelog);
        setShowUpdateModal(true);
      }
    } catch (err) {
      console.error('Version check failed:', err);
    }
  }, [currentAppVersion]);

  const handleUpdate = useCallback(() => {
    // Save the new version to localStorage
    if (newVersion) {
      localStorage.setItem(LOCAL_VERSION_KEY, newVersion);
    }
    setShowUpdateModal(false);
  }, [newVersion]);

  useEffect(() => {
    // Initial check after a short delay
    const initialTimeout = setTimeout(() => {
      checkVersion();
    }, 2000);

    // Periodic check
    const interval = setInterval(checkVersion, CHECK_INTERVAL);

    return () => {
      clearTimeout(initialTimeout);
      clearInterval(interval);
    };
  }, [checkVersion]);

  // Also check on visibility change (when user comes back to tab)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkVersion();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [checkVersion]);

  return {
    showUpdateModal,
    newVersion,
    changelog,
    handleUpdate
  };
};
