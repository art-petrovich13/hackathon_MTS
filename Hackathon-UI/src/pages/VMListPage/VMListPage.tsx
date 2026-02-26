// src/pages/VMListPage.tsx
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  getVMs, startVM, stopVM, deleteVM,
  type VirtualMachine, type VMStatus,
} from '../../api/api'
import s from '../shared.module.css'
import styles from './VMListPage.module.css'

// ── Конфигурация статусов ─────────────────────────────────────────────────
const STATUS: Record<VMStatus, { label: string; color: string }> = {
  pending: { label: 'Pending', color: '#ffd740' },
  creating: { label: 'Creating', color: '#ffd740' },
  'pending-start': { label: 'Starting…', color: '#40c4ff' },
  'pending-stop': { label: 'Stopping…', color: '#ff9100' },
  running: { label: 'Running', color: '#00e676' },
  stopped: { label: 'Stopped', color: '#7a7f94' },
  error: { label: 'Error', color: '#ff4d6a' },
}

const TRANSITIONAL: VMStatus[] = ['pending', 'creating', 'pending-start', 'pending-stop']

// ── Статистика по статусам для саммари-карточек ───────────────────────────
function useSummary(vms: VirtualMachine[]) {
  return {
    total: vms.length,
    running: vms.filter(v => v.status === 'running').length,
    stopped: vms.filter(v => v.status === 'stopped').length,
    pending: vms.filter(v => TRANSITIONAL.includes(v.status)).length,
    error: vms.filter(v => v.status === 'error').length,
  }
}

export function VMListPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()

  const { data: vms = [], isLoading, isError } = useQuery({
    queryKey: ['vms'],
    queryFn: getVMs,
    refetchInterval: 5_000,
  })

  const invalidate = () => qc.invalidateQueries({ queryKey: ['vms'] })
  const startMut = useMutation({ mutationFn: startVM, onSuccess: invalidate })
  const stopMut = useMutation({ mutationFn: stopVM, onSuccess: invalidate })
  const deleteMut = useMutation({ mutationFn: deleteVM, onSuccess: invalidate })

  const summary = useSummary(vms)

  return (
    <div className={styles.page}>
      {/* ── Заголовок ──────────────────────────────────────────────── */}
      <div className={s.pageHeader}>
        <div>
          <h1 className={s.pageTitle}>Virtual Machines</h1>
          <p className={s.pageSubtitle}>auto-refresh every 5 s</p>
        </div>
        <button className={s.btnPrimary} onClick={() => navigate('/vms/create')}>
          + New VM
        </button>
      </div>

      {/* ── Summary карточки ───────────────────────────────────────── */}
      <div className={styles.summary}>
        <SummaryCard label="Total" value={summary.total} color="var(--text-pri)" />
        <SummaryCard label="Running" value={summary.running} color="var(--green)" />
        <SummaryCard label="Stopped" value={summary.stopped} color="var(--text-sec)" />
        <SummaryCard label="Pending" value={summary.pending} color="var(--yellow)" />
        <SummaryCard label="Error" value={summary.error} color="var(--red)" />
      </div>

      {/* ── Состояния ──────────────────────────────────────────────── */}
      {isLoading && (
        <div className={s.stateBox}>
          <div className={s.stateIcon}>▣</div>
          <p className={s.stateText}>Loading virtual machines…</p>
        </div>
      )}
      {isError && (
        <div className={s.stateBox}>
          <div className={s.stateIcon}>✕</div>
          <p className={s.stateTextErr}>Failed to load VMs. Is the backend running?</p>
        </div>
      )}

      {/* ── Пустое состояние ───────────────────────────────────────── */}
      {!isLoading && !isError && vms.length === 0 && (
        <div className={styles.empty}>
          <span className={styles.emptyIcon}>▣</span>
          <p className={styles.emptyTitle}>No virtual machines yet</p>
          <p className={styles.emptyHint}>Create your first VM to get started</p>
          <button className={s.btnPrimary} onClick={() => navigate('/vms/create')}>
            + New VM
          </button>
        </div>
      )}

      {/* ── Таблица ────────────────────────────────────────────────── */}
      {!isLoading && !isError && vms.length > 0 && (
        <div className={s.tableWrap}>
          <table className={s.table}>
            <thead>
              <tr>
                <th>Name</th>
                <th>Status</th>
                <th>IP Address</th>
                <th>Container ID</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {vms.map(vm => (
                <VMRow
                  key={vm.id}
                  vm={vm}
                  onStart={() => startMut.mutate(vm.id)}
                  onStop={() => stopMut.mutate(vm.id)}
                  onDelete={() => confirm(`Delete VM "${vm.name}"?`) && deleteMut.mutate(vm.id)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── Строка таблицы ────────────────────────────────────────────────────────
function VMRow({ vm, onStart, onStop, onDelete }: {
  vm: VirtualMachine
  onStart: () => void
  onStop: () => void
  onDelete: () => void
}) {
  const cfg = STATUS[vm.status] ?? { label: vm.status, color: '#7a7f94' }
  const transitional = TRANSITIONAL.includes(vm.status)
  const shortID = vm.docker_container_id?.slice(0, 12) ?? '—'

  return (
    <tr>
      <td className={s.cellBold}>{vm.name}</td>

      <td>
        <span className={s.badge} style={{ '--c': cfg.color } as React.CSSProperties}>
          {transitional && <span className={s.badgeSpinner} />}
          {cfg.label}
        </span>
      </td>

      <td className={s.cellMono}>{vm.ip_address ?? '—'}</td>

      <td>
        <span className={s.cellMono} title={vm.docker_container_id ?? ''}>
          {shortID}
        </span>
      </td>

      <td className={s.cellDim}>
        {new Date(vm.created_at).toLocaleString()}
      </td>

      <td>
        <div className={styles.actions}>
          {vm.status === 'stopped' && (
            <ActionBtn
              icon="▶" title="Start" variant="start"
              disabled={transitional} onClick={onStart}
            />
          )}
          {vm.status === 'running' && (
            <ActionBtn
              icon="■" title="Stop" variant="stop"
              disabled={transitional} onClick={onStop}
            />
          )}
          <ActionBtn
            icon="✕" title="Delete" variant="delete"
            disabled={transitional} onClick={onDelete}
          />
        </div>
      </td>
    </tr>
  )
}

// ── Кнопка действия ───────────────────────────────────────────────────────
function ActionBtn({ icon, title, variant, disabled, onClick }: {
  icon: string; title: string
  variant: 'start' | 'stop' | 'delete'
  disabled: boolean; onClick: () => void
}) {
  return (
    <button
      className={`${styles.actionBtn} ${styles[`actionBtn_${variant}`]}`}
      title={title}
      disabled={disabled}
      onClick={onClick}
    >
      {icon}
    </button>
  )
}

// ── Summary card ──────────────────────────────────────────────────────────
function SummaryCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className={styles.summaryCard}>
      <span className={styles.summaryValue} style={{ color }}>{value}</span>
      <span className={styles.summaryLabel}>{label}</span>
    </div>
  )
}