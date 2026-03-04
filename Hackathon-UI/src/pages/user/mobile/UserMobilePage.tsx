import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  getMobileDevices, deleteMobileDevice,
  startMobileDevice, stopMobileDevice,
} from '../../../api/api'
import type { MobileDevice } from '../../../types/api'
import { ResourceCard } from '../../../components/ui/ResourceCard'
import { useCopyToClipboard } from '../../../hooks/useCopyToClipboard'
import s from '../../shared.module.css'
// Добавить к существующим импортам:
import { useNavigate } from 'react-router-dom'
import { VncViewer } from '../../../components/ui/VncViewer'

const TRANSITIONAL = new Set(['pending', 'creating', 'pending-start', 'pending-stop'])

export function UserMobilePage() {
  const qc = useQueryClient()
  const { copy } = useCopyToClipboard()
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [viewScreen, setViewScreen] = useState<MobileDevice | null>(null)
  const navigate = useNavigate()

  const { data: devices = [], isLoading, isError } = useQuery<MobileDevice[]>({
    queryKey: ['mobile-devices'],
    queryFn: getMobileDevices,
    refetchInterval: (query) => {
      const data = query.state.data as MobileDevice[] | undefined
      return data?.some(d => TRANSITIONAL.has(d.status)) ? 3_000 : 15_000
    },
  })

  const invalidate = () => qc.invalidateQueries({ queryKey: ['mobile-devices'] })

  const deleteMut = useMutation({
    mutationFn: deleteMobileDevice,
    onSuccess: () => {
      invalidate()
      setConfirmDeleteId(null)
      toast.success('Устройство удалено')
    },
    onError: () => toast.error('Ошибка удаления'),
  })
  const startMut = useMutation({
    mutationFn: startMobileDevice,
    onSuccess: () => { invalidate(); toast.success('Устройство запускается...') },
    onError: () => toast.error('Ошибка запуска'),
  })
  const stopMut = useMutation({
    mutationFn: stopMobileDevice,
    onSuccess: () => { invalidate(); toast.success('Устройство останавливается...') },
    onError: () => toast.error('Ошибка остановки'),
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
      <div className={s.pageHeader}>
        <div>
          <h1 className={s.pageTitle}>Mobile Farm</h1>
          <p className={s.pageSubtitle}>
            {devices.length} устройств{devices.length === 1 ? 'о' : ''}
          </p>
        </div>
      </div>

      {isLoading && (
        <div className={s.stateBox}>
          <div className={s.stateIcon}>📱</div>
          <p className={s.stateText}>Loading devices…</p>
        </div>
      )}
      {isError && (
        <div className={s.stateBox}>
          <p className={s.stateTextErr}>Failed to load. Запроси создание в Admin → Mobile Farm</p>
        </div>
      )}
      {!isLoading && !isError && devices.length === 0 && (
        <div className={s.stateBox}>
          <div className={s.stateIcon} style={{ fontSize: 56, opacity: 0.18 }}>📱</div>
          <p className={s.stateText}>Нет Android устройств</p>
          <p style={{ fontSize: 13, color: 'var(--text-dim)', marginTop: 4 }}>
            Обратись в Admin → Mobile Farm для создания
          </p>
        </div>
      )}

      {!isLoading && !isError && devices.length > 0 && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
          gap: 16,
        }}>
          {devices.map(dev => {
            const trans = TRANSITIONAL.has(dev.status)
            const novncUrl = dev.novnc_port ? `http://127.0.0.1:${dev.novnc_port}` : null
            const adbCmd = dev.adb_host && dev.adb_port
              ? `adb connect ${dev.adb_host}:${dev.adb_port}`
              : null
            const isConfirming = confirmDeleteId === dev.id
            const canViewScreen = dev.status === 'running' && !!dev.adb_host && !!dev.novnc_port

            return (
              <ResourceCard
                key={dev.id}
                icon="📱"
                title={dev.name}
                subtitle={`🤖 ${dev.os_version ?? 'android-11'}`}
                status={dev.status}
                details={
                  <>
                    {/* ADB команда — кликабельна для копирования */}
                    {adbCmd && (
                      <span
                        onClick={() => copy(adbCmd, `adb-${dev.id}`)}
                        title="Нажми чтобы скопировать ADB команду"
                        style={{
                          cursor: 'pointer', fontSize: 11,
                          fontFamily: 'monospace', color: 'var(--text-sec)',
                          display: 'flex', alignItems: 'center', gap: 4,
                        }}
                      >
                        📋 {adbCmd}
                      </span>
                    )}
                    {/* Ссылка / кнопки VNC */}
                    {novncUrl && (
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <button
                          onClick={() => setViewScreen(dev)}
                          style={{
                            padding: '3px 10px', borderRadius: 6, border: 'none',
                            background: 'rgba(99,102,241,0.15)', color: '#818cf8',
                            cursor: 'pointer', fontSize: 11, fontWeight: 600,
                          }}
                        >
                          📺 Экран
                        </button>
                        <button
                          onClick={() => navigate(`/screen/${dev.id}`)}
                          style={{
                            padding: '3px 10px', borderRadius: 6,
                            border: '1px solid rgba(99,102,241,0.2)',
                            background: 'transparent', color: '#6366f1',
                            cursor: 'pointer', fontSize: 11,
                          }}
                        >
                          ⛶ Полный экран
                        </button>
                      </div>
                    )}
                    {/* Состояние когда running но порты ещё не назначены */}
                    {!novncUrl && dev.status === 'running' && (
                      <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                        Порты ещё назначаются...
                      </span>
                    )}
                  </>
                }
                actions={
                  <>
                    {dev.status === 'stopped' && (
                      <button
                        disabled={trans}
                        onClick={() => startMut.mutate(dev.id)}
                        style={{
                          padding: '6px 14px', borderRadius: 6, border: 'none',
                          background: '#1a3d1a', color: '#4ade80',
                          cursor: trans ? 'not-allowed' : 'pointer',
                          fontWeight: 600, fontSize: 12,
                          opacity: trans ? 0.4 : 1,
                        }}
                      >
                        ▶ Start
                      </button>
                    )}
                    {dev.status === 'running' && (
                      <button
                        disabled={trans}
                        onClick={() => stopMut.mutate(dev.id)}
                        style={{
                          padding: '6px 14px', borderRadius: 6, border: 'none',
                          background: '#3d1a00', color: '#fb923c',
                          cursor: trans ? 'not-allowed' : 'pointer',
                          fontWeight: 600, fontSize: 12,
                          opacity: trans ? 0.4 : 1,
                        }}
                      >
                        ■ Stop
                      </button>
                    )}

                    {/* Inline-подтверждение удаления — без window.confirm */}
                    {isConfirming ? (
                      <>
                        <button
                          onClick={() => deleteMut.mutate(dev.id)}
                          disabled={deleteMut.isPending}
                          style={{
                            padding: '6px 14px', borderRadius: 6, border: 'none',
                            background: '#4a0f0f', color: '#f87171',
                            cursor: 'pointer', fontWeight: 600, fontSize: 12,
                          }}
                        >
                          {deleteMut.isPending ? '...' : 'Удалить?'}
                        </button>
                        <button
                          onClick={() => setConfirmDeleteId(null)}
                          style={{
                            padding: '6px 10px', borderRadius: 6,
                            border: '1px solid var(--border)',
                            background: 'transparent', color: 'var(--text-sec)',
                            cursor: 'pointer', fontSize: 12,
                          }}
                        >
                          Нет
                        </button>
                      </>
                    ) : (
                      <button
                        disabled={trans}
                        onClick={() => setConfirmDeleteId(dev.id)}
                        style={{
                          padding: '6px 14px', borderRadius: 6, border: 'none',
                          background: '#3f1212', color: '#f87171',
                          cursor: trans ? 'not-allowed' : 'pointer',
                          fontWeight: 600, fontSize: 12,
                          opacity: trans ? 0.4 : 1,
                        }}
                      >
                        ✕ Delete
                      </button>
                    )}
                  </>
                }
              />
            )
          })}
        </div>
      )}
      {/* VncViewer модал — показывается когда выбрано устройство */}
      {viewScreen && viewScreen.adb_host && viewScreen.novnc_port && (
        <VncViewer
          host={viewScreen.adb_host}
          port={viewScreen.novnc_port}
          title={`Android — ${viewScreen.name} (${viewScreen.os_version})`}
          onClose={() => setViewScreen(null)}
        />
      )}
    </div>
  )
}