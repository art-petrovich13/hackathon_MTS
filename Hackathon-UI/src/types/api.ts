// src/types/api.ts

// ─── VM ───────────────────────────────────────────────────────────────────────
// Статусы НЕ менялись — берём из текущего api/api.ts
export type VMStatus =
  | 'pending'
  | 'creating'
  | 'running'
  | 'pending-start'
  | 'pending-stop'
  | 'stopped'
  | 'error'

export interface VirtualMachine {
  id: string
  name: string
  project_id: string
  flavor_id: string
  image_id: string
  status: VMStatus
  docker_container_id: string | null
  ip_address: string | null       // ip_address, не host
  node_id: string | null
  created_at: string
  updated_at: string
}

export interface CreateVMPayload {
  name: string
  project_id: string
  flavor_id: string
  image_id: string
}

// ─── Flavor ──────────────────────────────────────────────────────────────────
// Базовые поля уже были. После миграции Day 13 добавятся новые — помечены ?
export interface Flavor {
  id: string
  name: string
  cpu: number
  ram_mb: number
  disk_gb: number
  // Появятся после 000002_services.up.sql:
  service_type?: string
  docker_image?: string | null
  default_port?: number | null
}

// ─── Image ───────────────────────────────────────────────────────────────────
export interface Image {
  id: string
  name: string
  docker_image: string
  os_type: string
  version: string
  status: string
}

// ─── ComputeNode ─────────────────────────────────────────────────────────────
export interface ComputeNode {
  id: string
  name: string
  endpoint: string
  total_cpu: number
  total_ram_mb: number
  free_cpu: number
  free_ram_mb: number
  status: string
}

// ─── ApiError ────────────────────────────────────────────────────────────────
export interface ApiError {
  code: string
  message: string
}

// ─── Service Catalog (новый в Day 13) ────────────────────────────────────────
export type ServiceType =
  | 'compute'
  | 'db_postgres'
  | 'db_mysql'
  | 'db_redis'
  | 'object_storage'
  | 'file_storage'
  | 'mobile_farm'

export interface ServiceCatalogItem {
  id: string
  name: string
  type: ServiceType
  description: string | null
  icon: string | null
  is_available: boolean
  created_at: string
}

// Расширенный вариант для /service-catalog/full
export interface ServiceCatalogItemWithFlavors extends ServiceCatalogItem {
  flavors: Flavor[]
}

// ─── Статусы новых сервисов (ОТДЕЛЬНО от VMStatus!) ──────────────────────────
// У новых сервисов есть 'deleted' и нет 'pending-start' / 'pending-stop'
export type ServiceStatus =
  | 'pending'
  | 'creating'
  | 'running'
  | 'stopping'
  | 'pending-start'
  | 'pending-stop'
  | 'stopped'
  | 'error'
  | 'deleted'

// ─── Managed Database (новый в Day 13) ───────────────────────────────────────
export type DBEngine = 'postgres' | 'mysql' | 'redis'

export interface ManagedDatabase {
  id: string
  name: string
  project_id: string
  flavor_id: string
  engine: DBEngine
  engine_version: string
  status: ServiceStatus
  docker_container_id: string | null
  node_id: string | null
  host: string | null
  port: number | null
  db_name: string | null
  db_user: string | null
  db_password: string | null      // приходит только owner/admin
  created_at: string
  updated_at: string
}

export interface CreateDatabaseRequest {
  name: string
  project_id: string
  flavor_id: string
  engine: DBEngine
  db_name: string
}

// ─── Object Storage (новый, эндпоинты в Day 16) ──────────────────────────────
export interface ObjectStorage {
  id: string
  name: string
  project_id: string
  flavor_id: string
  status: ServiceStatus
  docker_container_id: string | null
  node_id: string | null
  s3_endpoint: string | null
  console_endpoint: string | null
  access_key: string | null
  secret_key: string | null       // только owner/admin
  bucket_name: string | null
  storage_limit_gb: number | null
  created_at: string
  updated_at: string
}

export interface CreateObjectStorageRequest {
  name: string
  project_id: string
  flavor_id: string
  bucket_name: string
}

export interface CreateFileStorageRequest {
  name: string
  project_id: string
  flavor_id: string
  bucket_name?: string
}


// ─── File Storage (новый, эндпоинты в Day 17) ────────────────────────────────
export interface FileStorage {
  id: string
  name: string
  project_id: string
  flavor_id: string
  status: ServiceStatus
  docker_container_id: string | null
  node_id: string | null
  volume_name: string | null
  nfs_endpoint: string | null
  size_gb: number | null
  created_at: string
  updated_at: string
}

// ─── Mobile Device (новый, эндпоинты в Day 17) ───────────────────────────────
export interface MobileDevice {
  id: string
  name: string
  project_id: string
  flavor_id: string
  device_type: string
  os_version: string
  status: string
  docker_container_id: string | null
  node_id: string | null
  adb_host: string | null
  adb_port: number | null
  vnc_port: number | null
  novnc_port: number | null
  created_at: string
  updated_at: string
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export interface LoginRequest {
  email: string
  password: string
}

export interface AuthUser {
  id: string
  email: string
  role: 'admin' | 'user'
  project_id: string
  created_at: string
}

export interface LoginResponse {
  token: string
  expires_at: string
  user: AuthUser
}

export interface ProjectLimit {
  id: string
  project_id: string
  max_vms: number
  max_cpu: number
  max_ram_mb: number
  max_disk_gb: number
  max_dbs: number
  max_storages: number
  max_mobile: number
}

export interface UserWithProject {
  id: string
  email: string
  role: string
  created_at: string
  project?: {
    id: string
    name: string
    user_id: string
  }
  limits?: ProjectLimit
}



export interface CreateMobileDeviceRequest {
  name: string
  project_id: string
  flavor_id: string
  os_version: string
}
