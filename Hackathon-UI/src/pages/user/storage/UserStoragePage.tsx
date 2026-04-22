import { useState } from 'react'
import type { FormEvent } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  getObjectStorages, deleteObjectStorage,
  getFileStorages, deleteFileStorage,
  createObjectStorage, createFileStorage, getFlavors,
} from '../../../api/api'
import type { ObjectStorage, FileStorage, Flavor } from '../../../types/api'
import { ResourceCard } from '../../../components/ui/ResourceCard'
import { CredentialsModal, type CredField } from '../../../components/ui/CredentialsModal'
import { useCopyToClipboard } from '../../../hooks/useCopyToClipboard'
import { useAuth } from '../../../context/AuthContext'
import s from '../../shared.module.css'

type Tab = 'object' | 'file'
const ACTIVE = new Set(['pending', 'creating'])

export function UserStoragePage() {
  const qc = useQueryClient()
  const { user } = useAuth()
  const [tab, setTab]                         = useState<Tab>('object')
  const [credsFor, setCredsFor]               = useState<ObjectStorage | null>(null)
  const [confirmDeleteOS, setConfirmDeleteOS] = useState<string | null>(null)
  const [confirmDeleteFS, setConfirmDeleteFS] = useState<string | null>(null)
  const [showMountGuide, setShowMountGuide]   = useState<FileStorage | null>(null)
  const [showCreateOS, setShowCreateOS]       = useState(false)
  const [showCreateFS, setShowCreateFS]       = useState(false)
  const { copy } = useCopyToClipboard()

  const { data: objects = [], isLoading: loadOS, isError: errOS } = useQuery<ObjectStorage[]>({
    queryKey: ['object-storages'],
    queryFn: () => getObjectStorages(),
    refetchInterval: (q) => (q.state.data as ObjectStorage[] | undefined)?.some(s => ACTIVE.has(s.status)) ? 3_000 : 15_000,
  })
  const deleteOSMut = useMutation({ mutationFn: deleteObjectStorage, onSuccess: () => { qc.invalidateQueries({ queryKey: ['object-storages'] }); setConfirmDeleteOS(null); toast.success('Object Storage удалён') }, onError: () => toast.error('Ошибка удаления') })

  const { data: files = [], isLoading: loadFS, isError: errFS } = useQuery<FileStorage[]>({
    queryKey: ['file-storages'],
    queryFn: () => getFileStorages(),
    refetchInterval: (q) => (q.state.data as FileStorage[] | undefined)?.some(s => ACTIVE.has(s.status)) ? 3_000 : 15_000,
  })
  const deleteFSMut = useMutation({ mutationFn: deleteFileStorage, onSuccess: () => { qc.invalidateQueries({ queryKey: ['file-storages'] }); setConfirmDeleteFS(null); toast.success('File Storage удалён') }, onError: () => toast.error('Ошибка удаления') })

  const buildOSCreds = (os: ObjectStorage): CredField[] => {
    const f: CredField[] = []
    if (os.s3_endpoint)      f.push({ label: 'S3 Endpoint', value: os.s3_endpoint,      isLink: true })
    if (os.console_endpoint) f.push({ label: 'Console UI',  value: os.console_endpoint, isLink: true })
    if (os.access_key)       f.push({ label: 'Access Key',  value: os.access_key })
    if (os.secret_key)       f.push({ label: 'Secret Key',  value: os.secret_key,       secret: true })
    if (os.bucket_name)      f.push({ label: 'Bucket',      value: os.bucket_name })
    return f
  }

  const tabBtn = (active: boolean) => ({
    padding: '8px 20px', borderRadius: 8, cursor: 'pointer',
    border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
    background: active ? 'var(--accent-dim)' : 'transparent',
    color: active ? 'var(--accent)' : 'var(--text-sec)',
    fontWeight: active ? 700 : 400 as const, fontSize: 14,
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
      <div className={s.pageHeader}>
        <div>
          <h1 className={s.pageTitle}>Storage</h1>
          <p className={s.pageSubtitle}>{objects.length} object · {files.length} file volume{files.length !== 1 ? 's' : ''}</p>
        </div>
        <button className={s.btnPrimary} onClick={() => tab === 'object' ? setShowCreateOS(true) : setShowCreateFS(true)}>
          + New {tab === 'object' ? 'Object Storage' : 'File Storage'}
        </button>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        <button style={tabBtn(tab === 'object')} onClick={() => setTab('object')}>📦 Object Storage ({objects.length})</button>
        <button style={tabBtn(tab === 'file')}   onClick={() => setTab('file')}>💾 File Storage ({files.length})</button>
      </div>

      {/* Object tab */}
      {tab === 'object' && (
        <>
          {loadOS && <div className={s.stateBox}><div className={s.stateIcon}>📦</div><p className={s.stateText}>Loading…</p></div>}
          {errOS  && <div className={s.stateBox}><p className={s.stateTextErr}>Failed to load.</p></div>}
          {!loadOS && !errOS && objects.length === 0 && (
            <div className={s.stateBox}>
              <div className={s.stateIcon} style={{ fontSize: 48, opacity: 0.2 }}>📦</div>
              <p className={s.stateText}>Нет объектных хранилищ</p>
              <button className={s.btnPrimary} style={{ marginTop: 12 }} onClick={() => setShowCreateOS(true)}>+ Создать Object Storage</button>
            </div>
          )}
          {!loadOS && !errOS && objects.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
              {objects.map(os => {
                const isConf = confirmDeleteOS === os.id
                return (
                  <ResourceCard key={os.id} icon="📦" title={os.name} subtitle={os.bucket_name ? `Bucket: ${os.bucket_name}` : undefined} status={os.status}
                    details={<>{os.s3_endpoint && <span style={{ fontFamily: 'monospace', fontSize: 11 }}>🌐 {os.s3_endpoint}</span>}{os.storage_limit_gb && <span>💽 {os.storage_limit_gb} GB</span>}</>}
                    actions={<>
                      {os.status === 'running' && <>
                        <button onClick={() => setCredsFor(os)} style={btn('#0f2a47','#60a5fa')}>🔑 Access</button>
                        {os.console_endpoint && <button onClick={() => window.open(os.console_endpoint ?? undefined, '_blank')} style={btn('#1e3a5f','#90d2f0')}>🔗 Console</button>}
                      </>}
                      {isConf ? <>
                        <button disabled={deleteOSMut.isPending} onClick={() => deleteOSMut.mutate(os.id)} style={btn('#4a0f0f','#f87171')}>{deleteOSMut.isPending ? '...' : 'Удалить?'}</button>
                        <button onClick={() => setConfirmDeleteOS(null)} style={btnOutline}>Нет</button>
                      </> : <button disabled={ACTIVE.has(os.status)} onClick={() => setConfirmDeleteOS(os.id)} style={btn('#3f1212','#f87171', ACTIVE.has(os.status))}>✕ Delete</button>}
                    </>}
                  />
                )
              })}
            </div>
          )}
        </>
      )}

      {/* File tab */}
      {tab === 'file' && (
        <>
          {loadFS && <div className={s.stateBox}><div className={s.stateIcon}>💾</div><p className={s.stateText}>Loading…</p></div>}
          {errFS  && <div className={s.stateBox}><p className={s.stateTextErr}>Failed to load.</p></div>}
          {!loadFS && !errFS && files.length === 0 && (
            <div className={s.stateBox}>
              <div className={s.stateIcon} style={{ fontSize: 48, opacity: 0.2 }}>💾</div>
              <p className={s.stateText}>Нет файловых хранилищ</p>
              <button className={s.btnPrimary} style={{ marginTop: 12 }} onClick={() => setShowCreateFS(true)}>+ Создать File Storage</button>
            </div>
          )}
          {!loadFS && !errFS && files.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
              {files.map(fs => {
                const isConf = confirmDeleteFS === fs.id
                return (
                  <ResourceCard key={fs.id} icon="💾" title={fs.name} subtitle={fs.volume_name ? `Volume: ${fs.volume_name}` : undefined} status={fs.status}
                    details={
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {fs.nfs_endpoint && <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <code style={{ fontSize: 11 }}>🌐 {fs.nfs_endpoint}</code>
                          <button onClick={() => { if (fs.nfs_endpoint) { copy(fs.nfs_endpoint); toast.success('Скопировано') } }} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 13, color: 'var(--text-dim)' }}>📋</button>
                        </div>}
                        {fs.size_gb && <span>💽 {fs.size_gb} GB</span>}
                      </div>
                    }
                    actions={isConf ? <>
                      <button disabled={deleteFSMut.isPending} onClick={() => deleteFSMut.mutate(fs.id)} style={btn('#4a0f0f','#f87171')}>{deleteFSMut.isPending ? '...' : 'Удалить?'}</button>
                      <button onClick={() => setConfirmDeleteFS(null)} style={btnOutline}>Нет</button>
                    </> : <>
                      <button onClick={() => setShowMountGuide(fs)} style={btn('#1e3a5f','#90d2f0')}>ℹ Монтирование</button>
                      <button disabled={ACTIVE.has(fs.status)} onClick={() => setConfirmDeleteFS(fs.id)} style={btn('#3f1212','#f87171', ACTIVE.has(fs.status))}>✕ Delete</button>
                    </>}
                  />
                )
              })}
            </div>
          )}
        </>
      )}

      {credsFor    && <CredentialsModal title={`${credsFor.name} — Access`} fields={buildOSCreds(credsFor)} onClose={() => setCredsFor(null)} />}
      {showMountGuide && <MountGuideModal storage={showMountGuide} onClose={() => setShowMountGuide(null)} />}
      {showCreateOS && user && <CreateObjectStorageModal projectId={user.project_id} onClose={() => setShowCreateOS(false)} onCreated={() => { setShowCreateOS(false); qc.invalidateQueries({ queryKey: ['object-storages'] }) }} />}
      {showCreateFS && user && <CreateFileStorageModal   projectId={user.project_id} onClose={() => setShowCreateFS(false)} onCreated={() => { setShowCreateFS(false); qc.invalidateQueries({ queryKey: ['file-storages'] }) }} />}
    </div>
  )
}

function MountGuideModal({ storage, onClose }: { storage: FileStorage; onClose: () => void }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={onClose}>
      <div style={{ background: 'var(--bg-surface)', borderRadius: 16, padding: 24, maxWidth: 500, width: '90%', border: '1px solid var(--border)' }} onClick={e => e.stopPropagation()}>
        <h3 style={{ margin: '0 0 16px', color: 'var(--text-pri)' }}>💾 Монтирование: {storage.name}</h3>
        <pre style={{ background: 'var(--bg-raised)', padding: 16, borderRadius: 8, fontSize: 12, overflowX: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-all', color: 'var(--text-pri)' }}>
{`# Установить nfs-common (Ubuntu/Debian)
sudo apt install -y nfs-common

# Создать точку монтирования
sudo mkdir -p /mnt/${storage.name}

# Примонтировать
sudo mount -t nfs ${storage.nfs_endpoint ?? '<endpoint>'}:/ /mnt/${storage.name}

# /etc/fstab (автомонтирование):
${storage.nfs_endpoint ?? '<endpoint>'}:/ /mnt/${storage.name} nfs defaults,_netdev 0 0`}
        </pre>
        <button onClick={onClose} style={{ marginTop: 16, padding: '8px 16px', borderRadius: 6, background: 'var(--accent)', color: 'white', border: 'none', cursor: 'pointer', width: '100%', fontWeight: 700 }}>Закрыть</button>
      </div>
    </div>
  )
}

function CreateObjectStorageModal({ projectId, onClose, onCreated }: { projectId: string; onClose: () => void; onCreated: () => void }) {
  const [name, setName]         = useState('')
  const [bucketName, setBucket] = useState('')
  const [flavorId, setFlavorId] = useState('')
  const [error, setError]       = useState('')

  const { data: flavors = [], isLoading } = useQuery<Flavor[]>({ queryKey: ['flavors', 'object_storage'], queryFn: () => getFlavors('object_storage') })

  const mutation = useMutation({
    mutationFn: createObjectStorage,
    onSuccess: () => { toast.success('Object Storage создаётся...'); onCreated() },
    onError: (err: unknown) => { const msg = apiErr(err); setError(msg); toast.error(msg) },
  })

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault(); setError('')
    if (!name.trim())       return setError('Введите имя')
    if (!bucketName.trim()) return setError('Введите имя бакета')
    if (!flavorId)          return setError('Выберите конфигурацию')
    mutation.mutate({ name: name.trim(), project_id: projectId, flavor_id: flavorId, bucket_name: bucketName.trim() })
  }

  return (
    <Modal onClose={onClose} title="📦 New Object Storage">
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Field label="Имя"><input value={name} onChange={e => setName(e.target.value)} placeholder="my-storage" autoFocus style={inputStyle} /></Field>
        <Field label="Имя бакета"><input value={bucketName} onChange={e => setBucket(e.target.value)} placeholder="my-bucket" style={inputStyle} /></Field>
        <Field label="Конфигурация"><FlavorPicker flavors={flavors} loading={isLoading} selected={flavorId} onSelect={setFlavorId} /></Field>
        {error && <ErrorBox msg={error} />}
        <ModalFooter onClose={onClose} pending={mutation.isPending} />
      </form>
    </Modal>
  )
}

function CreateFileStorageModal({ projectId, onClose, onCreated }: { projectId: string; onClose: () => void; onCreated: () => void }) {
  const [name, setName]         = useState('')
  const [flavorId, setFlavorId] = useState('')
  const [error, setError]       = useState('')

  const { data: flavors = [], isLoading } = useQuery<Flavor[]>({ queryKey: ['flavors', 'file_storage'], queryFn: () => getFlavors('file_storage') })

  const mutation = useMutation({
    mutationFn: createFileStorage,
    onSuccess: () => { toast.success('File Storage создаётся...'); onCreated() },
    onError: (err: unknown) => { const msg = apiErr(err); setError(msg); toast.error(msg) },
  })

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault(); setError('')
    if (!name.trim()) return setError('Введите имя')
    if (!flavorId)    return setError('Выберите конфигурацию')
    mutation.mutate({ name: name.trim(), project_id: projectId, flavor_id: flavorId })
  }

  return (
    <Modal onClose={onClose} title="💾 New File Storage">
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Field label="Имя"><input value={name} onChange={e => setName(e.target.value)} placeholder="my-volume" autoFocus style={inputStyle} /></Field>
        <Field label="Конфигурация"><FlavorPicker flavors={flavors} loading={isLoading} selected={flavorId} onSelect={setFlavorId} /></Field>
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
