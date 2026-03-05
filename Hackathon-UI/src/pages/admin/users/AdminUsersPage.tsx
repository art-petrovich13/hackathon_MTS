import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { getUsers, createUser, deleteUser, setUserLimits } from '../../../api/api'
import type { UserWithProject, ProjectLimit } from '../../../types/api'
import s from '../../shared.module.css'
import {
  getVMs, getDatabases, getObjectStorages, getFileStorages, getMobileDevices
} from '../../../api/api'
import type {
  VirtualMachine, ManagedDatabase, ObjectStorage, FileStorage, MobileDevice
} from '../../../types/api'

export function AdminUsersPage() {
  const qc = useQueryClient()
  const [showCreate, setShowCreate] = useState(false)
  const [limitsFor, setLimitsFor] = useState<UserWithProject | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  const { data: users = [], isLoading, isError } = useQuery({
    queryKey: ['users'],
    queryFn: getUsers,
    refetchInterval: 30_000,
  })

  const { data: vms = [] } = useQuery({ queryKey: ['vms'], queryFn: () => getVMs(), staleTime: 30_000 })
  const { data: dbs = [] } = useQuery({ queryKey: ['databases'], queryFn: () => getDatabases(), staleTime: 30_000 })
  const { data: objects = [] } = useQuery({ queryKey: ['object-storages'], queryFn: () => getObjectStorages(), staleTime: 30_000 })
  const { data: files = [] } = useQuery({ queryKey: ['file-storages'], queryFn: () => getFileStorages(), staleTime: 30_000 })
  const { data: mobiles = [] } = useQuery({ queryKey: ['mobile-devices'], queryFn: () => getMobileDevices(), staleTime: 30_000 })

  const deleteMut = useMutation({
    mutationFn: deleteUser,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] })
      setConfirmDeleteId(null)
      toast.success('Пользователь удалён')
    },
    onError: () => toast.error('Ошибка удаления'),
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
      <div className={s.pageHeader}>
        <div>
          <h1 className={s.pageTitle}>Users</h1>
          <p className={s.pageSubtitle}>{users.length} пользователей</p>
        </div>
        <button className={s.btnPrimary} onClick={() => setShowCreate(true)}>
          + New User
        </button>
      </div>

      {isLoading && (
        <div className={s.stateBox}>
          <div className={s.stateIcon}>👥</div>
          <p className={s.stateText}>Loading users...</p>
        </div>
      )}
      {isError && (
        <div className={s.stateBox}>
          <p className={s.stateTextErr}>Failed to load users. Проверь эндпоинт /users.</p>
        </div>
      )}

      {!isLoading && !isError && users.length === 0 && (
        <div className={s.stateBox}>
          <div className={s.stateIcon} style={{ fontSize: 48, opacity: 0.2 }}>👥</div>
          <p className={s.stateText}>Нет пользователей</p>
          <button className={s.btnPrimary} style={{ marginTop: 12 }} onClick={() => setShowCreate(true)}>
            + Создать первого
          </button>
        </div>
      )}

      {!isLoading && !isError && users.length > 0 && (
        <div className={s.tableWrap}>
          <table className={s.table}>
            <thead>
              <tr>
                <th>Email</th>
                <th>Сервисы</th>
                <th>Role</th>
                <th>Project ID</th>
                <th>Лимиты (VM / CPU / RAM)</th>
                <th>Зарегистрирован</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => {
                const isConfirming = confirmDeleteId === u.id
                const pid = u.project?.id
                const userVMs = pid ? vms.filter(v => v.project_id === pid).length : 0
                const userDBs = pid ? dbs.filter(d => d.project_id === pid).length : 0
                const userStorage = pid
                  ? objects.filter(o => o.project_id === pid).length + files.filter(f => f.project_id === pid).length
                  : 0
                const userMobile = pid ? mobiles.filter(m => m.project_id === pid).length : 0

                return (
                  <tr key={u.id}>
                    <td className={s.cellBold}>{u.email}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 8, fontSize: 12 }}>
                        <span title="VMs" style={{ color: '#94a3b8' }}>🖥 {userVMs}</span>
                        <span title="DBs" style={{ color: '#94a3b8' }}>🗄 {userDBs}</span>
                        <span title="Storage" style={{ color: '#94a3b8' }}>📦 {userStorage}</span>
                        <span title="Mobile" style={{ color: '#94a3b8' }}>📱 {userMobile}</span>
                      </div>
                    </td>
                    <td>
                      <span style={{
                        padding: '3px 10px', borderRadius: 20,
                        fontSize: 11, fontWeight: 700,
                        background: u.role === 'admin'
                          ? 'rgba(139,92,246,0.15)'
                          : 'rgba(99,102,241,0.1)',
                        color: u.role === 'admin' ? '#a78bfa' : '#818cf8',
                        border: `1px solid ${u.role === 'admin'
                          ? 'rgba(139,92,246,0.3)'
                          : 'rgba(99,102,241,0.2)'}`,
                      }}>
                        {u.role === 'admin' ? '🔑 admin' : '👤 user'}
                      </span>
                    </td>
                    <td className={s.cellMono} style={{ fontSize: 11 }}>
                      {u.project?.id ? `${u.project.id.slice(0, 8)}...` : '—'}
                    </td>
                    <td className={s.cellDim}>
                      {u.limits
                        ? `${u.limits.max_vms} VM · ${u.limits.max_cpu} CPU · ${Math.round(u.limits.max_ram_mb / 1024)} GB`
                        : '—'}
                    </td>
                    <td className={s.cellDim}>
                      {new Date(u.created_at).toLocaleDateString('ru-RU')}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <button
                          onClick={() => setLimitsFor(u)}
                          style={btnSt('#0f2a47', '#60a5fa')}
                        >
                          ⚙ Limits
                        </button>
                        {isConfirming ? (
                          <>
                            <button
                              onClick={() => deleteMut.mutate(u.id)}
                              disabled={deleteMut.isPending}
                              style={btnSt('#4a0f0f', '#f87171')}
                            >
                              {deleteMut.isPending ? '...' : 'Да'}
                            </button>
                            <button
                              onClick={() => setConfirmDeleteId(null)}
                              style={btnSt('transparent', '#94a3b8')}
                            >
                              Нет
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => setConfirmDeleteId(u.id)}
                            style={btnSt('#2a1515', '#f87171')}
                          >
                            ✕
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
        <CreateUserModal
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false)
            qc.invalidateQueries({ queryKey: ['users'] })
          }}
        />
      )}

      {limitsFor && (
        <LimitsModal
          user={limitsFor}
          onClose={() => setLimitsFor(null)}
          onSaved={() => {
            setLimitsFor(null)
            qc.invalidateQueries({ queryKey: ['users'] })
          }}
        />
      )}
    </div>
  )
}

function btnSt(bg: string, color: string) {
  return {
    padding: '4px 12px', borderRadius: 6, border: 'none',
    background: bg, color, cursor: 'pointer', fontSize: 12, fontWeight: 600,
  } as const
}

// ── Модал создания пользователя ───────────────────────────────────────────────

function CreateUserModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<'user' | 'admin'>('user')
  const [error, setError] = useState('')


  const mut = useMutation({
    mutationFn: () => createUser(email.trim(), password, role),
    onSuccess: () => {
      toast.success('Пользователь создан')
      onCreated()
    },
    onError: () => setError('Ошибка при создании пользователя'),
  })

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 200,
      background: 'rgba(0,0,0,0.65)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: 'var(--bg-surface)', border: '1px solid var(--border)',
        borderRadius: 16, padding: 28, width: 420, maxWidth: '95vw',
      }}>
        <h2 style={{ margin: '0 0 20px', fontSize: 18, fontWeight: 700, color: 'var(--text-pri)' }}>
          👤 Create User
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <input
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="email@example.com"
            type="email"
            autoFocus
            style={inputSt}
          />
          <input
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Пароль (мин. 6 символов)"
            type="password"
            style={inputSt}
          />
          {/* Выбор роли */}
          <div style={{ display: 'flex', gap: 10 }}>
            {(['user', 'admin'] as const).map(r => (
              <button key={r} type="button" onClick={() => setRole(r)} style={{
                flex: 1, padding: '10px', borderRadius: 8, cursor: 'pointer',
                border: `2px solid ${role === r ? 'var(--accent)' : 'var(--border)'}`,
                background: role === r ? 'var(--accent-dim, rgba(0,229,255,0.06))' : 'transparent',
                color: 'var(--text-pri)', fontWeight: 600,
              }}>
                {r === 'admin' ? '🔑 Admin' : '👤 User'}
              </button>
            ))}
          </div>
          {error && <p style={{ color: '#f87171', fontSize: 13, margin: 0 }}>⚠ {error}</p>}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button onClick={onClose} style={{
              padding: '10px 20px', borderRadius: 8,
              border: '1px solid var(--border)', background: 'transparent',
              cursor: 'pointer', color: 'var(--text-pri)', fontWeight: 600,
            }}>Отмена</button>
            <button
              onClick={() => mut.mutate()}
              disabled={mut.isPending || !email.trim() || !password}
              style={{
                padding: '10px 20px', borderRadius: 8,
                background: 'var(--accent)', border: 'none', color: '#0d0f14',
                cursor: mut.isPending ? 'not-allowed' : 'pointer',
                fontWeight: 700, opacity: mut.isPending ? 0.6 : 1,
              }}
            >
              {mut.isPending ? '...' : 'Создать'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Модал лимитов ─────────────────────────────────────────────────────────────

function LimitsModal({
  user, onClose, onSaved,
}: {
  user: UserWithProject
  onClose: () => void
  onSaved: () => void
}) {
  const [limits, setLimits] = useState<Partial<ProjectLimit>>(
    user.limits ?? {
      max_vms: 5, max_cpu: 8, max_ram_mb: 8192, max_disk_gb: 100,
      max_dbs: 3, max_storages: 3, max_mobile: 2,
    }
  )

  const mut = useMutation({
    mutationFn: () => setUserLimits(user.id, limits),
    onSuccess: () => { toast.success('Лимиты обновлены'); onSaved() },
    onError: () => toast.error('Ошибка сохранения'),
  })

  const field = (key: keyof ProjectLimit, label: string) => (
    <div>
      <label style={{
        display: 'block', fontSize: 11, color: '#64748b',
        marginBottom: 4, fontWeight: 600,
      }}>
        {label}
      </label>
      <input
        type="number" min={0}
        value={(limits as Record<string, number>)[key] ?? 0}
        onChange={e => setLimits(prev => ({ ...prev, [key]: Number(e.target.value) }))}
        style={{ ...inputSt, width: '100%' }}
      />
    </div>
  )

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 200,
      background: 'rgba(0,0,0,0.65)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: 'var(--bg-surface)', border: '1px solid var(--border)',
        borderRadius: 16, padding: 28, width: 440, maxWidth: '95vw',
      }}>
        <h2 style={{ margin: '0 0 6px', fontSize: 18, fontWeight: 700, color: 'var(--text-pri)' }}>
          ⚙ Лимиты ресурсов
        </h2>
        <p style={{ margin: '0 0 20px', fontSize: 13, color: 'var(--text-sec)' }}>
          {user.email}
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {field('max_vms', 'Max VMs')}
          {field('max_cpu', 'Max vCPU')}
          {field('max_ram_mb', 'Max RAM (MB)')}
          {field('max_disk_gb', 'Max Disk (GB)')}
          {field('max_dbs', 'Max Databases')}
          {field('max_storages', 'Max Storages')}
          {field('max_mobile', 'Max Mobile')}
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
          <button onClick={onClose} style={{
            padding: '10px 20px', borderRadius: 8,
            border: '1px solid var(--border)', background: 'transparent',
            cursor: 'pointer', color: 'var(--text-pri)', fontWeight: 600,
          }}>Отмена</button>
          <button
            onClick={() => mut.mutate()}
            disabled={mut.isPending}
            style={{
              padding: '10px 20px', borderRadius: 8,
              background: 'var(--accent)', border: 'none', color: '#0d0f14',
              cursor: mut.isPending ? 'not-allowed' : 'pointer',
              fontWeight: 700, opacity: mut.isPending ? 0.6 : 1,
            }}
          >
            {mut.isPending ? '...' : 'Сохранить'}
          </button>
        </div>
      </div>
    </div>
  )
}

const inputSt: React.CSSProperties = {
  width: '100%', padding: '10px 14px', borderRadius: 8,
  border: '1px solid var(--border)', background: 'var(--bg-raised)',
  color: 'var(--text-pri)', fontSize: 14, outline: 'none',
  boxSizing: 'border-box',
}