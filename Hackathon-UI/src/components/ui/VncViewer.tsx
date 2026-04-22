import { useEffect } from 'react'
import s from './ui.module.css'

interface VncViewerProps {
  host: string
  port: number
  title?: string
  onClose: () => void
}

export function VncViewer({ host, port, title = 'Remote Screen', onClose }: VncViewerProps) {
  const url = `http://${host}:${port}/vnc.html?autoconnect=true&resize=scale`

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div className={s.vncOverlay} onClick={onClose}>
      <div className={s.vncWindow} onClick={e => e.stopPropagation()}>

        {/* ── Window chrome ── */}
        <div className={s.vncChrome}>
          <div className={s.vncDots}>
            <div className={`${s.vncDot} ${s.vncDotRed}`} onClick={onClose} title="Закрыть">✕</div>
            <div className={`${s.vncDot} ${s.vncDotYellow}`} />
            <div className={`${s.vncDot} ${s.vncDotGreen}`} />
          </div>
          <span className={s.vncTitle}>{title} — {host}:{port}</span>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className={s.vncNewTabLink}
            onClick={e => e.stopPropagation()}
          >
            ↗ Открыть в новой вкладке
          </a>
          <button className={s.vncCloseBtn} onClick={onClose}>Закрыть</button>
        </div>

        {/* ── iframe ── */}
        <iframe
          src={url}
          className={s.vncIframe}
          title={title}
          allow="fullscreen"
          sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
        />

        {/* ── Подсказка ── */}
        <div className={s.vncFooter}>
          <span>Кликни на экран для активации ввода</span>
          <span>·</span>
          <span>Esc — закрыть</span>
        </div>
      </div>
    </div>
  )
}