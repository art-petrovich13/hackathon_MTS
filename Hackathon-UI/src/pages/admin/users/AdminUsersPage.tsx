import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  getUsers, createUser, deleteUser, setUserLimits,
  getVMs, getDatabases, getObjectStorages, getFileStorages, getMobileDevices,
} from '../../../api/api'
import type { UserWithProject, ProjectLimit } from '../../../types/api'
import shared from '../../shared.module.css'
import m from './userstable.module.css'

export function AdminUsersPage() {
  const qc = useQueryClient()
  const [showCreate, setShowCreate]           = useState(false)
  const [limitsFor, setLimitsFor]             = useState<UserWithProject | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  const { data: users = [], isLoading, isError } = useQuery({
    queryKey: ['users'], queryFn: getUsers, refetchInterval: 30_000,
  })
  const { data: vms     = [] } = useQuery({ queryKey: ['vms'],            queryFn: () => getVMs(),            staleTime: 30_000 })
  const { data: dbs     = [] } = useQuery({ queryKey: ['databases'],      queryFn: () => getDatabases(),      staleTime: 30_000 })
  const { data: objects = [] } = useQuery({ queryKey: ['object-storages'],queryFn: () => getObjectStorages(), staleTime: 30_000 })
  const { data: files   = [] } = useQuery({ queryKey: ['file-storages'],  queryFn: () => getFileStorages(),   staleTime: 30_000 })
  const { data: mobiles = [] } = useQuery({ queryKey: ['mobile-devices'], queryFn: () => getMobileDevices(),  staleTime: 30_000 })

  const deleteMut = useMutation({
    mutationFn: deleteUser,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); setConfirmDeleteId(null); toast.success('Пользователь удалён') },
    onError: () => toast.error('Ошибка удаления'),
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
      <div className={shared.pageHeader}>
        <div>
          <h1 className={shared.pageTitle}>Users</h1>
          <p className={shared.pageSubtitle}>{users.length} пользователей</p>
        </div>
        <button className="btn-primary" onClick={() => setShowCreate(true)}>+ New User</button>
      </div>

      {isLoading && (
        <div className={shared.stateBox}>
          <div className={shared.stateIcon}>👥</div>
          <p className={shared.stateText}>Loading users...</p>
        </div>
      )}
      {isError && (
        <div className={shared.stateBox}>
          <p className={shared.stateTextErr}>Failed to load users. Проверь эндпоинт /users.</p>
        </div>
      )}
      {!isLoading && !isError && users.length === 0 && (
        <div className={shared.stateBox}>
          <div className={shared.stateIcon}>👥</div>
          <p className={shared.stateText}>Нет пользователей</p>
          <button className="btn-primary" style={{ marginTop: 12 }} onClick={() => setShowCreate(true)}>
            + Создать первого
          </button>
        </div>
      )}

      {!isLoading && !isError && users.length > 0 && (
        <div className={shared.tableWrap}>
          <table className={shared.table}>
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
                const pid          = u.project?.id
                const userVMs      = pid ? vms.filter(v => v.project_id === pid).length : 0
                const userDBs      = pid ? dbs.filter(d => d.project_id === pid).length : 0
                const userStorage  = pid ? objects.filter(o => o.project_id === pid).length + files.filter(f => f.project_id === pid).length : 0
                const userMobile   = pid ? mobiles.filter(m => m.project_id === pid).length : 0

                return (
                  <tr key={u.id}>
                    <td className={shared.cellBold}>{u.email}</td>
                    <td>
                      <div className={m.servicesCell}>
                        <span className={m.serviceCount} title="VMs">🖥 {userVMs}</span>
                        <span className={m.serviceCount} title="DBs">🗄 {userDBs}</span>
                        <span className={m.serviceCount} title="Storage">📦 {userStorage}</span>
                        <span className={m.serviceCount} title="Mobile">📱 {userMobile}</span>
                      </div>
                    </td>
                    <td>
                      <span className={u.role === 'admin' ? m.roleAdmin : m.roleUser}>
                        {u.role === 'admin' ? '🔑 admin' : '👤 user'}
                      </span>
                    </td>
                    <td className={shared.cellMono} style={{ fontSize: 11 }}>
                      {u.project?.id ? `${u.project.id.slice(0, 8)}...` : '—'}
                    </td>
                    <td className={shared.cellDim}>
                      {u.limits
                        ? `${u.limits.max_vms} VM · ${u.limits.max_cpu} CPU · ${Math.round(u.limits.max_ram_mb / 1024)} GB`
                        : '—'}
                    </td>
                    <td className={shared.cellDim}>
                      {new Date(u.created_at).toLocaleDateString('ru-RU')}
                    </td>
                    <td>
                      <div className={m.actionsCell}>
                        <button className={`${m.actionBtn} ${m.actionBtnLimits}`}
                          onClick={() => setLimitsFor(u)}>⚙ Limits</button>
                        {isConfirming ? (
                          <>
                            <button className={`${m.actionBtn} ${m.actionBtnConfirm}`}
                              disabled={deleteMut.isPending} onClick={() => deleteMut.mutate(u.id)}>
                              {deleteMut.isPending ? '...' : 'Да'}
                            </button>
                            <button className={`${m.actionBtn} ${m.actionBtnCancel}`}
                              onClick={() => setConfirmDeleteId(null)}>Нет</button>
                          </>
                        ) : (
                          <button className={`${m.actionBtn} ${m.actionBtnDelete}`}
                            onClick={() => setConfirmDeleteId(u.id)}>✕</button>
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
          onCreated={() => { setShowCreate(false); qc.invalidateQueries({ queryKey: ['users'] }) }}
        />
      )}
      {limitsFor && (
        <LimitsModal
          user={limitsFor}
          onClose={() => setLimitsFor(null)}
          onSaved={() => { setLimitsFor(null); qc.invalidateQueries({ queryKey: ['users'] }) }}
        />
      )}
    </div>
  )
}

// ── Модал создания пользователя ───────────────────────────────────────────────

function CreateUserModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole]         = useState<'user' | 'admin'>('user')
  const [error, setError]       = useState('')

  const mut = useMutation({
    mutationFn: () => createUser(email.trim(), password, role),
    onSuccess: () => { toast.success('Пользователь создан'); onCreated() },
    onError: () => setError('Ошибка при создании пользователя'),
  })

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h2 style={{ margin: '0 0 20px', fontSize: 18, fontWeight: 700, color: 'var(--text-pri)' }}>
          👤 Create User
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <input className="input" value={email} onChange={e => setEmail(e.target.value)}
            placeholder="email@example.com" type="email" autoFocus />
          <input className="input" value={password} onChange={e => setPassword(e.target.value)}
            placeholder="Пароль (мин. 6 символов)" type="password" />

          <div className={m.roleGrid}>
            {(['user', 'admin'] as const).map(r => (
              <button key={r} type="button"
                className={`${m.roleBtn} ${role === r ? m.roleBtnActive : ''}`}
                onClick={() => setRole(r)}>
                {r === 'admin' ? '🔑 Admin' : '👤 User'}
              </button>
            ))}
          </div>

          {error && <div className="form-error">⚠ {error}</div>}

          <div className={m.formFooter} style={{ marginTop: 4 }}>
            <button className="btn-secondary" onClick={onClose}>Отмена</button>
            <button className="btn-primary"
              onClick={() => mut.mutate()}
              disabled={mut.isPending || !email.trim() || !password}>
              {mut.isPending ? '...' : 'Создать'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Модал лимитов ─────────────────────────────────────────────────────────────

function LimitsModal({ user, onClose, onSaved }: { user: UserWithProject; onClose: () => void; onSaved: () => void }) {
  const [limits, setLimits] = useState<Partial<ProjectLimit>>(
    user.limits ?? { max_vms: 5, max_cpu: 8, max_ram_mb: 8192, max_disk_gb: 100, max_dbs: 3, max_storages: 3, max_mobile: 2 }
  )

  const mut = useMutation({
    mutationFn: () => setUserLimits(user.id, limits),
    onSuccess: () => { toast.success('Лимиты обновлены'); onSaved() },
    onError: () => toast.error('Ошибка сохранения'),
  })

  const field = (key: keyof ProjectLimit, label: string) => (
    <div key={key}>
      <label className="label">{label}</label>
      <input className="input" type="number" min={0}
        value={(limits as Record<string, number>)[key] ?? 0}
        onChange={e => setLimits(prev => ({ ...prev, [key]: Number(e.target.value) }))} />
    </div>
  )

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h2 style={{ margin: '0 0 6px', fontSize: 18, fontWeight: 700, color: 'var(--text-pri)' }}>
          ⚙ Лимиты ресурсов
        </h2>
        <p className={m.modalSubtitle}>{user.email}</p>
        <div className={m.limitsGrid}>
          {field('max_vms',     'Max VMs')}
          {field('max_cpu',     'Max vCPU')}
          {field('max_ram_mb',  'Max RAM (MB)')}
          {field('max_disk_gb', 'Max Disk (GB)')}
          {field('max_dbs',     'Max Databases')}
          {field('max_storages','Max Storages')}
          {field('max_mobile',  'Max Mobile')}
        </div>
        <div className={m.formFooter}>
          <button className="btn-secondary" onClick={onClose}>Отмена</button>
          <button className="btn-primary" onClick={() => mut.mutate()} disabled={mut.isPending}>
            {mut.isPending ? '...' : 'Сохранить'}
          </button>
        </div>
      </div>
    </div>
  )
}