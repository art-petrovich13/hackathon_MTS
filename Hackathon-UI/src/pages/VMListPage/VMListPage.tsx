// src/pages/VMListPage.tsx
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  getVMs, startVM, stopVM, deleteVM,
  type VirtualMachine, type VMStatus,
} from '../../api/api'
import s from '../shared.module.css'
import styles from './VMListPage.module.css'

type StatusCfg = { label: string; badgeClass: string }

const STATUS_CFG: Record<VMStatus, StatusCfg> = {
  pending: { label: 'Pending', badgeClass: s.badgeYellow },
  creating: { label: 'Creating', badgeClass: s.badgeYellow },
  'pending-start': { label: 'Starting…', badgeClass: s.badgeBlue },
  'pending-stop': { label: 'Stopping…', badgeClass: s.badgeOrange },
  running: { label: 'Running', badgeClass: s.badgeGreen },
  stopped: { label: 'Stopped', badgeClass: s.badgeGray },
  error: { label: 'Error', badgeClass: s.badgeRed },
}

const TRANSITIONAL: VMStatus[] = ['pending', 'creating', 'pending-start', 'pending-stop']

type FilterKey = 'all' | 'running' | 'stopped' | 'pending' | 'error'

const FILTER_STATUSES: Record<FilterKey, VMStatus[]> = {
  all: ['pending', 'creating', 'pending-start', 'pending-stop', 'running', 'stopped', 'error'],
  running: ['running'],
  stopped: ['stopped'],
  pending: ['pending', 'creating', 'pending-start', 'pending-stop'],
  error: ['error'],
}

const SUMMARY_COLORS: Record<string, string> = {
  Total: 'var(--text-pri)',
  Running: '#00c853',
  Stopped: 'var(--text-sec)',
  Pending: '#ffd740',
  Error: '#ff4d6a',
}

export function VMListPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [filter, setFilter] = useState<FilterKey>('all')

  const { data: vms = [], isLoading, isError } = useQuery({
    queryKey: ['vms'],
    queryFn: getVMs,
    refetchInterval: 5_000,
  })

  const invalidate = () => qc.invalidateQueries({ queryKey: ['vms'] })
  const startMut = useMutation({ mutationFn: startVM, onSuccess: invalidate })
  const stopMut = useMutation({ mutationFn: stopVM, onSuccess: invalidate })
  const deleteMut = useMutation({ mutationFn: deleteVM, onSuccess: invalidate })

  const counts = {
    total: vms.length,
    running: vms.filter(v => v.status === 'running').length,
    stopped: vms.filter(v => v.status === 'stopped').length,
    pending: vms.filter(v => TRANSITIONAL.includes(v.status)).length,
    error: vms.filter(v => v.status === 'error').length,
  }

  const filtered = vms.filter(v => FILTER_STATUSES[filter].includes(v.status))

  return (
    <div className={styles.page}>
      <div className={s.pageHeader}>
        <div>
          <h1 className={s.pageTitle}>Virtual Machines</h1>
          <p className={s.pageSubtitle}>auto-refresh every 5 s · click a card to filter</p>
        </div>
        <button className={s.btnPrimary} onClick={() => navigate('/vms/create')}>
          + New VM
        </button>
      </div>

      {/* ── Summary row ──────────────────────────────────────────────── */}
      <div className={styles.summaryRow}>
        {([
          { key: 'all' as FilterKey, label: 'Total', value: counts.total },
          { key: 'running' as FilterKey, label: 'Running', value: counts.running },
          { key: 'stopped' as FilterKey, label: 'Stopped', value: counts.stopped },
          { key: 'pending' as FilterKey, label: 'Pending', value: counts.pending },
          { key: 'error' as FilterKey, label: 'Error', value: counts.error },
        ]).map(({ key, label, value }) => (
          <button
            key={key}
            className={`${styles.summaryCard} ${filter === key ? styles.summaryCardActive : ''}`}
            onClick={() => setFilter(prev => prev === key ? 'all' : key)}
          >
            <span className={styles.summaryValue} style={{ color: SUMMARY_COLORS[label] }}>
              {value}
            </span>
            <span className={styles.summaryLabel}>{label}</span>
          </button>
        ))}
      </div>

      {isLoading && (
        <div className={s.stateBox}>
          <div className={s.stateIcon}>▣</div>
          <p className={s.stateText}>Loading…</p>
        </div>
      )}
      {isError && (
        <div className={s.stateBox}>
          <p className={s.stateTextErr}>Failed to load VMs.</p>
        </div>
      )}

      {!isLoading && !isError && vms.length === 0 && (
        <div className={styles.emptyBox}>
          <span className={styles.emptyIcon}>▣</span>
          <p className={styles.emptyTitle}>No virtual machines yet</p>
          <p className={styles.emptyHint}>Create your first VM to get started</p>
          <button className={s.btnPrimary} onClick={() => navigate('/vms/create')}>
            + New VM
          </button>
        </div>
      )}

      {!isLoading && !isError && vms.length > 0 && (
        <>
          {filter !== 'all' && (
            <p className={styles.filterHint}>
              Showing {filtered.length} VM · filter: <strong>{filter}</strong>
              <button className={styles.filterClear} onClick={() => setFilter('all')}>clear ✕</button>
            </p>
          )}

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
                {filtered.map(vm => {
                  const cfg = STATUS_CFG[vm.status] ?? { label: vm.status, badgeClass: s.badgeGray }
                  const trans = TRANSITIONAL.includes(vm.status)
                  return (
                    <tr key={vm.id}>
                      <td className={s.cellBold}>{vm.name}</td>
                      <td>
                        <span className={`${s.badge} ${cfg.badgeClass}`}>
                          {trans && <span className={s.badgeSpinner} />}
                          {cfg.label}
                        </span>
                      </td>
                      <td className={s.cellMono}>{vm.ip_address ?? '—'}</td>
                      <td className={s.cellMono} title={vm.docker_container_id ?? ''}>
                        {vm.docker_container_id?.slice(0, 12) ?? '—'}
                      </td>
                      <td className={s.cellDim}>{new Date(vm.created_at).toLocaleString()}</td>
                      <td>
                        <div className={styles.actions}>
                          {vm.status === 'stopped' && (
                            <button className={`${styles.actionBtn} ${styles.actionBtnStart}`}
                              disabled={trans} onClick={() => startMut.mutate(vm.id)} title="Start">▶</button>
                          )}
                          {vm.status === 'running' && (
                            <button className={`${styles.actionBtn} ${styles.actionBtnStop}`}
                              disabled={trans} onClick={() => stopMut.mutate(vm.id)} title="Stop">■</button>
                          )}
                          <button className={`${styles.actionBtn} ${styles.actionBtnDelete}`}
                            disabled={trans}
                            onClick={() => confirm(`Delete "${vm.name}"?`) && deleteMut.mutate(vm.id)}
                            title="Delete">✕</button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}