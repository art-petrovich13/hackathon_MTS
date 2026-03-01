import type { VMStatus, ServiceStatus } from '../../types/api'

type AnyStatus = VMStatus | ServiceStatus | string

interface BadgeConfig {
  label: string
  dot: string
  bg: string
  text: string
  spin?: boolean
}

const BADGES: Record<string, BadgeConfig> = {
  // VM-статусы (из текущего api.ts)
  'pending':       { label: 'Pending',       dot: '#f59e0b', bg: '#fef3c7', text: '#92400e', spin: true  },
  'creating':      { label: 'Creating',      dot: '#3b82f6', bg: '#dbeafe', text: '#1d4ed8', spin: true  },
  'running':       { label: 'Running',       dot: '#10b981', bg: '#d1fae5', text: '#065f46'              },
  'pending-start': { label: 'Starting...',   dot: '#8b5cf6', bg: '#ede9fe', text: '#5b21b6', spin: true  },
  'pending-stop':  { label: 'Stopping...',   dot: '#f97316', bg: '#ffedd5', text: '#c2410c', spin: true  },
  'stopped':       { label: 'Stopped',       dot: '#6b7280', bg: '#f3f4f6', text: '#374151'              },
  'error':         { label: 'Error',         dot: '#ef4444', bg: '#fee2e2', text: '#991b1b'              },
  // ServiceStatus-статусы (новые сервисы)
  'stopping':      { label: 'Stopping',      dot: '#f97316', bg: '#ffedd5', text: '#c2410c', spin: true  },
  'deleted':       { label: 'Deleted',       dot: '#9ca3af', bg: '#f9fafb', text: '#6b7280'              },
}

interface Props {
  status: AnyStatus
}

export function StatusBadge({ status }: Props) {
  const cfg = BADGES[status] ?? { label: status, dot: '#9ca3af', bg: '#f9fafb', text: '#6b7280' }

  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '2px 10px', borderRadius: 9999,
      fontSize: 12, fontWeight: 600,
      color: cfg.text, background: cfg.bg,
    }}>
      <span style={{
        width: 8, height: 8, borderRadius: '50%',
        background: cfg.spin ? 'transparent' : cfg.dot,
        border: cfg.spin ? `2px solid ${cfg.dot}` : 'none',
        borderTopColor: cfg.spin ? 'transparent' : undefined,
        display: 'inline-block', flexShrink: 0,
        animation: cfg.spin ? 'spin 0.8s linear infinite' : 'none',
      }} />
      {cfg.label}
    </span>
  )
}