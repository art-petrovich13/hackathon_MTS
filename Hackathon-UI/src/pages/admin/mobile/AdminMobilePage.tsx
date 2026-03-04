// Пример: src/pages/admin/databases/AdminDatabasesPage.tsx
import { useState } from 'react'
import type { CSSProperties, FormEvent } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  getMobileDevices, createMobileDevice, deleteMobileDevice,
  startMobileDevice, stopMobileDevice, getFlavors,
} from '../../../api/api'
import type { MobileDevice, Flavor } from '../../../types/api'
import { StatusBadge } from '../../../components/ui/StatusBadge'
import s from '../../shared.module.css'

// Тот же project_id что во всех остальных страницах
const DEFAULT_PROJECT_ID = '18b192b4-57c2-4f9e-ad30-135160284b1d'
const TRANSITIONAL = new Set(['pending', 'creating', 'pending-start', 'pending-stop'])

// ─── Главная страница ──────────────────────────────────────────────────────────

export function AdminMobilePage() {
  const qc = useQueryClient()
  const [showCreate, setShowCreate]           = useState(false)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

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

  const hasPending = devices.some(d => TRANSITIONAL.has(d.status))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>

      {/* ── Шапка ─────────────────────────────────────────────────────────── */}
      <div className={s.pageHeader}>
        <div>
          <h1 className={s.pageTitle}>Mobile Farm</h1>
          <p className={s.pageSubtitle}>
            {devices.length} device{devices.length !== 1 ? 's' : ''}
            {hasPending && ' · auto-refresh 3s'}
          </p>
        </div>
        <button className={s.btnPrimary} onClick={() => setShowCreate(true)}>
          + New Device
        </button>
      </div>

      {/* ── Предупреждение о требованиях ──────────────────────────────────── */}
      <div style={{
        marginBottom: 20, padding: '10px 16px', borderRadius: 8,
        background: 'rgba(251,146,60,0.08)',
        border: '1px solid rgba(251,146,60,0.25)',
        fontSize: 13, color: '#fb923c',
      }}>
        ⚠ Android эмуляторы требуют /dev/kvm на Linux-хосте. Первый запуск скачивает образ ~5 GB и занимает 5–10 минут.
      </div>

      {/* ── Состояния ─────────────────────────────────────────────────────── */}
      {isLoading && (
        <div className={s.stateBox}>
          <div className={s.stateIcon}>📱</div>
          <p className={s.stateText}>Loading devices…</p>
        </div>
      )}
      {isError && (
        <div className={s.stateBox}>
          <p className={s.stateTextErr}>
            Failed to load. Эндпоинт /mobile-devices ещё не готов на бэкенде.
          </p>
        </div>
      )}
      {!isLoading && !isError && devices.length === 0 && (
        <div className={s.stateBox}>
          <div className={s.stateIcon} style={{ fontSize: 48, opacity: 0.2 }}>📱</div>
          <p className={s.stateText}>No mobile devices yet</p>
          <button
            className={s.btnPrimary}
            style={{ marginTop: 12 }}
            onClick={() => setShowCreate(true)}
          >
            + Create first device
          </button>
        </div>
      )}

      {/* ── Таблица ───────────────────────────────────────────────────────── */}
      {!isLoading && !isError && devices.length > 0 && (
        <div className={s.tableWrap}>
          <table className={s.table}>
            <thead>
              <tr>
                <th>Name</th>
                <th>OS</th>
                <th>Status</th>
                <th>noVNC</th>
                <th>ADB</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {devices.map(dev => {
                const trans = TRANSITIONAL.has(dev.status)
                const novncUrl = dev.novnc_port ? `http://127.0.0.1:${dev.novnc_port}` : null
                const adbCmd   = dev.adb_host && dev.adb_port
                  ? `adb connect ${dev.adb_host}:${dev.adb_port}`
                  : null
                const isConfirming = confirmDeleteId === dev.id

                return (
                  <tr key={dev.id}>
                    <td className={s.cellBold}>{dev.name}</td>
                    <td>
                      <span style={{
                        padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700,
                        background: dev.os_version?.includes('12') ? '#1e3a5f' : '#1a3d1a',
                        color: dev.os_version?.includes('12') ? '#60a5fa' : '#4ade80',
                      }}>
                        🤖 {dev.os_version ?? 'android-11'}
                      </span>
                    </td>
                    <td><StatusBadge status={dev.status} /></td>
                    <td style={{ fontSize: 12 }}>
                      {novncUrl
                        ? (
                          <a
                            href={novncUrl}
                            target="_blank"
                            rel="noreferrer"
                            style={{ color: 'var(--accent)', textDecoration: 'none' }}
                          >
                            🖥 Open VNC ↗
                          </a>
                        )
                        : <span className={s.cellDim}>—</span>
                      }
                    </td>
                    <td className={s.cellMono} style={{ fontSize: 11 }}>
                      {adbCmd ?? '—'}
                    </td>
                    <td className={s.cellDim}>
                      {new Date(dev.created_at).toLocaleString('ru-RU')}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                        {dev.status === 'stopped' && (
                          <button
                            disabled={trans}
                            onClick={() => startMut.mutate(dev.id)}
                            style={{ ...btnStyle('#1a3d1a', '#4ade80'), opacity: trans ? 0.4 : 1 }}
                          >
                            ▶
                          </button>
                        )}
                        {dev.status === 'running' && (
                          <button
                            disabled={trans}
                            onClick={() => stopMut.mutate(dev.id)}
                            style={{ ...btnStyle('#3d1a00', '#fb923c'), opacity: trans ? 0.4 : 1 }}
                          >
                            ■
                          </button>
                        )}

                        {/* Inline-подтверждение вместо window.confirm */}
                        {isConfirming ? (
                          <>
                            <button
                              onClick={() => deleteMut.mutate(dev.id)}
                              disabled={deleteMut.isPending}
                              style={btnStyle('#4a0f0f', '#f87171')}
                            >
                              {deleteMut.isPending ? '...' : 'Да'}
                            </button>
                            <button
                              onClick={() => setConfirmDeleteId(null)}
                              style={btnStyle('transparent', 'var(--text-sec)')}
                            >
                              Нет
                            </button>
                          </>
                        ) : (
                          <button
                            disabled={trans}
                            onClick={() => setConfirmDeleteId(dev.id)}
                            style={{
                              ...btnStyle('#3f1212', '#f87171'),
                              opacity: trans ? 0.4 : 1,
                              cursor: trans ? 'not-allowed' : 'pointer',
                            }}
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Модал создания ────────────────────────────────────────────────── */}
      {showCreate && (
        <CreateMobileModal
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); invalidate() }}
        />
      )}
    </div>
  )
}

function btnStyle(bg: string, color: string): CSSProperties {
  return {
    padding: '4px 10px', borderRadius: 6, border: 'none',
    background: bg, color, cursor: 'pointer', fontSize: 13, fontWeight: 700,
    whiteSpace: 'nowrap',
  }
}

// ─── Модал создания Android-устройства ────────────────────────────────────────

function CreateMobileModal({
  onClose, onCreated,
}: {
  onClose: () => void
  onCreated: () => void
}) {
  const [name, setName]         = useState('')
  const [flavorId, setFlavorId] = useState('')
  const [osVersion, setOsVersion] = useState('android-11')
  const [error, setError]       = useState('')

  const { data: flavors = [], isLoading: loadFlavors } = useQuery<Flavor[]>({
    queryKey: ['flavors', 'mobile_farm'],
    queryFn: () => getFlavors('mobile_farm'),
  })

  const mutation = useMutation({
    mutationFn: createMobileDevice,
    onSuccess: () => {
      toast.success('Устройство создаётся (5–10 мин для загрузки образа)...')
      onCreated()
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Ошибка создания'
      setError(msg)
      toast.error(msg)
    },
  })

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    setError('')
    if (!name.trim()) return setError('Введите имя устройства')
    if (!flavorId)    return setError('Выберите конфигурацию')
    mutation.mutate({
      name:       name.trim(),
      project_id: DEFAULT_PROJECT_ID,
      flavor_id:  flavorId,
      os_version: osVersion,
    })
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(0,0,0,0.65)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--bg-surface)', border: '1px solid var(--border)',
          borderRadius: 16, padding: 28, width: 480, maxWidth: '95vw',
          maxHeight: '90vh', overflowY: 'auto',
        }}
      >
        <h2 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 700, color: 'var(--text-pri)' }}>
          📱 Create Android Emulator
        </h2>

        {/* Предупреждение внутри модала */}
        <div style={{
          marginBottom: 20, padding: '10px 14px', borderRadius: 8,
          background: 'rgba(251,146,60,0.08)',
          border: '1px solid rgba(251,146,60,0.3)',
          fontSize: 13, color: '#fb923c',
        }}>
          ⚠ Первый запуск скачивает образ ~5 GB. Статус pending → creating → running.
          Требуется /dev/kvm на Linux-хосте.
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Имя */}
          <div>
            <label style={labelStyle}>Имя устройства</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. pixel-7-test"
              autoFocus
              style={inputStyle}
            />
          </div>

          {/* Версия Android */}
          <div>
            <label style={labelStyle}>Android версия</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {(['android-11', 'android-12'] as const).map(v => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setOsVersion(v)}
                  style={{
                    flex: 1, padding: '10px', borderRadius: 8,
                    cursor: 'pointer', fontWeight: 600, fontSize: 14,
                    border: `1px solid ${osVersion === v ? 'var(--accent)' : 'var(--border)'}`,
                    background: osVersion === v ? 'var(--accent-dim)' : 'transparent',
                    color: osVersion === v ? 'var(--accent)' : 'var(--text-pri)',
                  }}
                >
                  🤖 Android {v.replace('android-', '')}
                </button>
              ))}
            </div>
          </div>

          {/* Конфигурация */}
          <div>
            <label style={labelStyle}>Конфигурация (CPU + RAM)</label>
            {loadFlavors ? (
              <p style={{ color: 'var(--text-sec)', fontSize: 13 }}>Загрузка...</p>
            ) : flavors.length === 0 ? (
              <p style={{ color: 'var(--red)', fontSize: 13 }}>
                Нет конфигураций для mobile_farm. Проверь seed.sql.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {flavors.map(f => {
                  const selected = flavorId === f.id
                  const ram = f.ram_mb >= 1024 ? `${f.ram_mb / 1024} GB` : `${f.ram_mb} MB`
                  return (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setFlavorId(f.id)}
                      style={{
                        padding: '10px 14px', borderRadius: 8,
                        textAlign: 'left' as const,
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        cursor: 'pointer',
                        border: `1px solid ${selected ? 'var(--accent)' : 'var(--border)'}`,
                        background: selected ? 'var(--accent-dim)' : 'transparent',
                      }}
                    >
                      <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-pri)' }}>
                        {f.name}
                      </span>
                      <span style={{ fontSize: 12, color: 'var(--text-sec)' }}>
                        {f.cpu} vCPU · {ram} RAM
                      </span>
                      {selected && <span style={{ color: 'var(--accent)', marginLeft: 8 }}>✓</span>}
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Ошибка */}
          {error && (
            <div style={{
              padding: '10px 14px', borderRadius: 8,
              background: 'rgba(255,77,106,0.08)',
              border: '1px solid rgba(255,77,106,0.3)',
              color: 'var(--red)', fontSize: 13,
            }}>
              ⚠ {error}
            </div>
          )}

          {/* Кнопки */}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '10px 20px', borderRadius: 8,
                border: '1px solid var(--border)',
                background: 'transparent', cursor: 'pointer',
                fontWeight: 600, color: 'var(--text-pri)',
              }}
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              style={{
                padding: '10px 20px', borderRadius: 8,
                background: 'var(--accent)', border: 'none', color: '#0d0f14',
                cursor: mutation.isPending ? 'not-allowed' : 'pointer',
                fontWeight: 700, opacity: mutation.isPending ? 0.6 : 1,
              }}
            >
              {mutation.isPending ? 'Создаём...' : 'Создать →'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

const labelStyle: CSSProperties = {
  display: 'block', fontSize: 11, fontWeight: 700,
  color: 'var(--text-sec)', marginBottom: 8,
  textTransform: 'uppercase', letterSpacing: '0.06em',
}

const inputStyle: CSSProperties = {
  width: '100%', padding: '10px 14px', borderRadius: 8,
  border: '1px solid var(--border)',
  background: 'var(--bg-raised)', color: 'var(--text-pri)',
  fontSize: 14, outline: 'none', boxSizing: 'border-box',
}