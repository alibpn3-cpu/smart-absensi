INSERT INTO app_settings (setting_key, setting_value, description)
VALUES ('attendance_status_list_enabled', 'true', 'Tampilkan Status In/Out di halaman utama')
ON CONFLICT (setting_key) DO NOTHING;