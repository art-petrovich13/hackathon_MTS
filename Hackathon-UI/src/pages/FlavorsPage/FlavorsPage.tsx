// src/pages/FlavorsPage.tsx
import { useQuery } from '@tanstack/react-query'
import { getFlavors } from '../../api/api'
import s from '../shared.module.css'
import styles from './FlavorsPage.module.css'

export function FlavorsPage() {
    const { data: flavors = [], isLoading, isError } = useQuery({
        queryKey: ['flavors'],
        queryFn: getFlavors,
    })

    return (
        <div>
            <div className={s.pageHeader}>
                <div>
                    <h1 className={s.pageTitle}>Flavors</h1>
                    <p className={s.pageSubtitle}>
                        {flavors.length} flavor{flavors.length !== 1 ? 's' : ''} configured
                    </p>
                </div>
            </div>

            {isLoading && (
                <div className={s.stateBox}>
                    <div className={s.stateIcon}>◆</div>
                    <p className={s.stateText}>Loading flavors…</p>
                </div>
            )}
            {isError && (
                <div className={s.stateBox}>
                    <div className={s.stateIcon}>✕</div>
                    <p className={s.stateTextErr}>Failed to load flavors.</p>
                </div>
            )}

            {!isLoading && !isError && (
                <div className={styles.grid}>
                    {flavors.map(f => {
                        const ram = f.ram_mb >= 1024
                            ? `${f.ram_mb / 1024} GB`
                            : `${f.ram_mb} MB`
                        return (
                            <div key={f.id} className={styles.card}>
                                <div className={styles.cardName}>{f.name}</div>
                                <div className={styles.specs}>
                                    <SpecRow icon="⚡" label="vCPU" value={`${f.cpu}`} />
                                    <SpecRow icon="◧" label="RAM" value={ram} />
                                    <SpecRow icon="▤" label="Disk" value={`${f.disk_gb} GB`} />
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}

function SpecRow({ icon, label, value }: { icon: string; label: string; value: string }) {
    return (
        <div className={styles.specRow}>
            <span className={styles.specIcon}>{icon}</span>
            <span className={styles.specLabel}>{label}</span>
            <span className={styles.specValue}>{value}</span>
        </div>
    )
}