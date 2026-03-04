DELETE FROM users WHERE email = 'admin@iaas.local';
DROP TABLE IF EXISTS project_limits;
ALTER TABLE users DROP COLUMN IF EXISTS role;