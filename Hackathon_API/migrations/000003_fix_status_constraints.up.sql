-- Удаляем старые CHECK constraints и добавляем новые с pending-start/pending-stop

-- managed_databases
ALTER TABLE managed_databases
  DROP CONSTRAINT IF EXISTS managed_databases_status_check;

ALTER TABLE managed_databases
  ADD CONSTRAINT managed_databases_status_check
  CHECK (status IN (
    'pending', 'pending-start', 'pending-stop',
    'creating', 'running', 'stopping', 'stopped', 'error', 'deleted'
  ));

-- object_storages
ALTER TABLE object_storages
  DROP CONSTRAINT IF EXISTS object_storages_status_check;

ALTER TABLE object_storages
  ADD CONSTRAINT object_storages_status_check
  CHECK (status IN (
    'pending', 'pending-start', 'pending-stop',
    'creating', 'running', 'stopping', 'stopped', 'error', 'deleted'
  ));

-- file_storages
ALTER TABLE file_storages
  DROP CONSTRAINT IF EXISTS file_storages_status_check;

ALTER TABLE file_storages
  ADD CONSTRAINT file_storages_status_check
  CHECK (status IN (
    'pending', 'pending-start', 'pending-stop',
    'creating', 'running', 'stopping', 'stopped', 'error', 'deleted'
  ));

-- mobile_devices
ALTER TABLE mobile_devices
  DROP CONSTRAINT IF EXISTS mobile_devices_status_check;

ALTER TABLE mobile_devices
  ADD CONSTRAINT mobile_devices_status_check
  CHECK (status IN (
    'pending', 'pending-start', 'pending-stop',
    'creating', 'running', 'stopping', 'stopped', 'error', 'deleted'
  ));