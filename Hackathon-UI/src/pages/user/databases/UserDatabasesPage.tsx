import { useState } from 'react'
import type { FormEvent, CSSProperties } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  getDatabases, deleteDatabase, startDatabase, stopDatabase,
  createDatabase, getFlavors,
} from '../../../api/api'
import type { ManagedDatabase, DBEngine, Flavor } from '../../../types/api'
import { ResourceCard } from '../../../components/ui/ResourceCard'
import { CredentialsModal, type CredField } from '../../../components/ui/CredentialsModal'
import { useAuth } from '../../../context/AuthContext'
import s from '../../shared.module.css'

const ENGINE_ICONS: Record<string, string> = { postgres: '🐘', mysql: '🐬', redis: '⚡' }
const TRANSITIONAL = new Set(['pending', 'creating', 'pending-start', 'pending-stop'])

const ENGINES: { engine: DBEngine; label: string; icon: string }[] = [
  { engine: 'postgres', label: 'PostgreSQL', icon: '🐘' },
  { engine: 'mysql',    label: 'MySQL',      icon: '🐬' },
  { engine: 'redis',    label: 'Redis',      icon: '⚡' },
]
const ENGINE_SERVICE: Record<DBEngine, string> = {
  postgres: 'db_postgres', mysql: 'db_mysql', redis: 'db_redis',
}

export function UserDatabasesPage() {
  const qc = useQueryClient()
  const { user } = useAuth()
  const [credsFor, setCredsFor] = useState<ManagedDatabase | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)

  const { data: dbs = [], isLoading, isError } = useQuery<ManagedDatabase[]>({
    queryKey: ['databases'],
    queryFn: () => getDatabases(),
    refetchInterval: (query) => {
      const data = query.state.data as ManagedDatabase[] | undefined
      return data?.some(d => TRANSITIONAL.has(d.status)) ? 3_000 : 10_000
    },
  })

  const deleteMut = useMutation({ mutationFn: deleteDatabase, onSuccess: () => { qc.invalidateQueries({ queryKey: ['databases'] }); setConfirmDeleteId(null); toast.success('База удалена') }, onError: () => toast.error('Ошибка удаления') })
  const startMut  = useMutation({ mutationFn: startDatabase,  onSuccess: () => { qc.invalidateQueries({ queryKey: ['databases'] }); toast.success('Запускается...') }, onError: () => toast.error('Ошибка запуска') })
  const stopMut   = useMutation({ mutationFn: stopDatabase,   onSuccess: () => { qc.invalidateQueries({ queryKey: ['databases'] }); toast.success('Останавливается...') }, onError: () => toast.error('Ошибка остановки') })

  const buildCredFields = (db: ManagedDatabase): CredField[] => {
    const f: CredField[] = []
    if (db.host)        f.push({ label: 'Host',     value: db.host })
    if (db.port)        f.push({ label: 'Port',     value: String(db.port) })
    if (db.db_name)     f.push({ label: 'Database', value: db.db_name })
    if (db.db_user)     f.push({ label: 'Username', value: db.db_user })
    if (db.db_password) f.push({ label: 'Password', value: db.db_password, secret: true })
    return f
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
      <div className={s.pageHeader}>
        <div>
          <h1 className={s.pageTitle}>Databases</h1>
          <p className={s.pageSubtitle}>{dbs.length} database{dbs.length !== 1 ? 's' : ''}</p>
        </div>
        <button className={s.btnPrimary} onClick={() => setShowCreate(true)}>+ New Database</button>
      </div>

      {isLoading && <div className={s.stateBox}><div className={s.stateIcon}>🗄️</div><p className={s.stateText}>Loading…</p></div>}
      {isError   && <div className={s.stateBox}><p className={s.stateTextErr}>Failed to load databases.</p></div>}
      {!isLoading && !isError && dbs.length === 0 && (
        <div className={s.stateBox}>
          <div className={s.stateIcon} style={{ fontSize: 48, opacity: 0.2 }}>🗄️</div>
          <p className={s.stateText}>Нет баз данных</p>
          <button className={s.btnPrimary} style={{ marginTop: 12 }} onClick={() => setShowCreate(true)}>+ Создать базу данных</button>
        </div>
      )}

      {!isLoading && !isError && dbs.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
          {dbs.map(db => {
            const isConf = confirmDeleteId === db.id
            const trans  = TRANSITIONAL.has(db.status)
            return (
              <ResourceCard key={db.id} icon={ENGINE_ICONS[db.engine] ?? '🗄️'} title={db.name}
                subtitle={`${db.engine} ${db.engine_version ?? ''}`} status={db.status}
                details={<>{db.host && db.port && <span style={{ fontFamily: 'monospace' }}>🌐 {db.host}:{db.port}</span>}{db.db_name && <span>📋 {db.db_name}</span>}</>}
                actions={<>
                  {db.status === 'stopped' && <button disabled={trans} onClick={() => startMut.mutate(db.id)} style={btn('#1a3d1a','#4ade80', trans)}>▶ Start</button>}
                  {db.status === 'running'  && <button disabled={trans} onClick={() => stopMut.mutate(db.id)}  style={btn('#3d1a00','#fb923c', trans)}>■ Stop</button>}
                  {db.status === 'running'  && <button onClick={() => setCredsFor(db)} style={btn('#0f2a47','#60a5fa')}>🔑 Credentials</button>}
                  {isConf ? <>
                    <button disabled={deleteMut.isPending} onClick={() => deleteMut.mutate(db.id)} style={btn('#4a0f0f','#f87171')}>{deleteMut.isPending ? '...' : 'Удалить?'}</button>
                    <button onClick={() => setConfirmDeleteId(null)} style={btnOutline}>Нет</button>
                  </> : <button disabled={trans} onClick={() => setConfirmDeleteId(db.id)} style={btn('#3f1212','#f87171', trans)}>✕ Delete</button>}
                </>}
              />
            )
          })}
        </div>
      )}

      {showCreate && user && (
        <CreateDatabaseModal projectId={user.project_id} onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); qc.invalidateQueries({ queryKey: ['databases'] }) }} />
      )}
      {credsFor && <CredentialsModal title={`${credsFor.name} — Credentials`} fields={buildCredFields(credsFor)} onClose={() => setCredsFor(null)} />}
    </div>
  )
}

function CreateDatabaseModal({ projectId, onClose, onCreated }: { projectId: string; onClose: () => void; onCreated: () => void }) {
  const [engine, setEngine]   = useState<DBEngine>('postgres')
  const [flavorId, setFlavorId] = useState('')
  const [name, setName]       = useState('')
  const [dbName, setDbName]   = useState('')
  const [error, setError]     = useState('')

  const { data: flavors = [], isLoading: loadFlavors } = useQuery<Flavor[]>({
    queryKey: ['flavors', ENGINE_SERVICE[engine]],
    queryFn: () => getFlavors(ENGINE_SERVICE[engine]),
  })

  const mutation = useMutation({
    mutationFn: createDatabase,
    onSuccess: () => { toast.success('База данных создаётся...'); onCreated() },
    onError: (err: unknown) => { const msg = apiErr(err); setError(msg); toast.error(msg) },
  })

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault(); setError('')
    if (!name.trim())   return setError('Введите имя')
    if (!flavorId)      return setError('Выберите конфигурацию')
    if (!dbName.trim()) return setError('Введите имя базы данных')
    mutation.mutate({ name: name.trim(), project_id: projectId, flavor_id: flavorId, engine, db_name: dbName.trim() })
  }

  return (
    <Modal onClose={onClose} title="🗄️ New Database">
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Field label="Имя сервиса"><input value={name} onChange={e => setName(e.target.value)} placeholder="production-db" autoFocus style={inputStyle} /></Field>

        <Field label="Движок">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
            {ENGINES.map(opt => (
              <button key={opt.engine} type="button" onClick={() => { setEngine(opt.engine); setFlavorId('') }}
                style={{ padding: '10px 8px', borderRadius: 10, cursor: 'pointer', textAlign: 'center', border: `2px solid ${engine === opt.engine ? 'var(--accent)' : 'var(--border)'}`, background: engine === opt.engine ? 'var(--accent-dim)' : 'transparent' }}>
                <div style={{ fontSize: 22 }}>{opt.icon}</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-pri)' }}>{opt.label}</div>
              </button>
            ))}
          </div>
        </Field>

        <Field label="Конфигурация"><FlavorPicker flavors={flavors} loading={loadFlavors} selected={flavorId} onSelect={setFlavorId} /></Field>
        <Field label="Имя базы данных"><input value={dbName} onChange={e => setDbName(e.target.value)} placeholder="myapp_db" style={inputStyle} /></Field>

        {error && <ErrorBox msg={error} />}
        <ModalFooter onClose={onClose} pending={mutation.isPending} />
      </form>
    </Modal>
  )
}

// ─── Shared helpers ───────────────────────────────────────────────────────────
const apiErr = (err: unknown) => { const e = err as any; return e?.response?.data?.error ?? e?.response?.data?.message ?? (err instanceof Error ? err.message : 'Ошибка') }

const btn = (bg: string, color: string, disabled = false): React.CSSProperties => ({
  padding: '6px 14px', borderRadius: 6, border: 'none', background: bg, color,
  cursor: disabled ? 'not-allowed' : 'pointer', fontWeight: 600, fontSize: 12,
  opacity: disabled ? 0.4 : 1,
})
const btnOutline: React.CSSProperties = { padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-sec)', cursor: 'pointer', fontSize: 12 }
const inputStyle: React.CSSProperties = { width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-raised)', color: 'var(--text-pri)', fontSize: 14, outline: 'none', boxSizing: 'border-box' }
const labelStyle: React.CSSProperties = { display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text-sec)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label style={labelStyle}>{label}</label>{children}</div>
}
function Modal({ onClose, title, children }: { onClose: () => void; title: string; children: React.ReactNode }) {
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 28, width: 480, maxWidth: '95vw', maxHeight: '90vh', overflowY: 'auto' }}>
        <h2 style={{ margin: '0 0 20px', fontSize: 18, fontWeight: 700, color: 'var(--text-pri)' }}>{title}</h2>
        {children}
      </div>
    </div>
  )
}
function FlavorPicker({ flavors, loading, selected, onSelect }: { flavors: Flavor[]; loading: boolean; selected: string; onSelect: (id: string) => void }) {
  if (loading) return <p style={{ color: 'var(--text-sec)', fontSize: 13 }}>Загрузка...</p>
  if (!flavors.length) return <p style={{ color: '#ef4444', fontSize: 13 }}>Нет конфигураций</p>
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {flavors.map(f => {
        const sel = selected === f.id
        const ram = f.ram_mb >= 1024 ? `${f.ram_mb / 1024} GB` : `${f.ram_mb} MB`
        return (
          <button key={f.id} type="button" onClick={() => onSelect(f.id)}
            style={{ padding: '10px 14px', borderRadius: 8, textAlign: 'left', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', border: `1px solid ${sel ? 'var(--accent)' : 'var(--border)'}`, background: sel ? 'var(--accent-dim)' : 'transparent' }}>
            <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-pri)' }}>{f.name}</span>
            <span style={{ fontSize: 12, color: 'var(--text-sec)' }}>{f.cpu} vCPU · {ram} · {f.disk_gb} GB</span>
            {sel && <span style={{ color: 'var(--accent)', marginLeft: 8 }}>✓</span>}
          </button>
        )
      })}
    </div>
  )
}
function ErrorBox({ msg }: { msg: string }) {
  return <div style={{ padding: '10px 14px', borderRadius: 8, background: 'rgba(255,77,106,0.08)', border: '1px solid rgba(255,77,106,0.3)', color: '#ef4444', fontSize: 13 }}>⚠ {msg}</div>
}
function ModalFooter({ onClose, pending }: { onClose: () => void; pending: boolean }) {
  return (
    <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
      <button type="button" onClick={onClose} style={{ padding: '10px 20px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', fontWeight: 600, color: 'var(--text-pri)' }}>Отмена</button>
      <button type="submit" disabled={pending} style={{ padding: '10px 20px', borderRadius: 8, background: 'var(--accent)', border: 'none', color: 'white', cursor: pending ? 'not-allowed' : 'pointer', fontWeight: 700, opacity: pending ? 0.6 : 1 }}>{pending ? 'Создаём...' : 'Создать →'}</button>
    </div>
  )
}
