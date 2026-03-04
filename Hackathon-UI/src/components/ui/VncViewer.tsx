// src/components/ui/VncViewer.tsx
// Универсальный модальный компонент для просмотра экрана через noVNC в iframe.
// Используется для Android-устройств (novnc_port) и Linux VM с VNC-образом.

import { useEffect } from 'react'

interface VncViewerProps {
  host: string        // hostname или IP — для localhost используй '127.0.0.1'
  port: number        // host-порт noVNC
  title?: string      // заголовок в строке модала
  onClose: () => void // вызывается при закрытии
}

export function VncViewer({ host, port, title = 'Remote Screen', onClose }: VncViewerProps) {
  // Полный URL noVNC:
  // - budtmo/docker-android: /vnc.html доступен на порту 6080
  // - dorowu/ubuntu-desktop-lxde-vnc: /vnc.html на порту 80
  const url = `http://${host}:${port}/vnc.html?autoconnect=true&resize=scale`

  // Закрытие по Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    // Тёмный overlay — клик по нему закрывает модал
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 300,
        background: 'rgba(0,0,0,0.88)',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
      }}
    >
      {/* Окно просмотра — клик внутри НЕ закрывает */}
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '92vw', maxWidth: 1200,
          height: '90vh',
          background: '#0f172a',
          border: '1px solid #334155',
          borderRadius: 12,
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 40px 100px rgba(0,0,0,0.9)',
        }}
      >
        {/* ── Window chrome bar — имитация macOS/Linux ── */}
        <div style={{
          height: 42, flexShrink: 0,
          background: '#1e293b',
          borderBottom: '1px solid #334155',
          display: 'flex', alignItems: 'center',
          padding: '0 14px', gap: 10,
          userSelect: 'none',
        }}>
          {/* Декоративные кнопки */}
          <div style={{ display: 'flex', gap: 7 }}>
            <div
              onClick={onClose}
              title="Закрыть"
              style={{
                width: 13, height: 13, borderRadius: '50%',
                background: '#ef4444', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 9, color: 'rgba(0,0,0,0.5)',
                fontWeight: 700,
              }}
            >
              ✕
            </div>
            <div style={{ width: 13, height: 13, borderRadius: '50%', background: '#f59e0b' }} />
            <div style={{ width: 13, height: 13, borderRadius: '50%', background: '#22c55e' }} />
          </div>

          {/* Заголовок */}
          <span style={{
            marginLeft: 8, fontSize: 13, color: '#94a3b8',
            fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            flex: 1,
          }}>
            {title} — {host}:{port}
          </span>

          {/* Ссылка "открыть в отдельной вкладке" */}
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={e => e.stopPropagation()}
            style={{
              fontSize: 11, color: '#60a5fa', textDecoration: 'none',
              padding: '3px 10px', borderRadius: 6, whiteSpace: 'nowrap',
              border: '1px solid rgba(96,165,250,0.25)',
              background: 'rgba(96,165,250,0.06)',
            }}
          >
            ↗ Открыть в новой вкладке
          </a>

          {/* Кнопка закрытия */}
          <button
            onClick={onClose}
            style={{
              padding: '3px 10px', borderRadius: 6, border: '1px solid #334155',
              background: 'transparent', color: '#64748b', cursor: 'pointer',
              fontSize: 12,
            }}
          >
            Закрыть
          </button>
        </div>

        {/* ── noVNC iframe — занимает всё оставшееся место ── */}
        <iframe
          src={url}
          style={{
            flex: 1,
            border: 'none',
            background: '#000',
            display: 'block',
          }}
          title={title}
          allow="fullscreen"
          // sandbox нужен для безопасности но оставляем скрипты (noVNC требует JS)
          sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
        />

        {/* ── Подсказка снизу ── */}
        <div style={{
          height: 30, flexShrink: 0,
          background: '#0a0f1a',
          borderTop: '1px solid #1e293b',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 11, color: '#334155', gap: 16,
        }}>
          <span>Кликни на экран для активации ввода</span>
          <span>·</span>
          <span>Esc — закрыть</span>
        </div>
      </div>
    </div>
  )
}