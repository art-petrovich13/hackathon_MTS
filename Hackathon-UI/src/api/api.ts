// src/api/api.ts
import axios from 'axios'

// Типы — только импорт, не объявление
import type {
  VirtualMachine, CreateVMPayload,
  Flavor, Image, ComputeNode,
  ServiceCatalogItem, ServiceCatalogItemWithFlavors,
  ManagedDatabase, CreateDatabaseRequest,
  ObjectStorage, CreateObjectStorageRequest,
  FileStorage, MobileDevice,
} from '../types/api'

// ── Базовый клиент ────────────────────────────────────────────────────────────
const client = axios.create({
  baseURL: '/api/v1',
  headers: { 'Content-Type': 'application/json' },
})

client.interceptors.response.use(
  (res) => res,
  (err) => {
    const msg = err.response?.data?.message ?? err.message
    console.error(`[API Error] ${err.config?.method?.toUpperCase()} ${err.config?.url}:`, msg)
    return Promise.reject(err)
  }
)

// ── VM API ────────────────────────────────────────────────────────────────────
export const getVMs = async (): Promise<VirtualMachine[]> => {
  const { data } = await client.get<VirtualMachine[]>('/vms')
  return data ?? []
}

export const getVM = async (id: string): Promise<VirtualMachine> => {
  const { data } = await client.get<VirtualMachine>(`/vms/${id}`)
  return data
}

export const createVM = async (payload: CreateVMPayload): Promise<VirtualMachine> => {
  const { data } = await client.post<VirtualMachine>('/vms', payload)
  return data
}

export const startVM = async (id: string): Promise<void> => {
  await client.post(`/vms/${id}/start`)
}

export const stopVM = async (id: string): Promise<void> => {
  await client.post(`/vms/${id}/stop`)
}

export const deleteVM = async (id: string): Promise<void> => {
  await client.delete(`/vms/${id}`)
}

// ── Flavors API ───────────────────────────────────────────────────────────────
// serviceType — опциональный, появился в Day 13 (?service_type=db_postgres)
export const getFlavors = async (serviceType?: string): Promise<Flavor[]> => {
  const params = serviceType ? { service_type: serviceType } : {}
  const { data } = await client.get<Flavor[]>('/flavors', { params })
  return data ?? []
}

// ── Images API ────────────────────────────────────────────────────────────────
export const getImages = async (): Promise<Image[]> => {
  const { data } = await client.get<Image[]>('/images')
  return data ?? []
}

// ── Nodes API ─────────────────────────────────────────────────────────────────
export const getNodes = async (): Promise<ComputeNode[]> => {
  const { data } = await client.get<ComputeNode[]>('/nodes')
  return data ?? []
}

// ── Health API ────────────────────────────────────────────────────────────────
export const getHealth = async (): Promise<{ status: string; db: string; timestamp: string }> => {
  const { data } = await axios.get('/health')
  return data
}

// ── Service Catalog API (новый в Day 13) ──────────────────────────────────────
export const getServiceCatalog = async (): Promise<ServiceCatalogItem[]> => {
  const { data } = await client.get<ServiceCatalogItem[]>('/service-catalog')
  return data ?? []
}

export const getServiceCatalogFull = async (): Promise<ServiceCatalogItemWithFlavors[]> => {
  const { data } = await client.get<ServiceCatalogItemWithFlavors[]>('/service-catalog/full')
  return data ?? []
}

// ── Databases API (новый в Day 13) ────────────────────────────────────────────
export const getDatabases = async (): Promise<ManagedDatabase[]> => {
  const { data } = await client.get<ManagedDatabase[]>('/databases')
  return data ?? []
}

export const getDatabase = async (id: string): Promise<ManagedDatabase> => {
  const { data } = await client.get<ManagedDatabase>(`/databases/${id}`)
  return data
}

export const createDatabase = async (payload: CreateDatabaseRequest): Promise<ManagedDatabase> => {
  const { data } = await client.post<ManagedDatabase>('/databases', payload)
  return data
}

export const deleteDatabase = async (id: string): Promise<void> => {
  await client.delete(`/databases/${id}`)
}

// ── Object Storage API (эндпоинты появятся в Day 16) ─────────────────────────
export const getObjectStorages = async (): Promise<ObjectStorage[]> => {
  const { data } = await client.get<ObjectStorage[]>('/object-storages')
  return data ?? []
}

export const createObjectStorage = async (payload: CreateObjectStorageRequest): Promise<ObjectStorage> => {
  const { data } = await client.post<ObjectStorage>('/object-storages', payload)
  return data
}

export const deleteObjectStorage = async (id: string): Promise<void> => {
  await client.delete(`/object-storages/${id}`)
}

// ── File Storage API (эндпоинты появятся в Day 17) ───────────────────────────
export const getFileStorages = async (): Promise<FileStorage[]> => {
  const { data } = await client.get<FileStorage[]>('/file-storages')
  return data ?? []
}

export const deleteFileStorage = async (id: string): Promise<void> => {
  await client.delete(`/file-storages/${id}`)
}

// ── Mobile API (эндпоинты появятся в Day 17) ─────────────────────────────────
export const getMobileDevices = async (): Promise<MobileDevice[]> => {
  const { data } = await client.get<MobileDevice[]>('/mobile-devices')
  return data ?? []
}

export const deleteMobileDevice = async (id: string): Promise<void> => {
  await client.delete(`/mobile-devices/${id}`)
}