// src/api/api.ts
import axios from 'axios'

// Типы — только импорт, не объявление
import type {
  VirtualMachine, CreateVMPayload,
  Flavor, Image, ComputeNode,
  ServiceCatalogItem, ServiceCatalogItemWithFlavors,
  ManagedDatabase, CreateDatabaseRequest,
  ObjectStorage, CreateObjectStorageRequest,
  FileStorage, CreateFileStorageRequest,
  MobileDevice, CreateMobileDeviceRequest,
  LoginRequest, LoginResponse, UserWithProject, ProjectLimit, AgentPlan, SSEEvent,
} from '../types/api'

import type { AuthUser } from '../types/api'

// ── Базовый клиент ────────────────────────────────────────────────────────────
const client = axios.create({
  baseURL: '/api/v1',
  headers: { 'Content-Type': 'application/json' },
})

// Request interceptor: добавляем токен из sessionStorage к каждому запросу
client.interceptors.request.use((config) => {
  const token = sessionStorage.getItem('auth_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Response interceptor: логируем ошибки, при 401 — редирект на /login
client.interceptors.response.use(
  (res) => res,
  (err) => {
    const isLoginRequest = err.config?.url?.includes('/auth/login')

    // Редиректим на /login ТОЛЬКО если это НЕ сам запрос логина
    // Иначе ошибка "неверный пароль" вызывала бы перезагрузку страницы
    if (err.response?.status === 401 && !isLoginRequest) {
      sessionStorage.removeItem('auth_token')
      sessionStorage.removeItem('auth_user')
      window.location.href = '/login'
    }
    const msg = err.response?.data?.error ?? err.response?.data?.message ?? err.message
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

export const startDatabase = async (id: string): Promise<void> => {
  await client.post(`/databases/${id}/start`)
}

export const stopDatabase = async (id: string): Promise<void> => {
  await client.post(`/databases/${id}/stop`)
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

export const startObjectStorage = async (id: string): Promise<void> => {
  await client.post(`/object-storages/${id}/start`)
}

export const stopObjectStorage = async (id: string): Promise<void> => {
  await client.post(`/object-storages/${id}/stop`)
}

// ── File Storage API (эндпоинты появятся в Day 17) ───────────────────────────
export const getFileStorages = async (): Promise<FileStorage[]> => {
  const { data } = await client.get<FileStorage[]>('/file-storages')
  return data ?? []
}




// ↓ ДОБАВИТЬ ЭТУ ФУНКЦИЮ
export const createFileStorage = async (payload: CreateFileStorageRequest): Promise<FileStorage> => {
  const { data } = await client.post<FileStorage>('/file-storages', payload)
  return data
}



export const deleteFileStorage = async (id: string): Promise<void> => {
  await client.delete(`/file-storages/${id}`)
}

export const startFileStorage = async (id: string): Promise<void> => {
  await client.post(`/file-storages/${id}/start`)
}

export const stopFileStorage = async (id: string): Promise<void> => {
  await client.post(`/file-storages/${id}/stop`)
}
// ── Mobile Farm API ──────────────────────────────────────────────────────────

export const getMobileDevices = async (): Promise<MobileDevice[]> => {
  const { data } = await client.get<MobileDevice[]>('/mobile-devices')
  return data ?? []
}

export const createMobileDevice = async (payload: CreateMobileDeviceRequest): Promise<MobileDevice> => {
  const { data } = await client.post<MobileDevice>('/mobile-devices', payload)
  return data
}

export const deleteMobileDevice = async (id: string): Promise<void> => {
  await client.delete(`/mobile-devices/${id}`)
}

export const startMobileDevice = async (id: string): Promise<void> => {
  await client.post(`/mobile-devices/${id}/start`)
}

export const stopMobileDevice = async (id: string): Promise<void> => {
  await client.post(`/mobile-devices/${id}/stop`)
}

// ── Auth API ──────────────────────────────────────────────────────────────────

export const login = async (payload: LoginRequest): Promise<LoginResponse> => {
  const { data } = await client.post<LoginResponse>('/auth/login', payload)
  return data
}

export const getMe = async (): Promise<AuthUser> => {
  const { data } = await client.get<AuthUser>('/auth/me')
  return data
}

// ── Users API (только для admin) ─────────────────────────────────────────────

export const getUsers = async (): Promise<UserWithProject[]> => {
  const { data } = await client.get<UserWithProject[]>('/users')
  return data ?? []
}

export const createUser = async (
  email: string,
  password: string,
  role: string,
): Promise<UserWithProject> => {
  const { data } = await client.post<UserWithProject>('/users', { email, password, role })
  return data
}

export const deleteUser = async (id: string): Promise<void> => {
  await client.delete(`/users/${id}`)
}

export const setUserLimits = async (
  userId: string,
  limits: Partial<ProjectLimit>,
): Promise<ProjectLimit> => {
  const { data } = await client.put<ProjectLimit>(`/users/${userId}/limits`, limits)
  return data
}

export async function agentChat(message: string): Promise<ReadableStreamDefaultReader<Uint8Array>> {
  const token = sessionStorage.getItem('auth_token')
  const response = await fetch('/api/v1/agent/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ message }),
  })
  if (!response.ok || !response.body) {
    throw new Error(`Agent unavailable: ${response.status}`)
  }
  return response.body.getReader()
}

export async function agentExecute(plan: AgentPlan): Promise<ReadableStreamDefaultReader<Uint8Array>> {
  const token = sessionStorage.getItem('auth_token')
  const response = await fetch('/api/v1/agent/execute', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ plan }),
  })
  if (!response.ok || !response.body) {
    throw new Error(`Deploy failed: ${response.status}`)
  }
  return response.body.getReader()
}

// readSSEStream — читает SSE-стрим и вызывает onEvent на каждое событие.
// Используется и в AgentChat, и в DeployTimeline.
export async function readSSEStream(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  onEvent: (event: SSEEvent) => void,
): Promise<void> {
  const decoder = new TextDecoder()
  let buffer = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      try {
        onEvent(JSON.parse(line.slice(6)) as SSEEvent)
      } catch {
        // ignore malformed line
      }
    }
  }
}
