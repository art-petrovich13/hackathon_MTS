// src/pages/user/screen/ScreenPage.tsx
// Fullscreen страница для просмотра экрана конкретного Android-устройства.
// Открывается по /screen/:id, работает без sidebar (не вложена в UserLayout).
// Добавь роут в AppRoutes: внутри ProtectedRoute, НО снаружи UserLayout.

import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getMobileDevices } from '../../../api/api'
import type { MobileDevice } from '../../../types/api'
import { useCopyToClipboard } from '../../../hooks/useCopyToClipboard'

export function ScreenPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { copy } = useCopyToClipboard()

  const { data: devices = [], isLoading } = useQuery<MobileDevice[]>({
    queryKey: ['mobile-devices'],
    queryFn: () => getMobileDevices(),
    // Обновляем каждые 10 сек чтобы отловить изменение статуса
    refetchInterval: 10_000,
  })

  const device = devices.find(d => d.id === id)

  // Пока загружаем
  if (isLoading) {
    return (
      <div style={centerStyle}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>📱</div>
        <div style={{ color: '#94a3b8', fontSize: 16 }}>Загрузка устройства...</div>
      </div>
    )
  }

  // Устройство не найдено
  if (!device) {
    return (
      <div style={centerStyle}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>❓</div>
        <div style={{ color: '#94a3b8', fontSize: 16 }}>Устройство не найдено</div>
        <button onClick={() => navigate('/mobile')} style={backBtn}>
          ← Назад к устройствам
        </button>
      </div>
    )
  }

  // Устройство есть, но порты ещё не назначены (не running)
  if (!device.novnc_port || !device.adb_host) {
    return (
      <div style={centerStyle}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>📱</div>
        <div style={{ color: '#94a3b8', fontSize: 16, marginBottom: 8 }}>
          {device.name} — {device.os_version}
        </div>
        <div style={{
          padding: '4px 12px', borderRadius: 20, fontSize: 12,
          background: 'rgba(251,146,60,0.15)', color: '#fb923c', marginBottom: 16,
        }}>
          {device.status}
        </div>
        <div style={{ fontSize: 13, color: '#64748b', marginBottom: 20 }}>
          Устройство ещё не готово к просмотру экрана
        </div>
        <button onClick={() => navigate('/mobile')} style={backBtn}>
          ← Назад к устройствам
        </button>
      </div>
    )
  }

  const novncUrl = `http://${device.adb_host}:${device.novnc_port}/vnc.html?autoconnect=true&resize=scale`
  const adbCmd   = `adb connect ${device.adb_host}:${device.adb_port}`

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: '#000' }}>

      {/* ── Тонкий хедер ── */}
      <div style={{
        height: 38, flexShrink: 0,
        background: '#0f172a',
        borderBottom: '1px solid #1e293b',
        display: 'flex', alignItems: 'center',
        padding: '0 14px', gap: 14,
      }}>
        {/* Кнопка назад */}
        <button
          onClick={() => navigate('/mobile')}
          style={{
            padding: '3px 10px', borderRadius: 6,
            border: '1px solid #334155', background: 'transparent',
            color: '#64748b', cursor: 'pointer', fontSize: 12,
          }}
        >
          ← Назад
        </button>

        {/* Название устройства */}
        <span style={{ fontSize: 13, color: '#94a3b8' }}>
          📱 {device.name}
        </span>

        {/* OS badge */}
        <span style={{
          padding: '2px 8px', borderRadius: 20, fontSize: 11,
          background: device.os_version?.includes('12') ? '#1e3a5f' : '#1a3d1a',
          color: device.os_version?.includes('12') ? '#60a5fa' : '#4ade80',
        }}>
          🤖 {device.os_version ?? 'android-11'}
        </span>

        {/* Status */}
        <span style={{
          padding: '2px 8px', borderRadius: 20, fontSize: 11,
          background: device.status === 'running' ? 'rgba(34,197,94,0.15)' : 'rgba(100,116,139,0.15)',
          color: device.status === 'running' ? '#4ade80' : '#94a3b8',
        }}>
          {device.status}
        </span>

        <div style={{ flex: 1 }} />

        {/* ADB команда — кликабельна */}
        <span
          onClick={() => copy(adbCmd)}
          title="Кликни чтобы скопировать ADB команду"
          style={{
            fontSize: 11, color: '#475569',
            fontFamily: 'monospace', cursor: 'pointer',
            padding: '3px 8px', borderRadius: 4,
            background: 'rgba(71,85,105,0.15)',
          }}
        >
          📋 {adbCmd}
        </span>
      </div>

      {/* ── Fullscreen noVNC iframe ── */}
      <iframe
        src={novncUrl}
        style={{ flex: 1, border: 'none', background: '#000', display: 'block' }}
        title={`Screen — ${device.name}`}
        allow="fullscreen"
      />
    </div>
  )
}

const centerStyle: React.CSSProperties = {
  height: '100vh',
  display: 'flex', flexDirection: 'column',
  alignItems: 'center', justifyContent: 'center',
  background: '#0f172a',
}

const backBtn: React.CSSProperties = {
  marginTop: 16, padding: '8px 20px', borderRadius: 8,
  border: '1px solid #334155', background: 'transparent',
  color: '#94a3b8', cursor: 'pointer', fontSize: 14,
}