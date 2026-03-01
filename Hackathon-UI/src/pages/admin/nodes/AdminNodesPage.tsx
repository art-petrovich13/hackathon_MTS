// src/pages/NodesPage.tsx
import { useQuery } from '@tanstack/react-query'
import { getNodes } from '../../../api/api'
import { type ComputeNode } from '../../../types/api'
import s from '../../shared.module.css'
import styles from './AdminNodesPage.module.css'

export function AdminNodesPage() {
  const { data: nodes = [], isLoading, isError } = useQuery({
    queryKey: ['nodes'],
    queryFn: getNodes,
    refetchInterval: 15_000,
  })

  const activeCount = nodes.filter(n => n.status === 'active').length

  return (
    <div className={styles.page}>
      <div className={s.pageHeader}>
        <div>
          <h1 className={s.pageTitle}>Compute Nodes</h1>
          <p className={s.pageSubtitle}>
            {nodes.length} node{nodes.length !== 1 ? 's' : ''} · {activeCount} active · auto-refresh 15 s
          </p>
        </div>
      </div>

      {isLoading && (
        <div className={s.stateBox}>
          <div className={s.stateIcon}>◈</div>
          <p className={s.stateText}>Loading nodes…</p>
        </div>
      )}
      {isError && (
        <div className={s.stateBox}>
          <p className={s.stateTextErr}>Failed to load nodes.</p>
        </div>
      )}

      {!isLoading && !isError && (
        <div className={styles.grid}>
          {nodes.map(node => <NodeCard key={node.id} node={node} />)}
        </div>
      )}
    </div>
  )
}

function NodeCard({ node }: { node: ComputeNode }) {
  const usedCPU = node.total_cpu - node.free_cpu
  const usedRAM = node.total_ram_mb - node.free_ram_mb
  const cpuPct = node.total_cpu > 0 ? Math.round((usedCPU / node.total_cpu) * 100) : 0
  const ramPct = node.total_ram_mb > 0 ? Math.round((usedRAM / node.total_ram_mb) * 100) : 0

  const fmt = (mb: number) => mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${mb} MB`

  return (
    <div className={styles.card}>
      <div className={styles.cardTop}>
        <div className={styles.nodeInfo}>
          <span className={styles.nodeName}>{node.name}</span>
          <span className={styles.nodeEndpoint}>{node.endpoint}</span>
        </div>
        <span className={`${s.badge} ${node.status === 'active' ? s.badgeGreen : s.badgeGray}`}>
          {node.status}
        </span>
      </div>

      <div className={styles.bars}>
        <Bar label="CPU" used={usedCPU} total={node.total_cpu} pct={cpuPct}
          usedLabel={`${usedCPU} / ${node.total_cpu} vCPU`} />
        <Bar label="RAM" used={usedRAM} total={node.total_ram_mb} pct={ramPct}
          usedLabel={`${fmt(usedRAM)} / ${fmt(node.total_ram_mb)}`} />
      </div>

      <div className={styles.freeRow}>
        <FreeItem label="Free CPU" value={`${node.free_cpu} vCPU`} />
        <FreeItem label="Free RAM" value={fmt(node.free_ram_mb)} />
      </div>
    </div>
  )
}

function Bar({ label, pct, usedLabel }: {
  label: string; used: number; total: number; pct: number; usedLabel: string
}) {
  const color = pct > 85 ? '#ff4d6a' : pct > 60 ? '#ffd740' : '#00c853'
  return (
    <div className={styles.bar}>
      <div className={styles.barHeader}>
        <span className={styles.barLabel}>{label}</span>
        <span className={styles.barInfo}>{usedLabel} · <b style={{ color }}>{pct}%</b></span>
      </div>
      <div className={styles.barTrack}>
        <div className={styles.barFill} style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  )
}

function FreeItem({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.freeItem}>
      <span className={styles.freeLabel}>{label}</span>
      <span className={styles.freeValue}>{value}</span>
    </div>
  )
}