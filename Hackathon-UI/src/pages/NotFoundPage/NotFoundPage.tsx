import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import styles from './NotFoundPage.module.css'

/* ── Satellite SVG illustration ──────────────────────────────────────────── */
function SatelliteIllustration() {
  return (
    <svg
      viewBox="0 0 120 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ width: '100%', height: '100%' }}
    >
      {/* Body */}
      <rect x="42" y="44" width="36" height="32" rx="6"
        fill="#1a1e2a" stroke="#252836" strokeWidth="1.5" />
      {/* Antenna dish */}
      <ellipse cx="60" cy="34" rx="14" ry="8" fill="none"
        stroke="#C62E26" strokeWidth="1.5" />
      <line x1="60" y1="42" x2="60" y2="44" stroke="#C62E26" strokeWidth="1.5" />
      {/* Solar panels left */}
      <rect x="10" y="55" width="28" height="10" rx="3"
        fill="#1a1e2a" stroke="#252836" strokeWidth="1.2" />
      <line x1="16" y1="55" x2="16" y2="65" stroke="#3b8bd4" strokeWidth="0.7" opacity="0.5" />
      <line x1="22" y1="55" x2="22" y2="65" stroke="#3b8bd4" strokeWidth="0.7" opacity="0.5" />
      <line x1="28" y1="55" x2="28" y2="65" stroke="#3b8bd4" strokeWidth="0.7" opacity="0.5" />
      <line x1="38" y1="60" x2="10" y2="60" stroke="#3d4155" strokeWidth="1.2" />
      {/* Solar panels right */}
      <rect x="82" y="55" width="28" height="10" rx="3"
        fill="#1a1e2a" stroke="#252836" strokeWidth="1.2" />
      <line x1="88" y1="55" x2="88" y2="65" stroke="#3b8bd4" strokeWidth="0.7" opacity="0.5" />
      <line x1="94" y1="55" x2="94" y2="65" stroke="#3b8bd4" strokeWidth="0.7" opacity="0.5" />
      <line x1="100" y1="55" x2="100" y2="65" stroke="#3b8bd4" strokeWidth="0.7" opacity="0.5" />
      <line x1="82" y1="60" x2="110" y2="60" stroke="#3d4155" strokeWidth="1.2" />
      {/* Blinking status light */}
      <circle cx="72" cy="60" r="3" fill="#C62E26" opacity="0.9">
        <animate attributeName="opacity" values="0.9;0.1;0.9" dur="1.4s" repeatCount="indefinite" />
      </circle>
      {/* Signal lines (broken) */}
      <path d="M60 26 Q46 18 34 22" stroke="#C62E26" strokeWidth="1"
        strokeDasharray="3 3" opacity="0.4" />
      <path d="M60 26 Q74 18 86 22" stroke="#C62E26" strokeWidth="1"
        strokeDasharray="3 3" opacity="0.4" />
      {/* Small stars */}
      <circle cx="20" cy="20" r="1.2" fill="#7a7f94" opacity="0.6" />
      <circle cx="95" cy="28" r="0.9" fill="#7a7f94" opacity="0.5" />
      <circle cx="30" cy="90" r="1"   fill="#7a7f94" opacity="0.4" />
      <circle cx="96" cy="85" r="1.2" fill="#7a7f94" opacity="0.6" />
      <circle cx="14" cy="72" r="0.7" fill="#7a7f94" opacity="0.4" />
      <circle cx="108" cy="45" r="0.8" fill="#7a7f94" opacity="0.5" />
    </svg>
  )
}

/* ── Main component ──────────────────────────────────────────────────────── */
export function NotFoundPage() {
  const { user, isAdmin } = useAuth()
  const navigate = useNavigate()

  const dashboardLink = isAdmin ? '/admin/dashboard' : '/dashboard'

  return (
    <div className={styles.page}>

      {/* ── Navigation header ── */}
      <nav className={styles.nav}>
        <Link to="/about" className={styles.navLogo}>
          <span className={styles.navLogoMark}>⬡</span>
          <span className={styles.navLogoText}>IaaS<em>Cloud</em></span>
        </Link>

        <div className={styles.navLinks}>
          {user ? (
            <>
              <Link to={dashboardLink} className={styles.navLink}>Dashboard</Link>
              {!isAdmin && (
                <>
                  <Link to="/compute"   className={styles.navLink}>Compute</Link>
                  <Link to="/databases" className={styles.navLink}>Databases</Link>
                  <Link to="/storage"   className={styles.navLink}>Storage</Link>
                </>
              )}
              {isAdmin && (
                <>
                  <Link to="/admin/vms"       className={styles.navLink}>VMs</Link>
                  <Link to="/admin/databases" className={styles.navLink}>Databases</Link>
                  <Link to="/admin/users"     className={styles.navLink}>Users</Link>
                </>
              )}
              <span className={styles.navDivider} />
              <Link to="/about"    className={styles.navLink}>О нас</Link>
              <Link to="/contacts" className={styles.navLink}>Контакты</Link>
            </>
          ) : (
            <>
              <Link to="/about"    className={styles.navLink}>О компании</Link>
              <Link to="/contacts" className={styles.navLink}>Контакты</Link>
              <span className={styles.navDivider} />
              <Link to="/login" className={styles.navBtnLogin}>Войти →</Link>
            </>
          )}
        </div>
      </nav>

      {/* ── Body ── */}
      <div className={styles.body}>
        <div className={styles.inner}>

          {/* Satellite + radar rings */}
          <div className={styles.illustration}>
            <div className={styles.radarWrap}>
              <div className={styles.ring} />
              <div className={styles.ring} />
              <div className={styles.ring} />
            </div>
            <SatelliteIllustration />
          </div>

          {/* Status pill */}
          <div className={styles.statusLine}>
            <span className={styles.statusDot} />
            <span className={styles.statusText}>SIGNAL LOST</span>
          </div>

          {/* 404 glitch number */}
          <div className={styles.code404}>404</div>

          <h1 className={styles.heading}>Страница не найдена</h1>

          <p className={styles.subtext}>
            Запрошенный ресурс недоступен или был удалён.
            Проверьте адрес или вернитесь в консоль управления.
          </p>

          {/* Terminal block */}
          <div className={styles.terminal}>
            <div className={styles.termBar}>
              <span className={styles.termDot} />
              <span className={styles.termDot} />
              <span className={styles.termDot} />
              <span className={styles.termTitle}>iaascloud — bash</span>
            </div>
            <div className={styles.termBody}>
              <span className={styles.termLine}>
                <span className={styles.termPrompt}>$ </span>
                <span className={styles.termCmd}>curl -I {window.location.pathname}</span>
              </span>
              <span className={styles.termLine}>
                <span className={styles.termErr}>HTTP/1.1 404 Not Found</span>
              </span>
              <span className={styles.termLine}>
                <span className={styles.termDim}>X-Request-Id: err_route_not_found</span>
              </span>
              <span className={styles.termLine}>&nbsp;</span>
              <span className={styles.termLine}>
                <span className={styles.termPrompt}>$ </span>
                <span className={styles.termCmd}>ping iaascloud.io</span>
              </span>
              <span className={styles.termLine}>
                <span className={styles.termOk}>PING 172.17.0.1: 56 bytes of data</span>
              </span>
              <span className={styles.termLine}>
                <span className={styles.termOk}>64 bytes from 172.17.0.1: icmp_seq=0 ttl=64</span>
              </span>
              <span className={styles.termLine}>
                <span className={styles.termPrompt}>$ </span>
                <span className={styles.termCursor} />
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className={styles.actions}>
            {user ? (
              <Link to={dashboardLink} className={styles.btnPrimary}>
                ← Вернуться в Dashboard
              </Link>
            ) : (
              <Link to="/login" className={styles.btnPrimary}>
                → Войти в консоль
              </Link>
            )}
            <button
              className={styles.btnSecondary}
              onClick={() => navigate(-1)}
            >
              ↩ Назад
            </button>
          </div>

        </div>
      </div>
    </div>
  )
}
