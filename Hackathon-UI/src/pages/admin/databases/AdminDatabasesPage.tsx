import { useState } from 'react'
import type { CSSProperties, FormEvent } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { getDatabases, createDatabase, deleteDatabase, getFlavors } from '../../../api/api'
import type { ManagedDatabase, DBEngine, Flavor } from '../../../types/api'
import { StatusBadge } from '../../../components/ui/StatusBadge'
import { EngineBadge } from '../../../components/ui/EngineBadge'
import { CredentialsModal, type CredField } from '../../../components/ui/CredentialsModal'
import s from '../../shared.module.css'

// Тот же project_id что в CreateVMPage
const DEFAULT_PROJECT_ID = '9d320322-31f5-48d5-ade8-43f1b03b5b59'

const ACTIVE_STATUSES = new Set(['pending', 'creating'])

// ─── Главная страница ──────────────────────────────────────────────────────────

export function AdminDatabasesPage() {
  const qc = useQueryClient()
  const [showCreate, setShowCreate] = useState(false)
  const [credsFor, setCredsFor] = useState<ManagedDatabase | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  const { data: dbs = [], isLoading, isError } = useQuery({
    queryKey: ['databases'],
    queryFn: getDatabases,
    // Авто-рефреш: 3s если есть pending/creating, иначе 10s
    refetchInterval: (query) => {
      const data = query.state.data as ManagedDatabase[] | undefined
      if (!data) return 5_000
      return data.some(d => ACTIVE_STATUSES.has(d.status)) ? 3_000 : 10_000
    },
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
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>

      {/* ── Шапка ─────────────────────────────────────────────────────────── */}
      <div className={s.pageHeader}>
        <div>
          <h1 className={s.pageTitle}>Managed Databases</h1>
          <p className={s.pageSubtitle}>
            {dbs.length} database{dbs.length !== 1 ? 's' : ''}
            {hasPending && ' · auto-refresh 3s'}
          </p>
        </div>
        <button className={s.btnPrimary} onClick={() => setShowCreate(true)}>
          + New Database
        </button>
      </div>

      {/* ── Загрузка / ошибка ─────────────────────────────────────────────── */}
      {isLoading && (
        <div className={s.stateBox}>
          <div className={s.stateIcon}>🗄️</div>
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
          <div className={s.stateIcon}>🗄️</div>
          <p className={s.stateText}>No databases yet</p>
          <button
            className={s.btnPrimary}
            style={{ marginTop: 12 }}
            onClick={() => setShowCreate(true)}
          >
            + Create first database
          </button>
        </div>
      )}

      {/* ── Таблица ───────────────────────────────────────────────────────── */}
      {!isLoading && !isError && dbs.length > 0 && (
        <div className={s.tableWrap}>
          <table className={s.table}>
            <thead>
              <tr>
                <th>Name</th>
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

                return (
                  <tr key={db.id}>
                    <td className={s.cellBold}>{db.name}</td>
                    <td><EngineBadge engine={db.engine} /></td>
                    <td><StatusBadge status={db.status} /></td>
                    <td className={s.cellMono}>
                      {db.host && db.port
                        ? `${db.host}:${db.port}`
                        : <span style={{ color: 'var(--text-dim)' }}>—</span>
                      }
                    </td>
                    <td className={s.cellMono}>{db.db_name ?? '—'}</td>
                    <td className={s.cellDim}>
                      {new Date(db.created_at).toLocaleString('ru-RU')}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        {db.status === 'running' && (
                          <button
                            onClick={() => setCredsFor(db)}
                            style={actionBtn('#0f2a47', '#60a5fa')}
                          >
                            🔑 Credentials
                          </button>
                        )}

                        {/* Кнопка удаления — двойное подтверждение прямо в строке */}
                        {isConfirming ? (
                          <>
                            <button
                              onClick={() => deleteMut.mutate(db.id)}
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
                            onClick={() => setConfirmDeleteId(db.id)}
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

// Вспомогательная функция стилей кнопок таблицы
function actionBtn(bg: string, color: string): CSSProperties {
  return {
    padding: '4px 12px', borderRadius: 6, border: 'none',
    background: bg, color, cursor: 'pointer', fontSize: 12, fontWeight: 600,
    whiteSpace: 'nowrap',
  }
}

// ─── Модал создания БД ─────────────────────────────────────────────────────────

interface CreateDBModalProps {
  onClose: () => void
  onCreated: () => void
}

type EngineOption = { engine: DBEngine; label: string; icon: string; desc: string }

const ENGINE_OPTIONS: EngineOption[] = [
  { engine: 'postgres', label: 'PostgreSQL', icon: '🐘', desc: 'Реляционная БД' },
  { engine: 'mysql',    label: 'MySQL',      icon: '🐬', desc: 'Реляционная БД' },
  { engine: 'redis',    label: 'Redis',      icon: '⚡', desc: 'Кэш / брокер' },
]

const ENGINE_SERVICE_TYPE: Record<DBEngine, string> = {
  postgres: 'db_postgres',
  mysql:    'db_mysql',
  redis:    'db_redis',
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
    if (!name.trim())   return setError('Введите имя сервиса')
    if (!flavorId)      return setError('Выберите конфигурацию')
    if (!dbName.trim()) return setError('Введите имя базы данных')

    mutation.mutate({
      name:       name.trim(),
      project_id: DEFAULT_PROJECT_ID,
      flavor_id:  flavorId,
      engine,
      db_name:    dbName.trim(),
    })
  }

  return (
    // Overlay — клик вне закрывает
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(0,0,0,0.65)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      {/* Сам модал — клик внутри не закрывает */}
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border)',
          borderRadius: 16, padding: 28,
          width: 500, maxWidth: '95vw',
          maxHeight: '90vh', overflowY: 'auto',
        }}
      >
        <h2 style={{ margin: '0 0 20px', fontSize: 18, fontWeight: 700, color: 'var(--text-pri)' }}>
          🗄️ Create Database
        </h2>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

          {/* ── Имя сервиса ─────────────────────────────────────────────── */}
          <div>
            <label style={labelStyle}>Имя сервиса</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. production-db"
              autoFocus
              style={inputStyle}
            />
          </div>

          {/* ── Выбор движка ────────────────────────────────────────────── */}
          <div>
            <label style={labelStyle}>Движок</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
              {ENGINE_OPTIONS.map(opt => (
                <button
                  key={opt.engine}
                  type="button"
                  onClick={() => handleEngineChange(opt.engine)}
                  style={{
                    padding: '12px 8px', borderRadius: 10, cursor: 'pointer',
                    textAlign: 'center' as const, transition: 'border-color 0.15s',
                    border: `2px solid ${engine === opt.engine ? 'var(--accent)' : 'var(--border)'}`,
                    background: engine === opt.engine ? 'var(--accent-dim)' : 'transparent',
                  }}
                >
                  <div style={{ fontSize: 24, marginBottom: 4 }}>{opt.icon}</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-pri)' }}>{opt.label}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-sec)', marginTop: 2 }}>{opt.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* ── Выбор flavor ────────────────────────────────────────────── */}
          <div>
            <label style={labelStyle}>Конфигурация</label>
            {loadFlavors ? (
              <p style={{ color: 'var(--text-sec)', fontSize: 13 }}>Загрузка...</p>
            ) : flavors.length === 0 ? (
              <p style={{ color: 'var(--red)', fontSize: 13 }}>
                Нет доступных конфигураций для {engine}
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {flavors.map(f => {
                  const ram = f.ram_mb >= 1024 ? `${f.ram_mb / 1024} GB` : `${f.ram_mb} MB`
                  const selected = flavorId === f.id
                  return (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setFlavorId(f.id)}
                      style={{
                        padding: '10px 14px', borderRadius: 8, textAlign: 'left' as const,
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

          {/* ── Имя БД ──────────────────────────────────────────────────── */}
          <div>
            <label style={labelStyle}>Имя базы данных</label>
            <input
              value={dbName}
              onChange={e => setDbName(e.target.value)}
              placeholder="e.g. myapp_db"
              style={inputStyle}
            />
            <p style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 4 }}>
              Имя БД внутри контейнера. Credentials генерируются автоматически.
            </p>
          </div>

          {/* ── Ошибка ──────────────────────────────────────────────────── */}
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

          {/* ── Кнопки ──────────────────────────────────────────────────── */}
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
                background: 'var(--accent)', border: 'none', color: '#fff',
                cursor: mutation.isPending ? 'not-allowed' : 'pointer',
                fontWeight: 600, opacity: mutation.isPending ? 0.6 : 1,
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