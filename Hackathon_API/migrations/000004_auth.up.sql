-- Добавляем колонку role в существующую таблицу users
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'user'
    CHECK (role IN ('admin', 'user'));

-- Таблица лимитов ресурсов на проект
CREATE TABLE IF NOT EXISTS project_limits (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id    UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    max_vms       INT  NOT NULL DEFAULT 5,
    max_cpu       INT  NOT NULL DEFAULT 8,
    max_ram_mb    INT  NOT NULL DEFAULT 8192,
    max_disk_gb   INT  NOT NULL DEFAULT 100,
    max_dbs       INT  NOT NULL DEFAULT 3,
    max_storages  INT  NOT NULL DEFAULT 3,
    max_mobile    INT  NOT NULL DEFAULT 2,
    created_at    TIMESTAMP DEFAULT NOW(),
    updated_at    TIMESTAMP DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_project_limits_project_id
  ON project_limits(project_id);

-- Предустановленный admin (пароль: admin123)
INSERT INTO users (id, email, password_hash, role)
VALUES (
  gen_random_uuid(),
  'admin@iaas.local',
  '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lh9y',
  'admin'
) ON CONFLICT (email) DO UPDATE SET role = 'admin';