// src/pages/ImagesPage.tsx
import { useQuery } from '@tanstack/react-query'
import { getImages } from '../../api/api'
import s from '../shared.module.css'

export function ImagesPage() {
    const { data: images = [], isLoading, isError } = useQuery({
        queryKey: ['images'],
        queryFn: getImages,
    })

    const activeCount = images.filter(i => i.status === 'active').length

    return (
        <div>
            <div className={s.pageHeader}>
                <div>
                    <h1 className={s.pageTitle}>Images</h1>
                    <p className={s.pageSubtitle}>
                        {images.length} image{images.length !== 1 ? 's' : ''} · {activeCount} active
                    </p>
                </div>
            </div>

            {isLoading && (
                <div className={s.stateBox}>
                    <div className={s.stateIcon}>◉</div>
                    <p className={s.stateText}>Loading images…</p>
                </div>
            )}
            {isError && (
                <div className={s.stateBox}>
                    <div className={s.stateIcon}>✕</div>
                    <p className={s.stateTextErr}>Failed to load images.</p>
                </div>
            )}

            {!isLoading && !isError && (
                <div className={s.tableWrap}>
                    <table className={s.table}>
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Docker Image</th>
                                <th>OS</th>
                                <th>Version</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {images.map(img => (
                                <tr key={img.id}>
                                    <td className={s.cellBold}>{img.name}</td>
                                    <td className={s.cellMono}>{img.docker_image}</td>
                                    <td className={s.cellDim}>{img.os_type}</td>
                                    <td className={s.cellMono}>{img.version}</td>
                                    <td>
                                        <span
                                            className={s.badge}
                                            style={{
                                                '--c': img.status === 'active' ? 'var(--green)' : 'var(--text-sec)',
                                            } as React.CSSProperties}
                                        >
                                            {img.status}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    )
}