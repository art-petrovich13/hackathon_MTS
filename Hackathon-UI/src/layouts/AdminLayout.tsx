import { Outlet, NavLink } from 'react-router-dom'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTheme } from '../context/ThemeContext'
import { useAuth } from '../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import { getHealth } from '../api/api'
import styles from './Layout.module.css'
import './Layout.mobile.css'
import {
  Monitor, Server, Database, HardDrive, Smartphone,
  Users, LayoutGrid, BarChart2, TrendingUp, Camera, Image, LayoutDashboard,
} from 'lucide-react'

const NAV_SECTIONS = [
  {
    label: 'Overview',
    items: [{ to: '/admin/dashboard', label: 'Dashboard', Icon: LayoutDashboard }],
  },
  {
    label: 'Compute',
    items: [
      { to: '/admin/vms',   label: 'Virtual Machines', Icon: Monitor },
      { to: '/admin/nodes', label: 'Nodes',            Icon: Server  },
    ],
  },
  {
    label: 'Databases',
    items: [{ to: '/admin/databases', label: 'Databases', Icon: Database }],
  },
  {
    label: 'Storage',
    items: [
      { to: '/admin/storage/object', label: 'Object Storage', Icon: HardDrive },
      { to: '/admin/storage/file',   label: 'File Storage',   Icon: HardDrive },
    ],
  },
  {
    label: 'Devices',
    items: [{ to: '/admin/mobile', label: 'Mobile Farm', Icon: Smartphone }],
  },
  {
    label: 'System',
    items: [
      { to: '/admin/users',           label: 'Users',           Icon: Users       },
      { to: '/admin/catalog',         label: 'Service Catalog', Icon: LayoutGrid  },
      { to: '/admin/metrics',         label: 'Metrics',         Icon: BarChart2   },
      { to: '/admin/recommendations', label: 'Recommendations', Icon: TrendingUp  },
      { to: '/admin/snapshots',       label: 'Snapshots',       Icon: Camera      },
      { to: '/admin/images',          label: 'Images',          Icon: Image       },
    ],
  },
]

export function AdminLayout() {
  const { theme, toggle } = useTheme()
  const { user, logout }  = useAuth()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const handleLogout = () => { logout(); navigate('/login') }

  return (
    <div className={styles.shell}>
      {/* Мобильный overlay */}
      {sidebarOpen && (
        <div className="mobile-overlay" onClick={() => setSidebarOpen(false)} />
      )}

      <aside className={`${styles.sidebar} ${sidebarOpen ? 'sidebar-open' : ''}`}>
        <div className={styles.logo}>
          <span className={styles.logoMark}>⬡</span>
          <span className={styles.logoText}>MTS<em>Cloud</em></span>
        </div>

        <nav className={styles.nav}>
          {NAV_SECTIONS.map(section => (
            <div key={section.label} className={styles.navSection}>
              <span className={styles.navSectionLabel}>{section.label}</span>
              {section.items.map(({ to, label, Icon }) => (
                <NavLink key={to} to={to}
                  className={({ isActive }) => `${styles.navItem} ${isActive ? styles.navItemActive : ''}`}
                >
                  <Icon size={15} />
                  <span>{label}</span>
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <div className={styles.sidebarFooter}>
          <span className={styles.version}>v0.1.0-alpha</span>
        </div>
      </aside>

      <main className={styles.main}>
        <header className={styles.topbar}>
          <div className={styles.topbarLeft}>
            <button
              className="hamburger-btn"
              onClick={() => setSidebarOpen(o => !o)}
              aria-label="Toggle sidebar"
            >
              <span /><span /><span />
            </button>
          </div>
          <div className={styles.topbarRight}>
            <HealthBadge />
            {user && (
              <span className={styles.userEmail}>👤 {user.email}</span>
            )}
            <button className={styles.logoutBtn} onClick={handleLogout}>
              Выйти
            </button>
            <button className={styles.themeToggle} onClick={toggle}
              title={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
              aria-label="Toggle theme">
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