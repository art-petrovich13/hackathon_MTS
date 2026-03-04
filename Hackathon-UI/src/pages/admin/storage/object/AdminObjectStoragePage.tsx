import { useState } from 'react'
import type { CSSProperties, FormEvent } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  getObjectStorages, createObjectStorage, deleteObjectStorage, getFlavors,
  startObjectStorage, stopObjectStorage,
} from '../../../../api/api'
import type { ObjectStorage, Flavor } from '../../../../types/api'
import { StatusBadge } from '../../../../components/ui/StatusBadge'
import { CredentialsModal, type CredField } from '../../../../components/ui/CredentialsModal'
import s from '../../../shared.module.css'

// Тот же project_id что в CreateVMPage и AdminDatabasesPage
const DEFAULT_PROJECT_ID = '9d320322-31f5-48d5-ade8-43f1b03b5b59'

const ACTIVE_STATUSES = new Set(['pending', 'creating', 'pending-start', 'pending-stop'])

// ─── Главная страница ──────────────────────────────────────────────────────────

export function AdminObjectStoragePage() {
  const qc = useQueryClient()
  const [showCreate, setShowCreate]     = useState(false)
  const [credsFor, setCredsFor]         = useState<ObjectStorage | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  const { data: storages = [], isLoading, isError } = useQuery<ObjectStorage[]>({
    queryKey: ['object-storages'],
    queryFn: getObjectStorages,
    refetchInterval: (query) => {
      const data = query.state.data as ObjectStorage[] | undefined
      if (!data) return 5_000
      return data.some(s => ACTIVE_STATUSES.has(s.status)) ? 3_000 : 15_000
    },
  })

  const startMut = useMutation({
    mutationFn: startObjectStorage,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['object-storages'] })
      toast.success('Object Storage запускается')
    },
    onError: () => toast.error('Ошибка при запуске'),
  })

  const stopMut = useMutation({
    mutationFn: stopObjectStorage,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['object-storages'] })
      toast.success('Object Storage останавливается')
    },
    onError: () => toast.error('Ошибка при остановке'),
  })

  const deleteMut = useMutation({
    mutationFn: deleteObjectStorage,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['object-storages'] })
      setConfirmDeleteId(null)
      toast.success('Object Storage удалён')
    },
    onError: () => toast.error('Ошибка при удалении'),
  })

  // Собираем поля для CredentialsModal
  const buildCredFields = (os: ObjectStorage): CredField[] => {
    const fields: CredField[] = []
    if (os.s3_endpoint)      fields.push({ label: 'S3 Endpoint',    value: os.s3_endpoint,      isLink: true })
    if (os.console_endpoint) fields.push({ label: 'Console UI',     value: os.console_endpoint, isLink: true })
    if (os.access_key)       fields.push({ label: 'Access Key',     value: os.access_key })
    if (os.secret_key)       fields.push({ label: 'Secret Key',     value: os.secret_key,       secret: true })
    if (os.bucket_name)      fields.push({ label: 'Default Bucket', value: os.bucket_name })
    // AWS CLI hint — только если есть все нужные поля
    if (os.s3_endpoint && os.access_key && os.secret_key) {
      fields.push({
        label: 'AWS CLI (пример)',
        value: `aws --endpoint-url ${os.s3_endpoint} s3 ls`,
        copyable: true,
      })
    }
    return fields
  }

  const hasPending = storages.some(s => ACTIVE_STATUSES.has(s.status))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>

      {/* ── Шапка ─────────────────────────────────────────────────────────── */}
      <div className={s.pageHeader}>
        <div>
          <h1 className={s.pageTitle}>Object Storage</h1>
          <p className={s.pageSubtitle}>
            {storages.length} bucket{storages.length !== 1 ? 's' : ''}
            {hasPending && ' · auto-refresh 3s'}
          </p>
        </div>
        <button className={s.btnPrimary} onClick={() => setShowCreate(true)}>
          + New Storage
        </button>
      </div>

      {/* ── Состояния ─────────────────────────────────────────────────────── */}
      {isLoading && (
        <div className={s.stateBox}>
          <div className={s.stateIcon}>📦</div>
          <p className={s.stateText}>Loading object storages…</p>
        </div>
      )}
      {isError && (
        <div className={s.stateBox}>
          <p className={s.stateTextErr}>
            Failed to load. Эндпоинт /object-storages может быть ещё не готов у P1.
          </p>
        </div>
      )}
      {!isLoading && !isError && storages.length === 0 && (
        <div className={s.stateBox}>
          <div className={s.stateIcon} style={{ fontSize: 48, opacity: 0.2 }}>📦</div>
          <p className={s.stateText}>No object storages yet</p>
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
                <th>Status</th>
                <th>S3 Endpoint</th>
                <th>Bucket</th>
                <th>Size</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {storages.map(os => {
                const isActive     = ACTIVE_STATUSES.has(os.status)
                const isConfirming = confirmDeleteId === os.id

                return (
                  <tr key={os.id}>
                    <td className={s.cellBold}>{os.name}</td>
                    <td><StatusBadge status={os.status} /></td>
                    <td className={s.cellMono} style={{ fontSize: 11 }}>
                      {os.s3_endpoint
                        ? (
                          <a
                            href={os.s3_endpoint}
                            target="_blank"
                            rel="noreferrer"
                            style={{ color: 'var(--accent)', textDecoration: 'none' }}
                          >
                            {os.s3_endpoint}
                          </a>
                        )
                        : <span style={{ color: 'var(--text-dim)' }}>—</span>
                      }
                    </td>
                    <td className={s.cellMono}>{os.bucket_name ?? '—'}</td>
                    <td className={s.cellDim}>
                      {os.storage_limit_gb ? `${os.storage_limit_gb} GB` : '—'}
                    </td>
                    <td className={s.cellDim}>
                      {new Date(os.created_at).toLocaleString('ru-RU')}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        {/* Кнопка Access доступна всегда, но с данными только для running */}
                        <button
                          onClick={() => setCredsFor(os)}
                          style={actionBtn('#0f2a47', '#60a5fa')}
                          disabled={os.status !== 'running'}
                        >
                          🔑 Access
                        </button>

                        {/* Кнопки Start/Stop */}
                        {os.status === 'stopped' && (
                          <button
                            onClick={() => startMut.mutate(os.id)}
                            disabled={startMut.isPending}
                            style={actionBtn('#1a3d1a', '#4ade80')}
                          >
                            {startMut.isPending ? '...' : '▶'}
                          </button>
                        )}
                        {os.status === 'running' && (
                          <button
                            onClick={() => stopMut.mutate(os.id)}
                            disabled={stopMut.isPending}
                            style={actionBtn('#3d1a00', '#fb923c')}
                          >
                            {stopMut.isPending ? '...' : '■'}
                          </button>
                        )}

                        {/* Inline-подтверждение вместо window.confirm */}
                        {isConfirming ? (
                          <>
                            <button
                              onClick={() => deleteMut.mutate(os.id)}
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
                            onClick={() => setConfirmDeleteId(os.id)}
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
      {showCreate && (
        <CreateObjectStorageModal
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false)
            qc.invalidateQueries({ queryKey: ['object-storages'] })
          }}
        />
      )}

      {/* ── Модал credentials ─────────────────────────────────────────────── */}
      {credsFor && (
        <CredentialsModal
          title={`${credsFor.name} — Access Credentials`}
          fields={buildCredFields(credsFor)}
          onClose={() => setCredsFor(null)}
        />
      )}
    </div>
  )
}

// Стиль кнопок в таблице
function actionBtn(bg: string, color: string): CSSProperties {
  return {
    padding: '4px 12px', borderRadius: 6, border: 'none',
    background: bg, color, cursor: 'pointer',
    fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap',
  }
}

// ─── Модал создания Object Storage ────────────────────────────────────────────

function CreateObjectStorageModal({
  onClose, onCreated,
}: {
  onClose: () => void
  onCreated: () => void
}) {
  const [name, setName]           = useState('')
  const [flavorId, setFlavorId]   = useState('')
  const [bucketName, setBucketName] = useState('')
  const [error, setError]         = useState('')

  const { data: flavors = [], isLoading: loadFlavors } = useQuery<Flavor[]>({
    queryKey: ['flavors', 'object_storage'],
    queryFn: () => getFlavors('object_storage'),
  })

  const mutation = useMutation({
    mutationFn: createObjectStorage,
    onSuccess: () => {
      toast.success('Object Storage создаётся...')
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
    if (!flavorId)    return setError('Выберите конфигурацию')
    mutation.mutate({
      name:        name.trim(),
      project_id:  DEFAULT_PROJECT_ID,
      flavor_id:   flavorId,
      // Если bucket_name не заполнен — берём имя хранилища
      bucket_name: bucketName.trim() || name.trim(),
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
          maxHeight: '90vh', overflowY: 'auto',
        }}
      >
        <h2 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 700, color: 'var(--text-pri)' }}>
          📦 Create Object Storage
        </h2>
        <p style={{ marginBottom: 20, fontSize: 13, color: 'var(--text-sec)' }}>
          S3-совместимое хранилище на базе MinIO. После создания получишь endpoint, access key и secret key.
        </p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Имя хранилища */}
          <div>
            <label style={labelStyle}>Имя хранилища</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. production-files"
              autoFocus
              style={inputStyle}
            />
          </div>

          {/* Bucket name — опциональный */}
          <div>
            <label style={labelStyle}>
              Имя бакета&nbsp;
              <span style={{ color: 'var(--text-dim)', textTransform: 'none', letterSpacing: 0, fontSize: 11 }}>
                (если пусто — будет как имя хранилища)
              </span>
            </label>
            <input
              value={bucketName}
              onChange={e => setBucketName(e.target.value)}
              placeholder="e.g. uploads"
              style={inputStyle}
            />
          </div>

          {/* Выбор flavor */}
          <div>
            <label style={labelStyle}>Конфигурация (размер диска)</label>
            {loadFlavors ? (
              <p style={{ color: 'var(--text-sec)', fontSize: 13 }}>Загрузка конфигураций...</p>
            ) : flavors.length === 0 ? (
              <p style={{ color: 'var(--red)', fontSize: 13 }}>
                Нет доступных конфигураций. Убедись что seed выполнен и бэкенд запущен.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {flavors.map(f => {
                  const selected = flavorId === f.id
                  const ram = f.ram_mb >= 1024 ? `${f.ram_mb / 1024} GB` : `${f.ram_mb} MB`
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
                      <span style={{ fontSize: 12, color: 'var(--text-sec)' }}>
                        {f.cpu} vCPU · {ram} · {f.disk_gb} GB
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
              style={{
                padding: '10px 20px', borderRadius: 8,
                background: 'var(--accent)', border: 'none', color: '#0d0f14',
                cursor: mutation.isPending ? 'not-allowed' : 'pointer',
                fontWeight: 700, opacity: mutation.isPending ? 0.6 : 1,
              }}
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