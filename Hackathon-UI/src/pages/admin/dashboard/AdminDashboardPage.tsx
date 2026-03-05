import { useQuery } from '@tanstack/react-query'
import {
  getVMs, getDatabases, getObjectStorages,
  getFileStorages, getMobileDevices, getUsers, getNodes,
} from '../../../api/api'
import s from '../../shared.module.css'

export function AdminDashboardPage() {
  const { data: vms     = [] } = useQuery({ queryKey: ['vms'],             queryFn: () => getVMs() })
  const { data: dbs     = [] } = useQuery({ queryKey: ['databases'],       queryFn: () => getDatabases() })
  const { data: objects = [] } = useQuery({ queryKey: ['object-storages'], queryFn: () => getObjectStorages() })
  const { data: files   = [] } = useQuery({ queryKey: ['file-storages'],   queryFn: () => getFileStorages() })
  const { data: mobiles = [] } = useQuery({ queryKey: ['mobile-devices'],  queryFn: () => getMobileDevices() })
  const { data: users   = [] } = useQuery({ queryKey: ['users'],           queryFn: () => getUsers() })
  const { data: nodes   = [] } = useQuery({ queryKey: ['nodes'],           queryFn: () => getNodes() })

  const tiles = [
    { icon: '👥', label: 'Users',           value: users.length,   sub: `${users.filter(u => u.role === 'user').length} tenants`,  color: '#8b5cf6' },
    { icon: '🖥️', label: 'Virtual Machines', value: vms.length,    sub: `${vms.filter(v => v.status === 'running').length} running`, color: 'var(--accent)' },
    { icon: '🗄️', label: 'Databases',        value: dbs.length,    sub: `${dbs.filter(d => d.status === 'running').length} running`, color: '#10b981' },
    { icon: '📦', label: 'Object Storages',  value: objects.length, sub: `${objects.filter(o => o.status === 'running').length} running`, color: '#f59e0b' },
    { icon: '💾', label: 'File Storages',    value: files.length,  sub: `${files.filter(f => f.status === 'running').length} running`,  color: '#06b6d4' },
    { icon: '📱', label: 'Mobile Devices',   value: mobiles.length, sub: `${mobiles.filter(m => m.status === 'running').length} running`, color: '#ec4899' },
    { icon: '🔧', label: 'Compute Nodes',   value: nodes.length,  sub: `${nodes.filter(n => n.status === 'active').length} active`,   color: '#64748b' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
      <div>
        <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700, color: 'var(--text-pri)' }}>
          Admin Dashboard
        </h1>
        <p style={{ margin: '6px 0 0', color: 'var(--text-sec)', fontSize: 13 }}>
          Общий обзор всей инфраструктуры
        </p>
      </div>

      {/* Тайлы со счётчиками */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 14 }}>
        {tiles.map(({ icon, label, value, sub, color }) => (
          <div key={label} style={{
            padding: '20px 18px', borderRadius: 14,
            background: 'var(--bg-raised, #1e293b)',
            border: '1px solid var(--border, #334155)',
          }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>{icon}</div>
            <div style={{ fontSize: 32, fontWeight: 800, color, lineHeight: 1 }}>{value}</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-pri)', marginTop: 4 }}>{label}</div>
            <div style={{ fontSize: 11, color: 'var(--text-sec)', marginTop: 2 }}>{sub}</div>
          </div>
        ))}
      </div>

      {/* Таблица tenants */}
      <div>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-pri)', margin: '0 0 14px' }}>
          Tenants
        </h2>
        <div className={s.tableWrap}>
          <table className={s.table}>
            <thead>
              <tr>
                <th>Email</th>
                <th>Role</th>
                <th>VMs</th>
                <th>DBs</th>
                <th>Storage</th>
                <th>Mobile</th>
                <th>Project ID</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => {
                const pid = u.project?.id
                const userVMs     = pid ? vms.filter(v => v.project_id === pid).length : 0
                const userDBs     = pid ? dbs.filter(d => d.project_id === pid).length : 0
                const userStorage = pid
                  ? objects.filter(o => o.project_id === pid).length
                    + files.filter(f => f.project_id === pid).length
                  : 0
                const userMobile  = pid ? mobiles.filter(m => m.project_id === pid).length : 0

                return (
                  <tr key={u.id}>
                    <td className={s.cellBold}>{u.email}</td>
                    <td>
                      <span style={{
                        padding: '2px 8px', borderRadius: 20,
                        fontSize: 11, fontWeight: 700,
                        background: u.role === 'admin'
                          ? 'rgba(139,92,246,0.15)'
                          : 'rgba(99,102,241,0.1)',
                        color: u.role === 'admin' ? '#a78bfa' : '#818cf8',
                      }}>
                        {u.role}
                      </span>
                    </td>
                    <td className={s.cellDim}>{userVMs}</td>
                    <td className={s.cellDim}>{userDBs}</td>
                    <td className={s.cellDim}>{userStorage}</td>
                    <td className={s.cellDim}>{userMobile}</td>
                    <td className={s.cellMono} style={{ fontSize: 11 }}>
                      {pid ? `${pid.slice(0, 8)}...` : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}