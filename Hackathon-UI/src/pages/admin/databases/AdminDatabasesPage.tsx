import { useState } from 'react'
import type { FormEvent } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { getDatabases, createDatabase, deleteDatabase, getFlavors } from '../../../api/api'
import type { ManagedDatabase, DBEngine, Flavor } from '../../../types/api'
import { StatusBadge } from '../../../components/ui/StatusBadge'
import { EngineBadge } from '../../../components/ui/EngineBadge'
import { CredentialsModal, type CredField } from '../../../components/ui/CredentialsModal'

import { UserFilter } from '../../../components/ui/UserFilter'
import { getUsers } from '../../../api/api'
import type { UserWithProject } from '../../../types/api'

import s from './AdminDatabasesStyle.module.css'

// Тот же project_id что в CreateVMPage
const DEFAULT_PROJECT_ID = '9d320322-31f5-48d5-ade8-43f1b03b5b59'

const ACTIVE_STATUSES = new Set(['pending', 'creating', 'pending-start', 'pending-stop'])

// ─── Главная страница ──────────────────────────────────────────────────────────

export function AdminDatabasesPage() {
  const qc = useQueryClient()
  const [showCreate, setShowCreate] = useState(false)
  const [credsFor, setCredsFor] = useState<ManagedDatabase | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)

  const { data: dbs = [], isLoading, isError } = useQuery({
    queryKey: ['databases', selectedUserId],
    queryFn: () => getDatabases(selectedUserId),
    refetchInterval: (query) => {
      const data = query.state.data as ManagedDatabase[] | undefined
      if (!data) return 5_000
      return data.some(d => ACTIVE_STATUSES.has(d.status)) ? 3_000 : 10_000
    },
  })

  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: getUsers,
    staleTime: 60_000,
  })

  const deleteMut = useMutation({
    mutationFn: deleteDatabase,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['databases'] })
      setConfirmDeleteId(null)
      toast.success('База данных удалена')
    },
    onError: () => toast.error('Ошибка при удалении'),
  })

  // Собираем поля для CredentialsModal
  const buildCredFields = (db: ManagedDatabase): CredField[] => {
    const fields: CredField[] = []
    if (db.host) fields.push({ label: 'Host', value: db.host })
    if (db.port) fields.push({ label: 'Port', value: String(db.port) })
    if (db.db_name) fields.push({ label: 'Database', value: db.db_name })
    if (db.db_user) fields.push({ label: 'Username', value: db.db_user })
    if (db.db_password) fields.push({ label: 'Password', value: db.db_password, secret: true })
    // Connection string — только если есть все поля
    if (db.host && db.port && db.db_user && db.db_password) {
      const cs =
        db.engine === 'postgres'
          ? `postgresql://${db.db_user}:${db.db_password}@${db.host}:${db.port}/${db.db_name ?? 'postgres'}`
          : db.engine === 'mysql'
            ? `mysql://${db.db_user}:${db.db_password}@${db.host}:${db.port}/${db.db_name ?? 'mydb'}`
            : `redis://:${db.db_password}@${db.host}:${db.port}`
      fields.push({ label: 'Connection String', value: cs, secret: true })
    }
    return fields
  }

  const hasPending = dbs.some(d => ACTIVE_STATUSES.has(d.status))

  return (
    <div className={s.container}>

      {/* ── Шапка ─────────────────────────────────────────────────────────── */}
      <div className={s.pageHeader}>
        <div>
          <h1 className={s.pageTitle}>Managed Databases</h1>
          <p className={s.pageSubtitle}>
            {dbs.length} database{dbs.length !== 1 ? 's' : ''}
            {hasPending && ' · auto-refresh 3s'}
          </p>
          <button className={s.btnPrimary} onClick={() => setShowCreate(true)}>
            + New Database
          </button>
        </div>
      </div>

      <UserFilter selectedUserId={selectedUserId} onChange={setSelectedUserId} />

      {/* ── Загрузка / ошибка ─────────────────────────────────────────────── */}
      {isLoading && (
        <div className={s.stateBox}>
          <p className={s.stateText}>Loading databases…</p>
        </div>
      )}
      {isError && (
        <div className={s.stateBox}>
          <p className={s.stateTextErr}>Failed to load databases.</p>
        </div>
      )}

      {/* ── Пустое состояние ──────────────────────────────────────────────── */}
      {!isLoading && !isError && dbs.length === 0 && (
        <div className={s.stateBox}>
          <p className={s.stateText}>No databases yet</p>
        </div>
      )}

      {/* ── Таблица ───────────────────────────────────────────────────────── */}
      {!isLoading && !isError && dbs.length > 0 && (
        <div className={s.tableWrap}>
          <table className={s.table}>
            <thead>
              <tr>
                <th>Name</th>
                <th>Пользователь</th>
                <th>Engine</th>
                <th>Status</th>
                <th>Host : Port</th>
                <th>DB Name</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {dbs.map(db => {
                const isActive = ACTIVE_STATUSES.has(db.status)
                const isConfirming = confirmDeleteId === db.id
                const owner = users.find(u => u.project?.id === db.project_id)

                return (
                  <tr key={db.id}>
                    <td style={{ fontSize: 11, color: '#94a3b8' }}>
                      {owner ? owner.email.split('@')[0] : '—'}
                    </td>
                    <td className={s.cellBold}>{db.name}</td>
                    <td><EngineBadge engine={db.engine} /></td>
                    <td><StatusBadge status={db.status} /></td>
                    <td className={s.cellMono}>
                      {db.host && db.port
                        ? `${db.host}:${db.port}`
                        : <span className={s.span}>—</span>
                      }
                    </td>
                    <td className={s.cellMono}>{db.db_name ?? '—'}</td>
                    <td className={s.cellDim}>
                      {new Date(db.created_at).toLocaleString('ru-RU')}
                    </td>
                    <td>
                      <div className={s.cred}>
                        {db.status === 'running' && (
                          <button
                            onClick={() => setCredsFor(db)}
                            className={`${s.actionButton} ${s.credentialsButton}`}
                          >
                            🔑 Credentials
                          </button>
                        )}

                        {isConfirming ? (
                          <>
                            <button
                              onClick={() => deleteMut.mutate(db.id)}
                              disabled={deleteMut.isPending}
                              className={`${s.actionButton} ${s.confirmDeleteButton}`}
                            >
                              {deleteMut.isPending ? '...' : 'Да, удалить'}
                            </button>
                            <button
                              onClick={() => setConfirmDeleteId(null)}
                              className={`${s.actionButton} ${s.cancelButton}`}
                            >
                              Отмена
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => setConfirmDeleteId(db.id)}
                            disabled={isActive}
                            className={`${s.actionButton} ${s.deleteButton}`}
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

      {/* ── Модал создания БД ─────────────────────────────────────────────── */}
      {showCreate && (
        <CreateDatabaseModal
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false)
            qc.invalidateQueries({ queryKey: ['databases'] })
          }}
        />
      )}

      {/* ── Модал с credentials ───────────────────────────────────────────── */}
      {credsFor && (
        <CredentialsModal
          title={`${credsFor.name} — Credentials`}
          fields={buildCredFields(credsFor)}
          onClose={() => setCredsFor(null)}
        />
      )}
    </div>
  )
}

// ─── Модал создания БД ─────────────────────────────────────────────────────────

interface CreateDBModalProps {
  onClose: () => void
  onCreated: () => void
}

type EngineOption = { engine: DBEngine; label: string; icon: string; desc: string }

const ENGINE_OPTIONS: EngineOption[] = [
  { engine: 'postgres', label: 'PostgreSQL', icon: '🐘', desc: 'Реляционная БД' },
  { engine: 'mysql', label: 'MySQL', icon: '🐬', desc: 'Реляционная БД' },
  { engine: 'redis', label: 'Redis', icon: '⚡', desc: 'Кэш / брокер' },
]

const ENGINE_SERVICE_TYPE: Record<DBEngine, string> = {
  postgres: 'db_postgres',
  mysql: 'db_mysql',
  redis: 'db_redis',
}

function CreateDatabaseModal({ onClose, onCreated }: CreateDBModalProps) {
  const [engine, setEngine] = useState<DBEngine>('postgres')
  const [flavorId, setFlavorId] = useState('')
  const [name, setName] = useState('')
  const [dbName, setDbName] = useState('')
  const [error, setError] = useState('')

  const serviceType = ENGINE_SERVICE_TYPE[engine]

  // При смене движка загружаем нужные flavors
  const { data: flavors = [], isLoading: loadFlavors } = useQuery<Flavor[]>({
    queryKey: ['flavors', serviceType],
    queryFn: () => getFlavors(serviceType),
  })

  const handleEngineChange = (e: DBEngine) => {
    setEngine(e)
    setFlavorId('') // сбрасываем выбранный flavor
  }

  const mutation = useMutation({
    mutationFn: createDatabase,
    onSuccess: () => {
      toast.success('База данных создаётся...')
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
    if (!name.trim()) return setError('Введите имя сервиса')
    if (!flavorId) return setError('Выберите конфигурацию')
    if (!dbName.trim()) return setError('Введите имя базы данных')

    mutation.mutate({
      name: name.trim(),
      project_id: DEFAULT_PROJECT_ID,
      flavor_id: flavorId,
      engine,
      db_name: dbName.trim(),
    })
  }

  return (
    <div className={s.modalOverlay} onClick={onClose}>
      <div className={s.modalContent} onClick={e => e.stopPropagation()}>
        <h2 className={s.modalTitle}>🗄️ Create Database</h2>

        <form className={s.modalForm} onSubmit={handleSubmit}>
          <div className={s.formGroup}>
            <label className={s.label}>Имя сервиса</label>
            <input
              className={s.input}
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. production-db"
              autoFocus
            />
          </div>

          <div className={s.formGroup}>
            <label className={s.label}>Движок</label>
            <div className={s.engineGrid}>
              {ENGINE_OPTIONS.map(opt => (
                <button
                  key={opt.engine}
                  type="button"
                  className={`${s.engineButton} ${engine === opt.engine ? s.engineButtonSelected : ''}`}
                  onClick={() => handleEngineChange(opt.engine)}
                >
                  <div className={s.engineIcon}>{opt.icon}</div>
                  <div className={s.engineLabel}>{opt.label}</div>
                  <div className={s.engineDesc}>{opt.desc}</div>
                </button>
              ))}
            </div>
          </div>

          <div className={s.formGroup}>
            <label className={s.label}>Конфигурация</label>
            {loadFlavors ? (
              <p className={s.loadingText}>Загрузка...</p>
            ) : flavors.length === 0 ? (
              <p className={s.errorText}>Нет доступных конфигураций для {engine}</p>
            ) : (
              <div className={s.flavorList}>
                {flavors.map(f => {
                  const ram = f.ram_mb >= 1024 ? `${f.ram_mb / 1024} GB` : `${f.ram_mb} MB`
                  const selected = flavorId === f.id
                  return (
                    <button
                      key={f.id}
                      type="button"
                      className={`${s.flavorButton} ${selected ? s.flavorButtonSelected : ''}`}
                      onClick={() => setFlavorId(f.id)}
                    >
                      <span className={s.flavorName}>{f.name}</span>
                      <span className={s.flavorSpecs}>
                        {f.cpu} vCPU · {ram} · {f.disk_gb} GB
                      </span>
                      {selected && <span className={s.flavorCheck}>✓</span>}
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          <div className={s.formGroup}>
            <label className={s.label}>Имя базы данных</label>
            <input
              className={s.input}
              value={dbName}
              onChange={e => setDbName(e.target.value)}
              placeholder="e.g. myapp_db"
            />
            <p className={s.hintText}>
              Имя БД внутри контейнера. Credentials генерируются автоматически.
            </p>
          </div>

          {error && (
            <div className={s.errorBox}>
              ⚠ {error}
            </div>
          )}

          <div className={s.buttonGroup}>
            <button
              type="button"
              className={s.buttonSecondary}
              onClick={onClose}
            >
              Отмена
            </button>
            <button
              type="submit"
              className={s.buttonPrimary}
              disabled={mutation.isPending}
            >
              {mutation.isPending ? 'Создаём...' : 'Создать →'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}