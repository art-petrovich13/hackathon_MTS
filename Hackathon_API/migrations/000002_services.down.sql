DROP TABLE IF EXISTS port_allocations;
DROP TABLE IF EXISTS mobile_devices;
DROP TABLE IF EXISTS file_storages;
DROP TABLE IF EXISTS object_storages;
DROP TABLE IF EXISTS managed_databases;
DROP TABLE IF EXISTS service_catalog;
ALTER TABLE flavors DROP COLUMN IF EXISTS default_port;
ALTER TABLE flavors DROP COLUMN IF EXISTS docker_image;
ALTER TABLE flavors DROP COLUMN IF EXISTS service_type;