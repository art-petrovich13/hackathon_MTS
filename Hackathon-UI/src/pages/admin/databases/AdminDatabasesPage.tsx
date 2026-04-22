import { useState } from 'react'
import type { FormEvent } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { getDatabases, createDatabase, deleteDatabase, getFlavors, getUsers } from '../../../api/api'
import type { ManagedDatabase, DBEngine, Flavor, UserWithProject } from '../../../types/api'
import { StatusBadge } from '../../../components/ui/StatusBadge'
import { EngineBadge } from '../../../components/ui/EngineBadge'
import { CredentialsModal, type CredField } from '../../../components/ui/CredentialsModal'
import { UserFilter } from '../../../components/ui/UserFilter'
import shared from '../../shared.module.css'
import s from './AdminDatabasesStyle.module.css'

const ACTIVE_STATUSES = new Set(['pending', 'creating', 'pending-start', 'pending-stop'])

export function AdminDatabasesPage() {
  const qc = useQueryClient()
  const [showCreate, setShowCreate]           = useState(false)
  const [credsFor, setCredsFor]               = useState<ManagedDatabase | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [selectedUserId, setSelectedUserId]   = useState<string | null>(null)

  const { data: allDbs = [], isLoading, isError } = useQuery({
    queryKey: ['databases', selectedUserId],
    queryFn: () => getDatabases(selectedUserId),
    refetchInterval: (query) => {
      const data = query.state.data as ManagedDatabase[] | undefined
      if (!data) return 5_000
      return data.some(d => ACTIVE_STATUSES.has(d.status)) ? 3_000 : 10_000
    },
  })

  const { data: users = [] } = useQuery({ queryKey: ['users'], queryFn: getUsers, staleTime: 60_000 })

  const dbs = selectedUserId
    ? allDbs.filter(db => {
        const owner = users.find(u => u.id === selectedUserId)
        return owner ? db.project_id === owner.project?.id : true
      })
    : allDbs

  const deleteMut = useMutation({
    mutationFn: deleteDatabase,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['databases'] }); setConfirmDeleteId(null); toast.success('База данных удалена') },
    onError: () => toast.error('Ошибка при удалении'),
  })

  const buildCredFields = (db: ManagedDatabase): CredField[] => {
    const fields: CredField[] = []
    if (db.host)        fields.push({ label: 'Host',     value: db.host })
    if (db.port)        fields.push({ label: 'Port',     value: String(db.port) })
    if (db.db_name)     fields.push({ label: 'Database', value: db.db_name })
    if (db.db_user)     fields.push({ label: 'Username', value: db.db_user })
    if (db.db_password) fields.push({ label: 'Password', value: db.db_password, secret: true })
    if (db.host && db.port && db.db_user && db.db_password) {
      const cs = db.engine === 'postgres'
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
      <div className={shared.pageHeader}>
        <div>
          <h1 className={shared.pageTitle}>Managed Databases</h1>
          <p className={shared.pageSubtitle}>
            {dbs.length} database{dbs.length !== 1 ? 's' : ''}
            {hasPending && ' · auto-refresh 3s'}
          </p>
        </div>
        <button className="btn-primary" onClick={() => setShowCreate(true)}>+ New Database</button>
      </div>

      <UserFilter selectedUserId={selectedUserId} onChange={setSelectedUserId} />

      {isLoading && (
        <div className={shared.stateBox}><p className={shared.stateText}>Loading databases…</p></div>
      )}
      {isError && (
        <div className={shared.stateBox}><p className={shared.stateTextErr}>Failed to load databases.</p></div>
      )}
      {!isLoading && !isError && dbs.length === 0 && (
        <div className={shared.stateBox}><p className={shared.stateText}>No databases yet</p></div>
      )}

      {!isLoading && !isError && dbs.length > 0 && (
        <div className={shared.tableWrap}>
          <table className={shared.table}>
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
                const isActive     = ACTIVE_STATUSES.has(db.status)
                const isConfirming = confirmDeleteId === db.id
                const owner        = users.find(u => u.project?.id === db.project_id)
                return (
                  <tr key={db.id}>
                    <td className={shared.cellBold}>{db.name}</td>
                    <td className={s.ownerCell}>{owner ? owner.email.split('@')[0] : '—'}</td>
                    <td><EngineBadge engine={db.engine} /></td>
                    <td><StatusBadge status={db.status} /></td>
                    <td className={shared.cellMono}>
                      {db.host && db.port ? `${db.host}:${db.port}` : <span className={shared.cellDim}>—</span>}
                    </td>
                    <td className={shared.cellMono}>{db.db_name ?? '—'}</td>
                    <td className={shared.cellDim}>{new Date(db.created_at).toLocaleString('ru-RU')}</td>
                    <td>
                      <div className={s.cred}>
                        {db.status === 'running' && (
                          <button className={`${s.actionButton} ${s.credentialsButton}`} onClick={() => setCredsFor(db)}>
                            🔑 Credentials
                          </button>
                        )}
                        {isConfirming ? (
                          <>
                            <button className={`${s.actionButton} ${s.confirmDeleteButton}`}
                              disabled={deleteMut.isPending} onClick={() => deleteMut.mutate(db.id)}>
                              {deleteMut.isPending ? '...' : 'Да, удалить'}
                            </button>
                            <button className={`${s.actionButton} ${s.cancelButton}`}
                              onClick={() => setConfirmDeleteId(null)}>Отмена</button>
                          </>
                        ) : (
                          <button className={`${s.actionButton} ${s.deleteButton}`}
                            disabled={isActive} onClick={() => setConfirmDeleteId(db.id)}>
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

      {showCreate && (
        <CreateDatabaseModal
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); qc.invalidateQueries({ queryKey: ['databases'] }) }}
          users={users}
          preselectedUserId={selectedUserId}
        />
      )}
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

type EngineOption = { engine: DBEngine; label: string; icon: string; desc: string }

const ENGINE_OPTIONS: EngineOption[] = [
  { engine: 'postgres', label: 'PostgreSQL', icon: '🐘', desc: 'Реляционная БД' },
  { engine: 'mysql',    label: 'MySQL',      icon: '🐬', desc: 'Реляционная БД' },
  { engine: 'redis',    label: 'Redis',      icon: '⚡', desc: 'Кэш / брокер'   },
]

const ENGINE_SERVICE_TYPE: Record<DBEngine, string> = {
  postgres: 'db_postgres',
  mysql:    'db_mysql',
  redis:    'db_redis',
}

function CreateDatabaseModal({
  onClose, onCreated, users, preselectedUserId,
}: {
  onClose: () => void
  onCreated: () => void
  users: UserWithProject[]
  preselectedUserId: string | null
}) {
  const [engine, setEngine]             = useState<DBEngine>('postgres')
  const [flavorId, setFlavorId]         = useState('')
  const [name, setName]                 = useState('')
  const [dbName, setDbName]             = useState('')
  const [error, setError]               = useState('')
  const [targetUserId, setTargetUserId] = useState<string>(preselectedUserId ?? '')

  const targetUser      = users.find(u => u.id === targetUserId)
  const targetProjectId = targetUser?.project?.id ?? null
  const serviceType     = ENGINE_SERVICE_TYPE[engine]

  const { data: flavors = [], isLoading: loadFlavors } = useQuery<Flavor[]>({
    queryKey: ['flavors', serviceType],
    queryFn: () => getFlavors(serviceType),
  })

  const mutation = useMutation({
    mutationFn: createDatabase,
    onSuccess: () => { toast.success('База данных создаётся...'); onCreated() },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Ошибка создания'
      setError(msg); toast.error(msg)
    },
  })

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault(); setError('')
    if (!targetUserId)    return setError('Выберите пользователя')
    if (!targetProjectId) return setError('У выбранного пользователя нет проекта')
    if (!name.trim())     return setError('Введите имя сервиса')
    if (!flavorId)        return setError('Выберите конфигурацию')
    if (!dbName.trim())   return setError('Введите имя базы данных')
    mutation.mutate({ name: name.trim(), project_id: targetProjectId, flavor_id: flavorId, engine, db_name: dbName.trim() })
  }

  const nonAdminUsers = users.filter(u => u.role !== 'admin')

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h2 className={s.modalTitle}>🗄️ Create Database</h2>

        <form className={s.modalForm} onSubmit={handleSubmit}>

          {/* ── Пользователь ─────────────────────────────────────────── */}
          <div className={s.formGroup}>
            <label className="label">
              Пользователь <span style={{ color: 'var(--red)' }}>*</span>
            </label>
            {nonAdminUsers.length === 0 ? (
              <p className={s.loadingText}>Загрузка пользователей...</p>
            ) : (
              <div className={s.userPickerList}>
                {nonAdminUsers.map(u => {
                  const active = targetUserId === u.id
                  return (
                    <button key={u.id} type="button"
                      className={`${s.userPickerBtn} ${active ? s.userPickerBtnActive : ''}`}
                      onClick={() => setTargetUserId(u.id)}>
                      <span className={s.userPickerEmail}>👤 {u.email}</span>
                      <span className={s.userPickerProject}>
                        {u.project?.id ? `project: ${u.project.id.slice(0, 8)}…` : 'нет проекта'}
                      </span>
                      {active && <span className={s.userPickerCheck}>✓</span>}
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* ── Имя сервиса ──────────────────────────────────────────── */}
          <div className={s.formGroup}>
            <label className="label">Имя сервиса</label>
            <input className="input" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. production-db" />
          </div>

          {/* ── Движок ───────────────────────────────────────────────── */}
          <div className={s.formGroup}>
            <label className="label">Движок</label>
            <div className={s.engineGrid}>
              {ENGINE_OPTIONS.map(opt => (
                <button key={opt.engine} type="button"
                  className={`${s.engineButton} ${engine === opt.engine ? s.engineButtonSelected : ''}`}
                  onClick={() => { setEngine(opt.engine); setFlavorId('') }}>
                  <div className={s.engineIcon}>{opt.icon}</div>
                  <div className={s.engineLabel}>{opt.label}</div>
                  <div className={s.engineDesc}>{opt.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* ── Конфигурация ─────────────────────────────────────────── */}
          <div className={s.formGroup}>
            <label className="label">Конфигурация</label>
            {loadFlavors ? (
              <p className={s.loadingText}>Загрузка...</p>
            ) : flavors.length === 0 ? (
              <p className={s.errorText}>Нет доступных конфигураций для {engine}</p>
            ) : (
              <div className={s.flavorList}>
                {flavors.map(f => {
                  const ram = f.ram_mb >= 1024 ? `${f.ram_mb / 1024} GB` : `${f.ram_mb} MB`
                  return (
                    <button key={f.id} type="button"
                      className={`${s.flavorButton} ${flavorId === f.id ? s.flavorButtonSelected : ''}`}
                      onClick={() => setFlavorId(f.id)}>
                      <span className={s.flavorName}>{f.name}</span>
                      <span className={s.flavorSpecs}>{f.cpu} vCPU · {ram} · {f.disk_gb} GB</span>
                      {flavorId === f.id && <span className={s.flavorCheck}>✓</span>}
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* ── Имя БД ───────────────────────────────────────────────── */}
          <div className={s.formGroup}>
            <label className="label">Имя базы данных</label>
            <input className="input" value={dbName} onChange={e => setDbName(e.target.value)} placeholder="e.g. myapp_db" />
            <p className={s.hintText}>Credentials генерируются автоматически.</p>
          </div>

          {error && <div className="form-error">⚠ {error}</div>}

          <div className={s.formFooter}>
            <button type="button" className="btn-secondary" onClick={onClose}>Отмена</button>
            <button type="submit" className="btn-primary" disabled={mutation.isPending}>
              {mutation.isPending ? 'Создаём...' : 'Создать →'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}