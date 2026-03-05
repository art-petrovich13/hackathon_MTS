import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { getDatabases, deleteDatabase, startDatabase, stopDatabase } from '../../../api/api'
import type { ManagedDatabase } from '../../../types/api'
import { ResourceCard } from '../../../components/ui/ResourceCard'
import { CredentialsModal, type CredField } from '../../../components/ui/CredentialsModal'
import s from '../../shared.module.css'

const ENGINE_ICONS: Record<string, string> = {
  postgres: '🐘', mysql: '🐬', redis: '⚡',
}

const TRANSITIONAL = new Set(['pending', 'creating', 'pending-start', 'pending-stop'])

export function UserDatabasesPage() {
  const qc = useQueryClient()
  const [credsFor, setCredsFor] = useState<ManagedDatabase | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  const { data: dbs = [], isLoading, isError } = useQuery<ManagedDatabase[]>({
    queryKey: ['databases'],
    queryFn: () =>  getDatabases(),
    refetchInterval: (query) => {
      const data = query.state.data as ManagedDatabase[] | undefined
      const hasTransitional = data?.some(d => TRANSITIONAL.has(d.status))
      return hasTransitional ? 3_000 : 10_000
    },
  })

  const deleteMut = useMutation({
    mutationFn: deleteDatabase,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['databases'] })
      setConfirmDeleteId(null)
      toast.success('База данных удалена')
    },
    onError: () => toast.error('Ошибка удаления'),
  })
  const startMut = useMutation({
    mutationFn: startDatabase,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['databases'] })
      toast.success('База запускается...')
    },
    onError: () => toast.error('Ошибка запуска'),
  })

  const stopMut = useMutation({
    mutationFn: stopDatabase,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['databases'] })
      toast.success('База останавливается...')
    },
    onError: () => toast.error('Ошибка остановки'),
  })

  const buildCredFields = (db: ManagedDatabase): CredField[] => {
    const fields: CredField[] = []
    if (db.host) fields.push({ label: 'Host', value: db.host })
    if (db.port) fields.push({ label: 'Port', value: String(db.port) })
    if (db.db_name) fields.push({ label: 'Database', value: db.db_name })
    if (db.db_user) fields.push({ label: 'Username', value: db.db_user })
    if (db.db_password) fields.push({ label: 'Password', value: db.db_password, secret: true })
    return fields
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
      <div className={s.pageHeader}>
        <div>
          <h1 className={s.pageTitle}>Databases</h1>
          <p className={s.pageSubtitle}>{dbs.length} database{dbs.length !== 1 ? 's' : ''}</p>
        </div>
      </div>

      {isLoading && (
        <div className={s.stateBox}>
          <div className={s.stateIcon}>🗄️</div>
          <p className={s.stateText}>Loading…</p>
        </div>
      )}
      {isError && (
        <div className={s.stateBox}>
          <p className={s.stateTextErr}>Failed to load databases.</p>
        </div>
      )}
      {!isLoading && !isError && dbs.length === 0 && (
        <div className={s.stateBox}>
          <div className={s.stateIcon} style={{ fontSize: 48, opacity: 0.2 }}>🗄️</div>
          <p className={s.stateText}>Нет баз данных</p>
          <p style={{ fontSize: 13, color: 'var(--text-dim)' }}>Создайте БД в Admin Panel</p>
        </div>
      )}

      {!isLoading && !isError && dbs.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
          {dbs.map(db => {
            const isConfirming = confirmDeleteId === db.id
            const trans = TRANSITIONAL.has(db.status)
            
            return (
              <ResourceCard
                key={db.id}
                icon={ENGINE_ICONS[db.engine] ?? '🗄️'}
                title={db.name}
                subtitle={`${db.engine} ${db.engine_version}`}
                status={db.status}
                details={
                  <>
                    {db.host && db.port && (
                      <span style={{ fontFamily: 'monospace' }}>🌐 {db.host}:{db.port}</span>
                    )}
                    {db.db_name && <span>📋 {db.db_name}</span>}
                  </>
                }
                actions={
                  <>
                    {/* Start/Stop кнопки */}
                    {db.status === 'stopped' && (
                      <button
                        onClick={() => startMut.mutate(db.id)}
                        disabled={trans || startMut.isPending}
                        style={{
                          padding: '6px 14px', borderRadius: 6, border: 'none',
                          background: '#1a3d1a', color: '#4ade80',
                          cursor: 'pointer', fontWeight: 600, fontSize: 12,
                          opacity: trans ? 0.4 : 1
                        }}
                      >
                        {startMut.isPending ? '...' : '▶ Start'}
                      </button>
                    )}
                    {db.status === 'running' && (
                      <button
                        onClick={() => stopMut.mutate(db.id)}
                        disabled={trans || stopMut.isPending}
                        style={{
                          padding: '6px 14px', borderRadius: 6, border: 'none',
                          background: '#3d1a00', color: '#fb923c',
                          cursor: 'pointer', fontWeight: 600, fontSize: 12,
                          opacity: trans ? 0.4 : 1
                        }}
                      >
                        {stopMut.isPending ? '...' : '■ Stop'}
                      </button>
                    )}

                    {db.status === 'running' && (
                      <button
                        onClick={() => setCredsFor(db)}
                        style={{
                          padding: '6px 14px', borderRadius: 6, border: 'none',
                          background: '#0f2a47', color: '#60a5fa',
                          cursor: 'pointer', fontWeight: 600, fontSize: 12,
                        }}
                      >
                        🔑 Credentials
                      </button>
                    )}

                    {isConfirming ? (
                      <>
                        <button
                          onClick={() => deleteMut.mutate(db.id)}
                          disabled={deleteMut.isPending}
                          style={{
                            padding: '6px 14px', borderRadius: 6, border: 'none',
                            background: '#4a0f0f', color: '#f87171',
                            cursor: 'pointer', fontWeight: 600, fontSize: 12,
                          }}
                        >
                          {deleteMut.isPending ? '...' : 'Удалить?'}
                        </button>
                        <button
                          onClick={() => setConfirmDeleteId(null)}
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
                        onClick={() => setConfirmDeleteId(db.id)}
                        disabled={trans}
                        style={{
                          padding: '6px 14px', borderRadius: 6, border: 'none',
                          background: '#3f1212', color: '#f87171',
                          cursor: 'pointer', fontWeight: 600, fontSize: 12,
                          opacity: trans ? 0.4 : 1
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