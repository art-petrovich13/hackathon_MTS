// src/layouts/UserLayout.tsx
import { Outlet, NavLink } from 'react-router-dom'
import {
  LayoutDashboard, Monitor, Database,
  HardDrive, Smartphone, Camera, Settings,
} from 'lucide-react'

const NAV = [
  { to: '/dashboard',  label: 'Dashboard',   Icon: LayoutDashboard },
  { to: '/compute',    label: 'Compute',     Icon: Monitor         },
  { to: '/databases',  label: 'Databases',   Icon: Database        },
  { to: '/storage',    label: 'Storage',     Icon: HardDrive       },
  { to: '/mobile',     label: 'Mobile Farm', Icon: Smartphone      },
  { to: '/snapshots',  label: 'Snapshots',   Icon: Camera          },
  { to: '/settings',   label: 'Settings',    Icon: Settings        },
]

export function UserLayout() {
  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <aside style={{
        width: 220, flexShrink: 0,
        background: 'var(--color-surface, #1e293b)',
        borderRight: '1px solid var(--color-border, #334155)',
        display: 'flex', flexDirection: 'column',
      }}>
        <div style={{ padding: '18px 16px 14px', borderBottom: '1px solid var(--color-border, #334155)' }}>
          <div style={{ fontWeight: 800, fontSize: 18, letterSpacing: '-0.03em' }}>
            ⬡ IaaS<em>Panel</em>
          </div>
          <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>User Console</div>
        </div>

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

        <div style={{ padding: '10px 16px', borderTop: '1px solid var(--color-border, #334155)', fontSize: 12, color: '#475569' }}>
          v0.2.0-dev
        </div>
      </aside>

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
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <span style={{ fontSize: 13, color: '#64748b' }}>user@example.com</span>
            <button style={{
              fontSize: 12, padding: '4px 12px', borderRadius: 6,
              border: '1px solid #334155', background: 'transparent',
              cursor: 'pointer', color: '#f87171',
            }}>
              Выйти
            </button>
          </div>
        </header>

        <main style={{ flex: 1, overflow: 'auto', padding: 24 }}>
          <Outlet />
        </main>
      </div>
    </div>
  )
}