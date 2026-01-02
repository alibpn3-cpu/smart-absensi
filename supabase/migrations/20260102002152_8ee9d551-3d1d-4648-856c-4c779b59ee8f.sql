-- Insert default user password setting
INSERT INTO app_settings (setting_key, setting_value, description)
VALUES ('default_user_password', 'PTG2025', 'Default password untuk user baru atau reset password')
ON CONFLICT (setting_key) DO NOTHING;