-- Insert default admin account with hashed password
-- Password is 'admin123' hashed with bcrypt
INSERT INTO admin_accounts (username, password_hash) 
VALUES ('admin', '$2a$10$Yk6l6zT5X5J0tT8MYz5wBe5z5z5z5z5z5z5z5z5z5z5z5z5z5z5z5')
ON CONFLICT (username) DO NOTHING;