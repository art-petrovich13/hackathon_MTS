// src/pages/NodesPage.tsx
import { useQuery } from '@tanstack/react-query'
import { getNodes, type ComputeNode } from '../../api/api'
import s from '../shared.module.css'
import styles from './NodesPage.module.css'

export function NodesPage() {
    const { data: nodes = [], isLoading, isError } = useQuery({
        queryKey: ['nodes'],
        queryFn: getNodes,
        refetchInterval: 15_000,
    })

    const activeCount = nodes.filter(n => n.status === 'active').length

    return (
        <div>
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
                    <div className={s.stateIcon}>✕</div>
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

    const ramUsed = usedRAM >= 1024 ? `${(usedRAM / 1024).toFixed(1)} GB` : `${usedRAM} MB`
    const ramTotal = node.total_ram_mb >= 1024 ? `${(node.total_ram_mb / 1024).toFixed(1)} GB` : `${node.total_ram_mb} MB`

    return (
        <div className={`${styles.card} ${node.status !== 'active' ? styles.cardOffline : ''}`}>
            {/* ── Шапка ──────────────────────────────────────────────────── */}
            <div className={styles.cardHeader}>
                <div>
                    <div className={styles.nodeName}>{node.name}</div>
                    <div className={styles.nodeEndpoint}>{node.endpoint}</div>
                </div>
                <span
                    className={s.badge}
                    style={{ '--c': node.status === 'active' ? 'var(--green)' : 'var(--text-sec)' } as React.CSSProperties}
                >
                    {node.status}
                </span>
            </div>

            {/* ── Метрики CPU ────────────────────────────────────────────── */}
            <div className={styles.metrics}>
                <ResourceBar
                    label="CPU"
                    pct={cpuPct}
                    usedLabel={`${usedCPU} / ${node.total_cpu} vCPU`}
                />
                <ResourceBar
                    label="RAM"
                    pct={ramPct}
                    usedLabel={`${ramUsed} / ${ramTotal}`}
                />
            </div>

            {/* ── Цифры ──────────────────────────────────────────────────── */}
            <div className={styles.stats}>
                <Stat label="Free CPU" value={`${node.free_cpu} vCPU`} />
                <Stat label="Free RAM" value={node.free_ram_mb >= 1024
                    ? `${(node.free_ram_mb / 1024).toFixed(1)} GB`
                    : `${node.free_ram_mb} MB`}
                />
            </div>
        </div>
    )
}

function ResourceBar({ label, pct, usedLabel }: {
    label: string; pct: number; usedLabel: string
}) {
    const color = pct > 85 ? 'var(--red)' : pct > 60 ? 'var(--yellow)' : 'var(--accent)'
    return (
        <div className={styles.bar}>
            <div className={styles.barTop}>
                <span className={styles.barLabel}>{label}</span>
                <span className={styles.barRight}>
                    <span className={styles.barUsed}>{usedLabel}</span>
                    <span className={styles.barPct} style={{ color }}>{pct}%</span>
                </span>
            </div>
            <div className={styles.barTrack}>
                <div className={styles.barFill} style={{ width: `${pct}%`, background: color }} />
            </div>
        </div>
    )
}

function Stat({ label, value }: { label: string; value: string }) {
    return (
        <div className={styles.stat}>
            <span className={styles.statLabel}>{label}</span>
            <span className={styles.statValue}>{value}</span>
        </div>
    )
}