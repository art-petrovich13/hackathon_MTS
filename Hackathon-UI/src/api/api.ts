// src/api/api.ts
import axios from 'axios'

// ── Базовый клиент ────────────────────────────────────────────────────────────
const client = axios.create({
  baseURL: '/api/v1',
  headers: { 'Content-Type': 'application/json' },
})

// Перехватчик — логируем ошибки и пробрасываем дальше
client.interceptors.response.use(
  (res) => res,
  (err) => {
    const msg = err.response?.data?.message ?? err.message
    console.error(`[API Error] ${err.config?.method?.toUpperCase()} ${err.config?.url}:`, msg)
    return Promise.reject(err)
  }
)

// ── TypeScript-типы (повторяют Go-модели) ────────────────────────────────────

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
  ip_address: string | null
  node_id: string | null
  created_at: string
  updated_at: string
}

export interface Flavor {
  id: string
  name: string
  cpu: number
  ram_mb: number
  disk_gb: number
}

export interface Image {
  id: string
  name: string
  docker_image: string
  os_type: string
  version: string
  status: string
}

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

export interface CreateVMPayload {
  name: string
  project_id: string
  flavor_id: string
  image_id: string
}

export interface ApiError {
  code: string
  message: string
}

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

export const getFlavors = async (): Promise<Flavor[]> => {
  const { data } = await client.get<Flavor[]>('/flavors')
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