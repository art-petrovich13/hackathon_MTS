// src/layouts/AdminLayout.tsx
import { Outlet, NavLink } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useTheme } from '../context/ThemeContext'
import { getHealth } from '../api/api'
import styles from './AdminLayout.module.css'

const NAV_ITEMS = [
  { to: '/vms',     label: 'Virtual Machines', icon: '▣' },
  { to: '/nodes',   label: 'Compute Nodes',    icon: '◈' },
  { to: '/images',  label: 'Images',           icon: '◉' },
  { to: '/flavors', label: 'Flavors',          icon: '◆' },
]

export function AdminLayout() {
  const { theme, toggle } = useTheme()

  return (
    <div className={styles.shell}>
      {/* ── Сайдбар ───────────────────────────────────────────────── */}
      <aside className={styles.sidebar}>
        <div className={styles.logo}>
          <span className={styles.logoMark}>⬡</span>
          <span className={styles.logoText}>IaaS<em>Panel</em></span>
        </div>

        <nav className={styles.nav}>
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `${styles.navItem} ${isActive ? styles.navItemActive : ''}`
              }
            >
              <span className={styles.navIcon}>{item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className={styles.sidebarFooter}>
          <span className={styles.version}>v0.1.0-alpha</span>
        </div>
      </aside>

      {/* ── Основная область ────────────────────────────────────────── */}
      <main className={styles.main}>
        <header className={styles.topbar}>
          <div className={styles.topbarLeft} />
          <div className={styles.topbarRight}>
            <HealthBadge />

            {/* ── Кнопка переключения темы ─────────────────────────── */}
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

// ── Health badge ──────────────────────────────────────────────────────────────
function HealthBadge() {
  const { data, isError } = useQuery({
    queryKey: ['health'],
    queryFn: getHealth,
    refetchInterval: 30_000,
    retry: false,
  })

  const ok = !isError && data?.status === 'ok'

  return (
    <div className={styles.healthBadge} title={ok ? 'Backend OK' : 'Backend unavailable'}>
      <span className={`${styles.healthDot} ${ok ? styles.healthOk : styles.healthErr}`} />
      <span>{ok ? 'Online' : 'Offline'}</span>
    </div>
  )
}