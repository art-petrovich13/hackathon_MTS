import { useState } from 'react'
import type { CSSProperties, FormEvent } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  getFileStorages, createFileStorage, deleteFileStorage,
  startFileStorage, stopFileStorage, getFlavors,
} from '../../../../api/api'
import type { FileStorage, Flavor } from '../../../../types/api'
import { StatusBadge } from '../../../../components/ui/StatusBadge'
import s from '../../../shared.module.css'

import { UserFilter } from '../../../../components/ui/UserFilter'
import { getUsers } from '../../../../api/api'
import type { UserWithProject } from '../../../../types/api'

const ACTIVE_STATUSES = new Set(['pending', 'creating', 'pending-start', 'pending-stop'])

// ─── Главная страница ──────────────────────────────────────────────────────────

export function AdminFileStoragePage() {
  const qc = useQueryClient()
  const [showCreate, setShowCreate] = useState(false)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)


  const { data: storages = [], isLoading, isError } = useQuery<FileStorage[]>({
    queryKey: ['file-storages', selectedUserId],
    queryFn: () => getFileStorages(selectedUserId),
    refetchInterval: (query) => {
      const data = query.state.data as FileStorage[] | undefined
      if (!data) return 5_000
      return data.some(s => ACTIVE_STATUSES.has(s.status)) ? 3_000 : 15_000
    },
  })

  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: getUsers,
    staleTime: 60_000,
  })

  const deleteMut = useMutation({
    mutationFn: deleteFileStorage,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['file-storages'] })
      setConfirmDeleteId(null)
      toast.success('File Storage удалён')
    },
    onError: () => toast.error('Ошибка при удалении'),
  })

  const startMut = useMutation({
    mutationFn: startFileStorage,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['file-storages'] })
      toast.success('File Storage запускается...')
    },
    onError: () => toast.error('Ошибка запуска'),
  })

  const stopMut = useMutation({
    mutationFn: stopFileStorage,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['file-storages'] })
      toast.success('File Storage останавливается...')
    },
    onError: () => toast.error('Ошибка остановки'),
  })

  const hasPending = storages.some(s => ACTIVE_STATUSES.has(s.status))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>

      {/* ── Шапка ─────────────────────────────────────────────────────────── */}
      <div className={s.pageHeader}>
        <div>
          <h1 className={s.pageTitle}>File Storage</h1>
          <p className={s.pageSubtitle}>
            {storages.length} volume{storages.length !== 1 ? 's' : ''}
            {hasPending && ' · auto-refresh 3s'}
          </p>
        </div>
        <button className={s.btnPrimary} onClick={() => setShowCreate(true)}>
          + New Storage
        </button>
      </div>

      <UserFilter selectedUserId={selectedUserId} onChange={setSelectedUserId} />

      {/* ── Состояния ─────────────────────────────────────────────────────── */}
      {isLoading && (
        <div className={s.stateBox}>
          <div className={s.stateIcon}>💾</div>
          <p className={s.stateText}>Loading file storages…</p>
        </div>
      )}
      {isError && (
        <div className={s.stateBox}>
          <p className={s.stateTextErr}>
            Failed to load. Эндпоинт /file-storages может быть ещё не реализован P1.
          </p>
        </div>
      )}
      {!isLoading && !isError && storages.length === 0 && (
        <div className={s.stateBox}>
          <div className={s.stateIcon} style={{ fontSize: 48, opacity: 0.2 }}>💾</div>
          <p className={s.stateText}>No file storages yet</p>
          <button
            className={s.btnPrimary}
            style={{ marginTop: 12 }}
            onClick={() => setShowCreate(true)}
          >
            + Create first storage
          </button>
        </div>
      )}

      {/* ── Таблица ───────────────────────────────────────────────────────── */}
      {!isLoading && !isError && storages.length > 0 && (
        <div className={s.tableWrap}>
          <table className={s.table}>
            <thead>
              <tr>
                <th>Name</th>
                <th>Пользователь</th>
                <th>Status</th>
                <th>NFS Endpoint</th>
                <th>Volume</th>
                <th>Size</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {storages.map(fs => {
                const isActive = ACTIVE_STATUSES.has(fs.status)
                const isConfirming = confirmDeleteId === fs.id
                const owner = users.find(u => u.project?.id === fs.project_id)

                return (
                  <tr key={fs.id}>
                    <td className={s.cellBold}>{fs.name}</td>
                    <td style={{ fontSize: 11, color: '#94a3b8' }}>
                      {owner ? owner.email.split('@')[0] : '—'}
                    </td>
                    <td><StatusBadge status={fs.status} /></td>
                    <td className={s.cellMono} style={{ fontSize: 11 }}>
                      {fs.nfs_endpoint
                        ? (
                          <a
                            href={fs.nfs_endpoint}
                            target="_blank"
                            rel="noreferrer"
                            style={{ color: 'var(--accent)', textDecoration: 'none' }}
                          >
                            {fs.nfs_endpoint}
                          </a>
                        )
                        : <span style={{ color: 'var(--text-dim)' }}>—</span>
                      }
                    </td>
                    <td className={s.cellMono} style={{ fontSize: 11 }}>
                      {fs.volume_name ?? '—'}
                    </td>
                    <td className={s.cellDim}>
                      {fs.size_gb ? `${fs.size_gb} GB` : '—'}
                    </td>
                    <td className={s.cellDim}>
                      {new Date(fs.created_at).toLocaleString('ru-RU')}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        {/* Кнопка Start (только для stopped) */}
                        {fs.status === 'stopped' && (
                          <button
                            onClick={() => startMut.mutate(fs.id)}
                            disabled={startMut.isPending}
                            style={actionBtn('#1a3d1a', '#4ade80')}
                          >
                            ▶
                          </button>
                        )}

                        {/* Кнопка Stop (только для running) */}
                        {fs.status === 'running' && (
                          <button
                            onClick={() => stopMut.mutate(fs.id)}
                            disabled={stopMut.isPending}
                            style={actionBtn('#3d1a00', '#fb923c')}
                          >
                            ■
                          </button>
                        )}

                        {/* Существующий inline delete */}
                        {isConfirming ? (
                          <>
                            <button
                              onClick={() => deleteMut.mutate(fs.id)}
                              disabled={deleteMut.isPending}
                              style={actionBtn('#4a0f0f', '#f87171')}
                            >
                              {deleteMut.isPending ? '...' : 'Да, удалить'}
                            </button>
                            <button
                              onClick={() => setConfirmDeleteId(null)}
                              style={actionBtn('transparent', 'var(--text-sec)')}
                            >
                              Отмена
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => setConfirmDeleteId(fs.id)}
                            disabled={isActive}
                            style={{
                              ...actionBtn('#2a1515', '#f87171'),
                              opacity: isActive ? 0.4 : 1,
                              cursor: isActive ? 'not-allowed' : 'pointer',
                            }}
                          >
                            ✕ Delete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Модал создания ────────────────────────────────────────────────── */}
      {showCreate && (() => {
        const targetUser = selectedUserId ? users.find(u => u.id === selectedUserId) : null
        const targetProjectId = targetUser?.project?.id ?? null
        return (
          <CreateFileStorageModal
            onClose={() => setShowCreate(false)}
            onCreated={() => {
              setShowCreate(false)
              qc.invalidateQueries({ queryKey: ['file-storages'] })
            }}
            targetProjectId={targetProjectId}
          />
        )
      })()}
    </div>
  )
}

function actionBtn(bg: string, color: string): CSSProperties {
  return {
    padding: '4px 12px', borderRadius: 6, border: 'none',
    background: bg, color, cursor: 'pointer',
    fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap',
  }
}

// ─── Модал создания File Storage ───────────────────────────────────────────────

function CreateFileStorageModal({
  onClose, onCreated, targetProjectId,
}: {
  onClose: () => void
  onCreated: () => void
  targetProjectId: string | null
}) {
  const [name, setName] = useState('')
  const [flavorId, setFlavorId] = useState('')
  const [error, setError] = useState('')

  const { data: flavors = [], isLoading: loadFlavors } = useQuery<Flavor[]>({
    queryKey: ['flavors', 'file_storage'],
    queryFn: () => getFlavors('file_storage'),
  })

  const mutation = useMutation({
    mutationFn: createFileStorage,
    onSuccess: () => {
      toast.success('File Storage создаётся...')
      onCreated()
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Ошибка создания'
      setError(msg)
      toast.error(msg)
    },
  })

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    setError('')
    if (!name.trim()) return setError('Введите имя хранилища')
    if (!flavorId) return setError('Выберите конфигурацию')
    if (!targetProjectId) return setError('Выберите пользователя в фильтре перед созданием')
    mutation.mutate({
      name: name.trim(),
      project_id: targetProjectId,
      flavor_id: flavorId,
    })
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(0,0,0,0.65)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--bg-surface)', border: '1px solid var(--border)',
          borderRadius: 16, padding: 28, width: 460, maxWidth: '95vw',
        }}
      >
        <h2 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 700, color: 'var(--text-pri)' }}>
          💾 Create File Storage
        </h2>
        <p style={{ marginBottom: 20, fontSize: 13, color: 'var(--text-sec)' }}>
          Docker volume с NFS-доступом. Подходит для шаринга файлов между контейнерами.
        </p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Имя */}
          <div>
            <label style={labelStyle}>Имя хранилища</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. shared-assets"
              autoFocus
              style={inputStyle}
            />
          </div>

          {/* Выбор flavor — для File Storage показываем только disk_gb, CPU/RAM не важны */}
          <div>
            <label style={labelStyle}>Размер</label>
            {loadFlavors ? (
              <p style={{ color: 'var(--text-sec)', fontSize: 13 }}>Загрузка...</p>
            ) : flavors.length === 0 ? (
              <p style={{ color: 'var(--red)', fontSize: 13 }}>Нет доступных конфигураций</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {flavors.map(f => {
                  const selected = flavorId === f.id
                  return (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setFlavorId(f.id)}
                      style={{
                        padding: '10px 14px', borderRadius: 8,
                        textAlign: 'left' as const,
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        cursor: 'pointer',
                        border: `1px solid ${selected ? 'var(--accent)' : 'var(--border)'}`,
                        background: selected ? 'var(--accent-dim)' : 'transparent',
                      }}
                    >
                      <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-pri)' }}>
                        {f.name}
                      </span>
                      <span style={{ fontSize: 13, color: 'var(--text-sec)', fontFamily: 'monospace' }}>
                        {f.disk_gb} GB
                      </span>
                      {selected && <span style={{ color: 'var(--accent)', marginLeft: 8 }}>✓</span>}
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Ошибка */}
          {error && (
            <div style={{
              padding: '10px 14px', borderRadius: 8,
              background: 'rgba(255,77,106,0.08)',
              border: '1px solid rgba(255,77,106,0.3)',
              color: 'var(--red)', fontSize: 13,
            }}>
              ⚠ {error}
            </div>
          )}

          {/* Кнопки */}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '10px 20px', borderRadius: 8,
                border: '1px solid var(--border)',
                background: 'transparent', cursor: 'pointer',
                fontWeight: 600, color: 'var(--text-pri)',
              }}
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className={s.btnPrimary}
            >
              {mutation.isPending ? 'Создаём...' : 'Создать →'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

const labelStyle: CSSProperties = {
  display: 'block', fontSize: 11, fontWeight: 700,
  color: 'var(--text-sec)', marginBottom: 8,
  textTransform: 'uppercase', letterSpacing: '0.06em',
}

const inputStyle: CSSProperties = {
  width: '100%', padding: '10px 14px', borderRadius: 8,
  border: '1px solid var(--border)',
  background: 'var(--bg-raised)', color: 'var(--text-pri)',
  fontSize: 14, outline: 'none', boxSizing: 'border-box',
}