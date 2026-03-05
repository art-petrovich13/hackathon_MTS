import type { ReactNode } from 'react'
import { StatusBadge } from './StatusBadge'

interface Props {
  icon: string
  title: string
  subtitle?: string
  status: string | ReactNode
  details?: ReactNode
  actions?: ReactNode
}

export function ResourceCard({ icon, title, subtitle, status, details, actions }: Props) {
  return (
    <div style={{
      background: 'var(--color-surface, #1e293b)',
      border: '1px solid var(--color-border, #334155)',
      borderRadius: 12, padding: 20,
      display: 'flex', flexDirection: 'column', gap: 12,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <span style={{ fontSize: 26, lineHeight: 1 }}>{icon}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontWeight: 700, fontSize: 15,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {title}
          </div>
          {subtitle && (
            <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>{subtitle}</div>
          )}
        </div>
        {typeof status === 'string' ? <StatusBadge status={status} /> : status}
      </div>

      {details && (
        <div style={{ fontSize: 13, color: '#cbd5e1', display: 'flex', flexDirection: 'column', gap: 3 }}>
          {details}
        </div>
      )}

      {actions && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {actions}
        </div>
      )}
    </div>
  )
}