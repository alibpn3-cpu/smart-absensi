-- Reset semua password staff ke NULL agar menggunakan default password baru dari app_settings
-- dan set is_first_login = true agar user harus ganti password saat pertama login
UPDATE staff_users 
SET password_hash = NULL, 
    is_first_login = true 
WHERE password_hash = 'PTG2025';