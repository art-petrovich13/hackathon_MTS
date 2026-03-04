// Пример: src/pages/admin/databases/AdminDatabasesPage.tsx
import { useQuery } from '@tanstack/react-query'


import { getVMs, getDatabases, getObjectStorages, getFileStorages, getMobileDevices } from '../../../api/api'
import type { VirtualMachine, ManagedDatabase, ObjectStorage, FileStorage, MobileDevice } from '../../../types/api'

export function UserDashboardPage() {
  const { data: vms = [] } = useQuery<VirtualMachine[]>({ queryKey: ['vms'], queryFn: getVMs })
  const { data: dbs = [] } = useQuery<ManagedDatabase[]>({ queryKey: ['databases'], queryFn: getDatabases })

  const runningVMs = vms.filter(v => v.status === 'running').length
  const runningDBs = dbs.filter(d => d.status === 'running').length

  const { data: objects = [] } = useQuery<ObjectStorage[]>({ queryKey: ['object-storages'], queryFn: getObjectStorages })
  const { data: fileStorages = [] } = useQuery<FileStorage[]>({ queryKey: ['file-storages'], queryFn: getFileStorages })
  const { data: mobiles = [] } = useQuery<MobileDevice[]>({
    queryKey: ['mobile-devices'],
    queryFn: getMobileDevices,
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>

      {/* ── Заголовок ──────────────────────────────────────────────────── */}
      <div>
        <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700, fontFamily: 'Syne, sans-serif', color: 'var(--text-pri)' }}>
          Dashboard
        </h1>
        <p style={{ margin: '6px 0 0', color: 'var(--text-sec)', fontSize: 13, fontFamily: 'JetBrains Mono, monospace' }}>
          Обзор ваших ресурсов
        </p>
      </div>

      {/* ── Тайлы счётчиков ────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 14 }}>
        <StatTile icon="🖥️" label="Virtual Machines" value={vms.length} sub={`${runningVMs} running`} color="var(--accent)" />
        <StatTile icon="🗄️" label="Databases" value={dbs.length} sub={`${runningDBs} running`} color="#10b981" />
        <StatTile
          icon="📦"
          label="Object Storages"
          value={objects.length}
          sub={`${objects.filter(o => o.status === 'running').length} running`}
          color="#f59e0b"
        />
        <StatTile
          icon="💾"
          label="File Storages"
          value={fileStorages.length}
          sub={`${fileStorages.filter(f => f.status === 'running').length} running`}
          color="#06b6d4"
        />
        <StatTile
          icon="📱"
          label="Mobile Devices"
          value={mobiles.length}
          sub={`${mobiles.filter(m => m.status === 'running').length} running`}
          color="#8b5cf6"
        />
      </div>

      {/* ── Последние VM ───────────────────────────────────────────────── */}
      {vms.length > 0 && (
        <section>
          <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12, color: 'var(--text-pri)' }}>
            Последние VM
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {vms.slice(0, 5).map(vm => (
              <div key={vm.id} style={{
                padding: '12px 16px', borderRadius: 10,
                background: 'var(--bg-surface)',
                border: '1px solid var(--border)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 20 }}>🖥️</span>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-pri)' }}>{vm.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-dim)', fontFamily: 'monospace' }}>
                      {vm.ip_address ?? 'No IP'}
                    </div>
                  </div>
                </div>
                <StatusDot status={vm.status} />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Последние БД ───────────────────────────────────────────────── */}
      {dbs.length > 0 && (
        <section>
          <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12, color: 'var(--text-pri)' }}>
            Последние Databases
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {dbs.slice(0, 3).map(db => (
              <div key={db.id} style={{
                padding: '12px 16px', borderRadius: 10,
                background: 'var(--bg-surface)',
                border: '1px solid var(--border)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 20 }}>
                    {{ postgres: '🐘', mysql: '🐬', redis: '⚡' }[db.engine] ?? '🗄️'}
                  </span>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-pri)' }}>{db.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-dim)', fontFamily: 'monospace' }}>
                      {db.engine} · {db.db_name ?? '—'}
                    </div>
                  </div>
                </div>
                <StatusDot status={db.status} />
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

function StatTile({
  icon, label, value, sub, color,
}: {
  icon: string; label: string; value: number; sub: string; color: string
}) {
  return (
    <div style={{
      padding: 20, borderRadius: 12,
      background: 'var(--bg-surface)',
      border: '1px solid var(--border)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <span style={{ fontSize: 22 }}>{icon}</span>
        <span style={{ fontSize: 12, color: 'var(--text-sec)', fontFamily: 'JetBrains Mono, monospace' }}>
          {label}
        </span>
      </div>
      <div style={{ fontSize: 38, fontWeight: 700, color, lineHeight: 1, fontFamily: 'Syne, sans-serif' }}>
        {value}
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 6 }}>{sub}</div>
    </div>
  )
}

// Маленький цветной кружок со статусом
function StatusDot({ status }: { status: string }) {
  const color =
    status === 'running' ? 'var(--green)' :
      status === 'error' ? 'var(--red)' :
        'var(--yellow)'

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color }}>
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
      {status}
    </span>
  )
}