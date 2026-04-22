// src/pages/ImagesPage.tsx
import { useQuery } from '@tanstack/react-query'
import { getImages } from '../../../api/api'
import s from '../../shared.module.css'
import styles from './ImagesPage.module.css'

export function AdminImagesPage() {
  const { data: images = [], isLoading, isError } = useQuery({
    queryKey: ['images'],
    queryFn: getImages,
  })

  return (
    <div className={styles.page}>
      <div className={s.pageHeader}>
        <div>
          <h1 className={s.pageTitle}>Images</h1>
          <p className={s.pageSubtitle}>
            {images.length} image{images.length !== 1 ? 's' : ''} ·{' '}
            {images.filter(i => i.status === 'active').length} active
          </p>
        </div>
      </div>

      {isLoading && (
        <div className={s.stateBox}>
          <div className={s.stateIcon}>◉</div>
          <p className={s.stateText}>Loading images…</p>
        </div>
      )}
      {isError && (
        <div className={s.stateBox}>
          <p className={s.stateTextErr}>Failed to load images.</p>
        </div>
      )}

      {!isLoading && !isError && images.length === 0 && (
        <div className={s.stateBox}>
          <div className={s.stateIcon}>◉</div>
          <p className={s.stateText}>No images found in database.</p>
        </div>
      )}

      {!isLoading && !isError && images.length > 0 && (
        <div className={styles.grid}>
          {images.map(img => (
            <div key={img.id} className={styles.card}>
              <div className={styles.cardTop}>
                <span className={styles.imgName}>{img.name}</span>
                <span className={`${s.badge} ${img.status === 'active' ? s.badgeGreen : s.badgeGray}`}>
                  {img.status}
                </span>
              </div>
              <div className={styles.imgTag}>{img.docker_image}</div>
              <div className={styles.cardMeta}>
                <MetaItem label="OS" value={img.os_type} />
                <MetaItem label="Version" value={img.version} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-dim)' }}>
        {label}
      </span>
      <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: 'var(--text-sec)' }}>
        {value}
      </span>
    </div>
  )
}