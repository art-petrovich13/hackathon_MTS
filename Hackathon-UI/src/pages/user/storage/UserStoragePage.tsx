import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  getObjectStorages, deleteObjectStorage,
  getFileStorages,   deleteFileStorage,
} from '../../../api/api'
import type { ObjectStorage, FileStorage } from '../../../types/api'
import { ResourceCard } from '../../../components/ui/ResourceCard'
import { CredentialsModal, type CredField } from '../../../components/ui/CredentialsModal'
import { useCopyToClipboard } from '../../../hooks/useCopyToClipboard'
import s from '../../shared.module.css'

type Tab = 'object' | 'file'

const ACTIVE = new Set(['pending', 'creating'])

export function UserStoragePage() {
  const qc = useQueryClient()
  const [tab, setTab]                         = useState<Tab>('object')
  const [credsFor, setCredsFor]               = useState<ObjectStorage | null>(null)
  const [confirmDeleteOS, setConfirmDeleteOS] = useState<string | null>(null)
  const [confirmDeleteFS, setConfirmDeleteFS] = useState<string | null>(null)
  const [showMountGuide, setShowMountGuide]   = useState<FileStorage | null>(null)
  const { copy } = useCopyToClipboard()

  // ── Object Storages ──────────────────────────────────────────────────────────
  const { data: objects = [], isLoading: loadOS, isError: errOS } = useQuery<ObjectStorage[]>({
    queryKey: ['object-storages'],
    queryFn: () => getObjectStorages(),
    refetchInterval: (query) => {
      const data = query.state.data as ObjectStorage[] | undefined
      return data?.some(s => ACTIVE.has(s.status)) ? 3_000 : 15_000
    },
  })

  const deleteOSMut = useMutation({
    mutationFn: deleteObjectStorage,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['object-storages'] })
      setConfirmDeleteOS(null)
      toast.success('Object Storage удалён')
    },
    onError: () => toast.error('Ошибка удаления'),
  })

  // ── File Storages ────────────────────────────────────────────────────────────
  const { data: files = [], isLoading: loadFS, isError: errFS } = useQuery<FileStorage[]>({
    queryKey: ['file-storages'],
    queryFn: () => getFileStorages(), // ← обёрнуто в стрелку, иначе TS-ошибка
    refetchInterval: (query) => {
      const data = query.state.data as FileStorage[] | undefined
      return data?.some(s => ACTIVE.has(s.status)) ? 3_000 : 15_000
    },
  })

  const deleteFSMut = useMutation({
    mutationFn: deleteFileStorage,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['file-storages'] })
      setConfirmDeleteFS(null)
      toast.success('File Storage удалён')
    },
    onError: () => toast.error('Ошибка удаления'),
  })

  // Credentials поля для Object Storage
  const buildOSCredFields = (os: ObjectStorage): CredField[] => {
    const fields: CredField[] = []
    if (os.s3_endpoint)      fields.push({ label: 'S3 Endpoint',  value: os.s3_endpoint,      isLink: true })
    if (os.console_endpoint) fields.push({ label: 'Console UI',   value: os.console_endpoint, isLink: true })
    if (os.access_key)       fields.push({ label: 'Access Key',   value: os.access_key })
    if (os.secret_key)       fields.push({ label: 'Secret Key',   value: os.secret_key,       secret: true })
    if (os.bucket_name)      fields.push({ label: 'Bucket',       value: os.bucket_name })
    return fields
  }

  // Инструкция по монтированию NFS
  const MountGuideModal = ({ storage, onClose }: { storage: FileStorage; onClose: () => void }) => (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000,
    }} onClick={onClose}>
      <div style={{
        background: 'var(--bg-surface)', borderRadius: 16,
        padding: 24, maxWidth: 500, width: '90%',
        border: '1px solid var(--border)',
      }} onClick={e => e.stopPropagation()}>
        <h3 style={{ margin: '0 0 16px 0', color: 'var(--text-pri)' }}>
          💾 Как монтировать {storage.name}
        </h3>
        <div style={{
          background: 'var(--bg-surface-hover)', padding: 16,
          borderRadius: 8, fontFamily: 'monospace', fontSize: 13,
          marginBottom: 20, whiteSpace: 'pre-wrap', wordBreak: 'break-all'
        }}>
          {storage.nfs_endpoint && (
            <>
              # Установите nfs-common (Ubuntu/Debian)<br/>
              sudo apt update && sudo apt install -y nfs-common<br/><br/>

              # Создайте точку монтирования<br/>
              sudo mkdir -p /mnt/{storage.name}<br/><br/>

              # Примонтируйте NFS шару<br/>
              sudo mount -t nfs {storage.nfs_endpoint}:/ /mnt/{storage.name}<br/><br/>

              # Для автоматического монтирования при загрузке добавьте в /etc/fstab:<br/>
              {storage.nfs_endpoint}:/ /mnt/{storage.name} nfs defaults,timeo=600,retrans=5,_netdev 0 0
            </>
          )}
        </div>
        <button
          onClick={onClose}
          style={{
            padding: '8px 16px', borderRadius: 6,
            background: 'var(--accent)', color: 'white',
            border: 'none', cursor: 'pointer', width: '100%',
          }}
        >
          Закрыть
        </button>
      </div>
    </div>
  )

  // Стиль кнопки вкладки
  const tabBtn = (active: boolean) => ({
    padding: '8px 20px', borderRadius: 8, cursor: 'pointer',
    border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
    background: active ? 'var(--accent-dim)' : 'transparent',
    color: active ? 'var(--accent)' : 'var(--text-sec)',
    fontWeight: active ? 700 : 400 as const,
    fontSize: 14, transition: 'all 0.15s',
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>

      {/* ── Шапка ─────────────────────────────────────────────────────────── */}
      <div className={s.pageHeader}>
        <div>
          <h1 className={s.pageTitle}>Storage</h1>
          <p className={s.pageSubtitle}>
            {objects.length} object store{objects.length !== 1 ? 's' : ''} ·{' '}
            {files.length} file volume{files.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {/* ── Вкладки ───────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        <button style={tabBtn(tab === 'object')} onClick={() => setTab('object')}>
          📦 Object Storage ({objects.length})
        </button>
        <button style={tabBtn(tab === 'file')} onClick={() => setTab('file')}>
          💾 File Storage ({files.length})
        </button>
      </div>

      {/* ── Object Storage tab ────────────────────────────────────────────── */}
      {tab === 'object' && (
        <>
          {loadOS && (
            <div className={s.stateBox}>
              <div className={s.stateIcon}>📦</div>
              <p className={s.stateText}>Loading…</p>
            </div>
          )}
          {errOS && (
            <div className={s.stateBox}>
              <p className={s.stateTextErr}>Failed to load. Попроси создать в Admin Panel.</p>
            </div>
          )}
          {!loadOS && !errOS && objects.length === 0 && (
            <div className={s.stateBox}>
              <div className={s.stateIcon} style={{ fontSize: 48, opacity: 0.2 }}>📦</div>
              <p className={s.stateText}>Нет объектных хранилищ</p>
              <p style={{ fontSize: 13, color: 'var(--text-dim)' }}>
                Создай в Admin → Object Storage
              </p>
            </div>
          )}
          {!loadOS && !errOS && objects.length > 0 && (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
              gap: 16,
            }}>
              {objects.map(os => {
                const isConfirming = confirmDeleteOS === os.id
                return (
                  <ResourceCard
                    key={os.id}
                    icon="📦"
                    title={os.name}
                    subtitle={os.bucket_name ? `Bucket: ${os.bucket_name}` : undefined}
                    status={os.status}
                    details={
                      <>
                        {os.s3_endpoint && (
                          <span style={{ fontFamily: 'monospace', fontSize: 11 }}>
                            🌐 {os.s3_endpoint}
                          </span>
                        )}
                        {os.storage_limit_gb && <span>💽 {os.storage_limit_gb} GB</span>}
                      </>
                    }
                    actions={
                      <>
                        {os.status === 'running' && (
                          <>
                            <button
                              onClick={() => setCredsFor(os)}
                              style={{
                                padding: '6px 14px', borderRadius: 6, border: 'none',
                                background: '#0f2a47', color: '#60a5fa',
                                cursor: 'pointer', fontWeight: 600, fontSize: 12,
                              }}
                            >
                              🔑 Access
                            </button>
                            {os.console_endpoint && (
                              <button
                                onClick={() => window.open(os.console_endpoint ?? undefined, '_blank')}
                                style={{
                                  padding: '6px 14px', borderRadius: 6, border: 'none',
                                  background: '#1e3a5f', color: '#90d2f0',
                                  cursor: 'pointer', fontWeight: 600, fontSize: 12,
                                }}
                              >
                                🔗 Console
                              </button>
                            )}
                          </>
                        )}
                        {isConfirming ? (
                          <>
                            <button
                              onClick={() => deleteOSMut.mutate(os.id)}
                              disabled={deleteOSMut.isPending}
                              style={{
                                padding: '6px 14px', borderRadius: 6, border: 'none',
                                background: '#4a0f0f', color: '#f87171',
                                cursor: 'pointer', fontWeight: 600, fontSize: 12,
                              }}
                            >
                              {deleteOSMut.isPending ? '...' : 'Удалить?'}
                            </button>
                            <button
                              onClick={() => setConfirmDeleteOS(null)}
                              style={{
                                padding: '6px 10px', borderRadius: 6,
                                border: '1px solid var(--border)',
                                background: 'transparent', color: 'var(--text-sec)',
                                cursor: 'pointer', fontSize: 12,
                              }}
                            >
                              Нет
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => setConfirmDeleteOS(os.id)}
                            disabled={ACTIVE.has(os.status)}
                            style={{
                              padding: '6px 14px', borderRadius: 6, border: 'none',
                              background: '#3f1212', color: '#f87171',
                              cursor: ACTIVE.has(os.status) ? 'not-allowed' : 'pointer',
                              fontWeight: 600, fontSize: 12,
                              opacity: ACTIVE.has(os.status) ? 0.4 : 1,
                            }}
                          >
                            ✕ Delete
                          </button>
                        )}
                      </>
                    }
                  />
                )
              })}
            </div>
          )}
        </>
      )}

      {/* ── File Storage tab ──────────────────────────────────────────────── */}
      {tab === 'file' && (
        <>
          {loadFS && (
            <div className={s.stateBox}>
              <div className={s.stateIcon}>💾</div>
              <p className={s.stateText}>Loading…</p>
            </div>
          )}
          {errFS && (
            <div className={s.stateBox}>
              <p className={s.stateTextErr}>Failed to load. Попроси создать в Admin Panel.</p>
            </div>
          )}
          {!loadFS && !errFS && files.length === 0 && (
            <div className={s.stateBox}>
              <div className={s.stateIcon} style={{ fontSize: 48, opacity: 0.2 }}>💾</div>
              <p className={s.stateText}>Нет файловых хранилищ</p>
              <p style={{ fontSize: 13, color: 'var(--text-dim)' }}>
                Создай в Admin → File Storage
              </p>
            </div>
          )}
          {!loadFS && !errFS && files.length > 0 && (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
              gap: 16,
            }}>
              {files.map(fs => {
                const isConfirming = confirmDeleteFS === fs.id
                return (
                  <ResourceCard
                    key={fs.id}
                    icon="💾"
                    title={fs.name}
                    subtitle={fs.volume_name ? `Volume: ${fs.volume_name}` : undefined}
                    status={fs.status}
                    details={
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {fs.nfs_endpoint && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <code style={{ fontSize: 11, fontFamily: 'monospace' }}>
                              🌐 {fs.nfs_endpoint}
                            </code>
                            <button
                              onClick={() => {
                                if (fs.nfs_endpoint) {
                                  copy(fs.nfs_endpoint)
                                  toast.success('Endpoint скопирован')
                                }
                              }}
                              style={{
                                background: 'transparent', border: 'none',
                                cursor: 'pointer', fontSize: 14, padding: 2,
                                color: 'var(--text-dim)',
                              }}
                              title="Копировать endpoint"
                            >
                              📋
                            </button>
                          </div>
                        )}
                        {fs.size_gb && <span>💽 {fs.size_gb} GB</span>}
                      </div>
                    }
                    actions={
                      isConfirming ? (
                        <>
                          <button
                            onClick={() => deleteFSMut.mutate(fs.id)}
                            disabled={deleteFSMut.isPending}
                            style={{
                              padding: '6px 14px', borderRadius: 6, border: 'none',
                              background: '#4a0f0f', color: '#f87171',
                              cursor: 'pointer', fontWeight: 600, fontSize: 12,
                            }}
                          >
                            {deleteFSMut.isPending ? '...' : 'Удалить?'}
                          </button>
                          <button
                            onClick={() => setConfirmDeleteFS(null)}
                            style={{
                              padding: '6px 10px', borderRadius: 6,
                              border: '1px solid var(--border)',
                              background: 'transparent', color: 'var(--text-sec)',
                              cursor: 'pointer', fontSize: 12,
                            }}
                          >
                            Нет
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => setShowMountGuide(fs)}
                            style={{
                              padding: '6px 14px', borderRadius: 6, border: 'none',
                              background: '#1e3a5f', color: '#90d2f0',
                              cursor: 'pointer', fontWeight: 600, fontSize: 12,
                            }}
                          >
                            ℹ Монтирование
                          </button>
                          <button
                            onClick={() => setConfirmDeleteFS(fs.id)}
                            disabled={ACTIVE.has(fs.status)}
                            style={{
                              padding: '6px 14px', borderRadius: 6, border: 'none',
                              background: '#3f1212', color: '#f87171',
                              cursor: ACTIVE.has(fs.status) ? 'not-allowed' : 'pointer',
                              fontWeight: 600, fontSize: 12,
                              opacity: ACTIVE.has(fs.status) ? 0.4 : 1,
                            }}
                          >
                            ✕ Delete
                          </button>
                        </>
                      )
                    }
                  />
                )
              })}
            </div>
          )}
        </>
      )}

      {/* ── Credentials Modal ─────────────────────────────────────────────── */}
      {credsFor && (
        <CredentialsModal
          title={`${credsFor.name} — Access`}
          fields={buildOSCredFields(credsFor)}
          onClose={() => setCredsFor(null)}
        />
      )}

      {/* ── Mount Guide Modal ─────────────────────────────────────────────── */}
      {showMountGuide && (
        <MountGuideModal
          storage={showMountGuide}
          onClose={() => setShowMountGuide(null)}
        />
      )}
    </div>
  )
}