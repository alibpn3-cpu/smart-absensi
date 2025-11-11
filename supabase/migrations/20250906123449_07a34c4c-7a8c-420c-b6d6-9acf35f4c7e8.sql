-- Remove the invalid admin account first
DELETE FROM admin_accounts WHERE username = 'admin';

-- Insert default admin account with properly hashed password
-- Password is 'admin123' - will be hashed with bcrypt salt 10
INSERT INTO admin_accounts (username, password_hash) 
VALUES ('admin', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi');