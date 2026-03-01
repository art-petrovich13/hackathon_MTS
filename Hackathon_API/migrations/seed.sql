-- Очистка таблиц от возможных старых данных (если нужно перезаполнить)
-- Будьте осторожны: удалит всё!
-- TRUNCATE TABLE flavors, images, compute_nodes, users, projects RESTART IDENTITY CASCADE;

-- 1. Добавляем flavor'ы
INSERT INTO flavors (id, name, cpu, ram_mb, disk_gb) VALUES
(gen_random_uuid(), 'small',  1,  512, 10),
(gen_random_uuid(), 'medium', 2, 1024, 20),
(gen_random_uuid(), 'large',  4, 2048, 40);

-- 2. Добавляем образы (images)
INSERT INTO images (id, name, docker_image, os_type, version, imported, status) VALUES
(gen_random_uuid(), 'Alpine latest', 'alpine:latest', 'linux', 'latest', false, 'active'),
(gen_random_uuid(), 'Ubuntu 20.04',  'ubuntu:20.04',  'linux', '20.04', false, 'active');

-- 3. Добавляем вычислительный узел (локальный Docker)
-- Здесь total_cpu и total_ram_mb должны соответствовать ресурсам вашей машины.
-- Для примера: 8 ядер, 16 GB RAM.
INSERT INTO compute_nodes (id, name, endpoint, total_cpu, total_ram_mb, free_cpu, free_ram_mb, status) VALUES
(gen_random_uuid(), 'local-docker', 'unix:///var/run/docker.sock', 8, 16384, 8, 16384, 'active');

-- 4. Добавляем тестового пользователя (пароль: "password" в открытом виде – только для разработки!)
-- В реальном проекте пароль должен быть захэширован (bcrypt). Пока для простоты оставим так.
INSERT INTO users (id, email, password_hash, created_at) VALUES
(gen_random_uuid(), 'admin@example.com', 'password', NOW());

-- 5. Добавляем проект для этого пользователя
-- Чтобы связать проект с пользователем, нужно знать user_id. Мы можем получить его в подзапросе,
-- но проще сохранить UUID из предыдущей вставки. Однако из-за gen_random_uuid мы его не знаем.
-- Поэтому сделаем так: сначала вставим пользователя с конкретным UUID (чтобы знать его),
-- либо используем подзапрос для получения ID по email. Выберем второй вариант.
INSERT INTO projects (id, name, user_id, created_at)
SELECT gen_random_uuid(), 'Default Project', id, NOW()
FROM users
WHERE email = 'admin@example.com';

-- Если вы хотите фиксированные UUID (удобно для тестирования), замените gen_random_uuid() на конкретные значения,
-- например: '11111111-1111-1111-1111-111111111111' и т.д.


-- ─── Service Catalog ─────────────────────────────────────────────────────────
INSERT INTO service_catalog (name, type, description, icon) VALUES
    ('Виртуальные серверы', 'compute',        'Docker-контейнер с полноценной ОС (ubuntu/alpine)', '🖥️'),
    ('PostgreSQL',          'db_postgres',    'Управляемая реляционная БД PostgreSQL 15',           '🐘'),
    ('MySQL',               'db_mysql',       'Управляемая реляционная БД MySQL 8',                 '🐬'),
    ('Redis',               'db_redis',       'Высокоскоростной кэш и брокер сообщений Redis 7',    '⚡'),
    ('Object Storage',      'object_storage', 'S3-совместимое хранилище объектов MinIO',            '📦'),
    ('File Storage',        'file_storage',   'Сетевое файловое хранилище (NFS)',                   '💾'),
    ('Mobile Farm',         'mobile_farm',    'Android эмуляторы для тестирования приложений',      '📱')
ON CONFLICT (type) DO NOTHING;

-- ─── Compute Flavors ─────────────────────────────────────────────────────────
-- Обновляем старые (если уже есть)
UPDATE flavors SET service_type = 'compute' WHERE name IN ('small', 'medium', 'large');

-- Добавляем недостающие compute flavors
INSERT INTO flavors (name, cpu, ram_mb, disk_gb, service_type) VALUES
    ('nano',   1, 256,  5,  'compute'),
    ('small',  1, 512,  10, 'compute'),
    ('medium', 2, 1024, 20, 'compute'),
    ('large',  4, 2048, 40, 'compute')
ON CONFLICT DO NOTHING;

-- ─── Database Flavors ────────────────────────────────────────────────────────
INSERT INTO flavors (name, cpu, ram_mb, disk_gb, service_type, docker_image, default_port) VALUES
    ('pg-xs',    1, 256,  5,  'db_postgres', 'postgres:15', 5432),
    ('pg-s',     1, 512,  10, 'db_postgres', 'postgres:15', 5432),
    ('pg-m',     2, 1024, 20, 'db_postgres', 'postgres:15', 5432),
    ('mysql-s',  1, 512,  10, 'db_mysql',    'mysql:8',     3306),
    ('mysql-m',  2, 1024, 20, 'db_mysql',    'mysql:8',     3306),
    ('redis-s',  1, 128,  2,  'db_redis',    'redis:7',     6379)
ON CONFLICT DO NOTHING;

-- ─── Object Storage Flavors ──────────────────────────────────────────────────
INSERT INTO flavors (name, cpu, ram_mb, disk_gb, service_type, docker_image) VALUES
    ('minio-5gb',  1, 256, 5,  'object_storage', 'minio/minio:latest'),
    ('minio-20gb', 1, 512, 20, 'object_storage', 'minio/minio:latest'),
    ('minio-50gb', 2, 512, 50, 'object_storage', 'minio/minio:latest')
ON CONFLICT DO NOTHING;

-- ─── File Storage Flavors ────────────────────────────────────────────────────
INSERT INTO flavors (name, cpu, ram_mb, disk_gb, service_type, docker_image) VALUES
    ('nfs-10gb', 1, 128, 10, 'file_storage', 'eeacms/nfs-server'),
    ('nfs-50gb', 1, 256, 50, 'file_storage', 'eeacms/nfs-server')
ON CONFLICT DO NOTHING;

-- ─── Mobile Farm Flavors ─────────────────────────────────────────────────────
INSERT INTO flavors (name, cpu, ram_mb, disk_gb, service_type, docker_image) VALUES
    ('android-11', 2, 2048, 10, 'mobile_farm', 'budtmo/docker-android:emulator_11.0'),
    ('android-12', 2, 2048, 10, 'mobile_farm', 'budtmo/docker-android:emulator_12.0')
ON CONFLICT DO NOTHING;