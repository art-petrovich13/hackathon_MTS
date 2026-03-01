-- ─── Расширяем таблицу flavors ──────────────────────────────────────────────
ALTER TABLE flavors ADD COLUMN IF NOT EXISTS service_type TEXT NOT NULL DEFAULT 'compute';
ALTER TABLE flavors ADD COLUMN IF NOT EXISTS docker_image TEXT;
ALTER TABLE flavors ADD COLUMN IF NOT EXISTS default_port  INT;

-- Обновляем существующие flavors (если уже есть small, medium, large)
UPDATE flavors SET service_type = 'compute' WHERE service_type = '' OR service_type IS NULL;

-- ─── Каталог сервисов платформы ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS service_catalog (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    name         TEXT        NOT NULL,
    type         TEXT        NOT NULL UNIQUE,
    description  TEXT,
    icon         TEXT,
    is_available BOOLEAN     NOT NULL DEFAULT true,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Управляемые базы данных (PostgreSQL / MySQL / Redis) ───────────────────
CREATE TABLE IF NOT EXISTS managed_databases (
    id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    name                 TEXT        NOT NULL,
    project_id           UUID        NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    flavor_id            UUID        NOT NULL REFERENCES flavors(id),
    engine               TEXT        NOT NULL CHECK (engine IN ('postgres','mysql','redis')),
    engine_version       TEXT        NOT NULL,
    status               TEXT        NOT NULL DEFAULT 'pending'
                                     CHECK (status IN ('pending','creating','running','stopping','stopped','error','deleted')),
    docker_container_id  TEXT,
    node_id              UUID        REFERENCES compute_nodes(id),
    host                 TEXT,
    port                 INT,
    db_name              TEXT,
    db_user              TEXT,
    db_password          TEXT,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Object Storage (MinIO) ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS object_storages (
    id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    name                 TEXT        NOT NULL,
    project_id           UUID        NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    flavor_id            UUID        NOT NULL REFERENCES flavors(id),
    status               TEXT        NOT NULL DEFAULT 'pending'
                                     CHECK (status IN ('pending','creating','running','stopping','stopped','error','deleted')),
    docker_container_id  TEXT,
    node_id              UUID        REFERENCES compute_nodes(id),
    s3_endpoint          TEXT,
    console_endpoint     TEXT,
    access_key           TEXT,
    secret_key           TEXT,
    bucket_name          TEXT,
    storage_limit_gb     INT,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── File Storage (NFS) ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS file_storages (
    id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    name                 TEXT        NOT NULL,
    project_id           UUID        NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    flavor_id            UUID        NOT NULL REFERENCES flavors(id),
    status               TEXT        NOT NULL DEFAULT 'pending'
                                     CHECK (status IN ('pending','creating','running','stopping','stopped','error','deleted')),
    docker_container_id  TEXT,
    node_id              UUID        REFERENCES compute_nodes(id),
    volume_name          TEXT,
    nfs_endpoint         TEXT,
    size_gb              INT,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Mobile Farm (Android emulators) ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS mobile_devices (
    id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    name                 TEXT        NOT NULL,
    project_id           UUID        NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    flavor_id            UUID        NOT NULL REFERENCES flavors(id),
    device_type          TEXT        NOT NULL DEFAULT 'android',
    os_version           TEXT        NOT NULL,
    status               TEXT        NOT NULL DEFAULT 'pending'
                                     CHECK (status IN ('pending','creating','running','stopping','stopped','error','deleted')),
    docker_container_id  TEXT,
    node_id              UUID        REFERENCES compute_nodes(id),
    adb_host             TEXT,
    adb_port             INT,
    vnc_port             INT,
    novnc_port           INT,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Реестр занятых портов ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS port_allocations (
    id           UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
    node_id      UUID  NOT NULL REFERENCES compute_nodes(id) ON DELETE CASCADE,
    port         INT   NOT NULL,
    service_type TEXT  NOT NULL,
    service_id   UUID  NOT NULL,
    UNIQUE (node_id, port)
);

-- ─── Индексы для производительности ────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_managed_databases_project_id ON managed_databases(project_id);
CREATE INDEX IF NOT EXISTS idx_managed_databases_status     ON managed_databases(status);
CREATE INDEX IF NOT EXISTS idx_object_storages_project_id   ON object_storages(project_id);
CREATE INDEX IF NOT EXISTS idx_object_storages_status       ON object_storages(status);
CREATE INDEX IF NOT EXISTS idx_file_storages_project_id     ON file_storages(project_id);
CREATE INDEX IF NOT EXISTS idx_file_storages_status         ON file_storages(status);
CREATE INDEX IF NOT EXISTS idx_mobile_devices_project_id    ON mobile_devices(project_id);
CREATE INDEX IF NOT EXISTS idx_mobile_devices_status        ON mobile_devices(status);
CREATE INDEX IF NOT EXISTS idx_port_allocations_node_id     ON port_allocations(node_id);
CREATE INDEX IF NOT EXISTS idx_flavors_service_type         ON flavors(service_type);