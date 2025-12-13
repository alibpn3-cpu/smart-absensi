-- Add version control settings to app_settings
INSERT INTO app_settings (setting_key, setting_value, description) VALUES
  ('app_current_version', 'v2.2.0', 'Current application version'),
  ('app_version_changelog', '• Shared Device Mode per-device
• Sistem Force Update dengan changelog
• Dashboard Belum Absen
• Dashboard Analytics interaktif
• Export variatif (Excel, PDF, CSV)', 'Changelog for current version')
ON CONFLICT (setting_key) DO UPDATE SET 
  setting_value = EXCLUDED.setting_value,
  description = EXCLUDED.description,
  updated_at = now();

-- Remove shared_device_mode from database settings (now per-device in localStorage)
DELETE FROM app_settings WHERE setting_key = 'shared_device_mode';