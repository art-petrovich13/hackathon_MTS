import { useQuery } from '@tanstack/react-query'
import { getServiceCatalogFull } from '../../../api/api'
import s from '../../shared.module.css'
import styles from './AdminCatalogPage.module.css'
import './AdminCatalogPage.mobile.css'

export function AdminCatalogPage() {
  const { data: catalog = [], isLoading, isError } = useQuery({
    queryKey: ['service-catalog-full'],
    queryFn: getServiceCatalogFull,
  })

  return (
    <div className={styles.page}>
      <div className={s.pageHeader}>
        <div>
          <h1 className={s.pageTitle}>Service Catalog</h1>
          <p className={s.pageSubtitle}>
            {catalog.length} service{catalog.length !== 1 ? 's' : ''} available
          </p>
        </div>
      </div>

      {isLoading && (
        <div className={s.stateBox}>
          <div className={s.stateIcon}>◆</div>
          <p className={s.stateText}>Loading catalog…</p>
        </div>
      )}
      {isError && (
        <div className={s.stateBox}>
          <p className={s.stateTextErr}>Failed to load catalog.</p>
        </div>
      )}

      {!isLoading && !isError && (
        <div className={styles.catalogGrid}>
          {catalog.map(svc => (
            <div key={svc.id} className={styles.card}>

              {/* ── Заголовок карточки сервиса ────────────────────────── */}
              <div className={styles.cardHeader}>
                <span style={{ fontSize: 32, lineHeight: 1 }}>{svc.icon ?? '⚙️'}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className={styles.cardName}>{svc.name}</div>
                  {svc.description && (
                    <div className={styles.cardDesc}>{svc.description}</div>
                  )}
                </div>
                <span className={styles.availBadge} data-available={svc.is_available}>
                  {svc.is_available ? 'Available' : 'Unavailable'}
                </span>
              </div>

              {/* ── Таблица flavors внутри карточки ──────────────────── */}
              {svc.flavors.length > 0 ? (
                <table className={styles.flavorTable}>
                  <thead>
                    <tr>
                      {['Name', 'CPU', 'RAM', 'Disk'].map(h => (
                        <th key={h}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {svc.flavors.map(f => {
                      const ram = f.ram_mb >= 1024
                        ? `${f.ram_mb / 1024} GB`
                        : `${f.ram_mb} MB`
                      return (
                        <tr key={f.id}>
                          <td style={{ fontWeight: 600 }}>{f.name}</td>
                          <td>{f.cpu} vCPU</td>
                          <td>{ram}</td>
                          <td>{f.disk_gb} GB</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              ) : (
                <p className={styles.noFlavors}>No flavors configured</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}