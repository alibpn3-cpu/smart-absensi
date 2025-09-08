-- Clear existing admin accounts and create proper admin account
DELETE FROM admin_accounts;

-- Insert admin account with username 'admin' and password 'admin123'
-- Using bcrypt hash for 'admin123'
INSERT INTO admin_accounts (username, password_hash) 
VALUES ('admin', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi');