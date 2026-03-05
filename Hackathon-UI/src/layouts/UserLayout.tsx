// src/layouts/UserLayout.tsx
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Monitor, Database,
  HardDrive, Smartphone, Camera, Settings, LogOut, Cpu
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import styles from './Layout.module.css'

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
  const { theme, toggle } = useTheme()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <div className={styles.shell}>
      {/* ── Сайдбар ───────────────────────────────────────────────── */}
      <aside className={styles.sidebar}>
        <div className={styles.logo}>
          <span className={styles.logoMark}>⬡</span>
          <span className={styles.logoText}>MTS<em>Cloud</em></span>
        </div>

        <nav className={styles.nav}>
          <div className={styles.navSection}>
            <span className={styles.navSectionLabel}>User Console</span>
            {NAV.map(({ to, label, Icon }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `${styles.navItem} ${isActive ? styles.navItemActive : ''}`
                }
              >
                <Icon size={15} />
                <span>{label}</span>
              </NavLink>
            ))}
          </div>
        </nav>

        <div className={styles.sidebarFooter}>
          <span className={styles.version}>v0.1.0-alpha</span>
        </div>
      </aside>

      {/* ── Основная область ────────────────────────────────────────── */}
      <main className={styles.main}>
        <header className={styles.topbar}>
          <div className={styles.topbarLeft}>
            <span style={{ fontSize: 13, color: 'var(--text-sec)' }}>
              Проект: <strong style={{ color: 'var(--text-pri)' }}>default</strong>
            </span>
          </div>
          <div className={styles.topbarRight}>
            {user && (
              <span style={{
                fontSize: 12, color: 'var(--text-dim)',
                maxWidth: 180, overflow: 'hidden',
                textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                👤 {user.email}
              </span>
            )}
            <button
              onClick={handleLogout}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                fontSize: 12, padding: '4px 12px', borderRadius: 6,
                border: '1px solid rgba(198,46,38,0.3)',
                background: 'rgba(198,46,38,0.06)',
                cursor: 'pointer', color: 'var(--red-primary)',
              }}
            >
              <LogOut size={12} />
              <span>Выйти</span>
            </button>
            <button
              className={styles.themeToggle}
              onClick={toggle}
              title={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? '☀' : '☾'}
            </button>
          </div>
        </header>

        <div className={styles.content}>
          <Outlet />
        </div>
      </main>
    </div>
  )
}