import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Monitor, Database,
  HardDrive, Smartphone, Camera, Settings, LogOut, Cpu
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'

const NAV = [
  { to: '/dashboard',  label: 'Dashboard',   Icon: LayoutDashboard },
  { to: '/compute',    label: 'Compute',      Icon: Monitor         },
  { to: '/databases',  label: 'Databases',    Icon: Database        },
  { to: '/storage',    label: 'Storage',      Icon: HardDrive       },
  { to: '/mobile',     label: 'Mobile Farm',  Icon: Smartphone      },
  { to: '/snapshots',  label: 'Snapshots',    Icon: Camera          },
  { to: '/agent',      label: 'AI Агент',     Icon: Cpu             },
  { to: '/settings',   label: 'Settings',     Icon: Settings        },
]

export function UserLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <aside style={{
        width: 220, flexShrink: 0,
        background: 'var(--color-surface, #1e293b)',
        borderRight: '1px solid var(--color-border, #334155)',
        display: 'flex', flexDirection: 'column',
      }}>
        {/* Шапка сайдбара */}
        <div style={{ padding: '18px 16px 14px', borderBottom: '1px solid var(--color-border, #334155)' }}>
          <div style={{ fontWeight: 800, fontSize: 18, letterSpacing: '-0.03em' }}>
            ⬡ IaaS<em>Panel</em>
          </div>
          <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>User Console</div>
        </div>

        {/* Навигация */}
        <nav style={{ flex: 1, padding: '10px 8px', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {NAV.map(({ to, label, Icon }) => (
            <NavLink
              key={to}
              to={to}
              style={({ isActive }) => ({
                display: 'flex', alignItems: 'center', gap: 9,
                padding: '8px 12px', borderRadius: 8,
                textDecoration: 'none', fontSize: 14,
                fontWeight: isActive ? 600 : 400,
                color: isActive ? '#f1f5f9' : '#94a3b8',
                background: isActive ? 'rgba(99,102,241,0.15)' : 'transparent',
              })}
            >
              <Icon size={15} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        {/* Профиль + кнопка выхода */}
        <div style={{ padding: '10px 16px', borderTop: '1px solid var(--color-border, #334155)' }}>
          {/* Email пользователя */}
          <div style={{
            fontSize: 12, color: '#64748b', marginBottom: 8,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {user?.email ?? '—'}
          </div>
          {/* Кнопка выхода */}
          <button
            onClick={handleLogout}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              width: '100%', padding: '7px 12px', borderRadius: 8,
              border: '1px solid rgba(248,113,113,0.2)',
              background: 'rgba(248,113,113,0.06)',
              color: '#f87171', cursor: 'pointer', fontSize: 13,
            }}
          >
            <LogOut size={13} />
            <span>Выйти</span>
          </button>
        </div>
      </aside>

      {/* Основная область */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <header style={{
          height: 50, flexShrink: 0,
          background: 'var(--color-surface, #1e293b)',
          borderBottom: '1px solid var(--color-border, #334155)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 24px',
        }}>
          <span style={{ fontSize: 13, color: '#94a3b8' }}>
            Проект: <strong style={{ color: '#f1f5f9' }}>default</strong>
          </span>
          <span style={{ fontSize: 12, color: '#475569' }}>
            {user?.role === 'admin' ? '🔑 Admin' : '👤 User'}
          </span>
        </header>

        <main style={{ flex: 1, overflow: 'auto', padding: 24 }}>
          <Outlet />
        </main>
      </div>
    </div>
  )
}