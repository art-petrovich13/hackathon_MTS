import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import {
  LayoutDashboard, Monitor, Database,
  HardDrive, Smartphone, Camera, Settings, LogOut, Cpu,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import styles from './Layout.module.css'
import './Layout.mobile.css'

const NAV = [
  { to: '/dashboard', label: 'Dashboard',  Icon: LayoutDashboard },
  { to: '/agent',     label: 'Cloud Agent',Icon: Cpu             },
  { to: '/compute',   label: 'Compute',    Icon: Monitor         },
  { to: '/databases', label: 'Databases',  Icon: Database        },
  { to: '/storage',   label: 'Storage',    Icon: HardDrive       },
  { to: '/mobile',    label: 'Mobile Farm',Icon: Smartphone      },
]

export function UserLayout() {
  const { user, logout } = useAuth()
  const { theme, toggle } = useTheme()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const handleLogout = () => { logout(); navigate('/login') }

  return (
    <div className={styles.shell}>
      {sidebarOpen && (
        <div className="mobile-overlay" onClick={() => setSidebarOpen(false)} />
      )}

      <aside className={`${styles.sidebar} ${sidebarOpen ? 'sidebar-open' : ''}`}>
        <div className={styles.logo}>
          <span className={styles.logoMark}>⬡</span>
          <span className={styles.logoText}>IaaS<em>Cloud</em></span>
        </div>

        <nav className={styles.nav}>
          <div className={styles.navSection}>
            <span className={styles.navSectionLabel}>User Console</span>
            {NAV.map(({ to, label, Icon }) => (
              <NavLink key={to} to={to}
                className={({ isActive }) => `${styles.navItem} ${isActive ? styles.navItemActive : ''}`}
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
            <span className={styles.projectLabel}>
              Проект: <strong className={styles.projectName}>default</strong>
            </span>
          </div>
          <div className={styles.topbarRight}>
            {user && (
              <span className={styles.userEmail}>👤 {user.email}</span>
            )}
            <button className={styles.logoutBtn} onClick={handleLogout}>
              <LogOut size={12} />
              <span>Выйти</span>
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