// Использует классы из shared.module.css — никакого отдельного CSS не нужно
import type { VMStatus, ServiceStatus } from '../../types/api'
import shared from '../../pages/shared.module.css'

type AnyStatus = VMStatus | ServiceStatus | string

interface BadgeConfig {
  label: string
  cls: string   // класс из shared.module.css
  spin?: boolean
}

const BADGES: Record<string, BadgeConfig> = {
  'pending':       { label: 'Pending',     cls: shared.badgeYellow, spin: true  },
  'creating':      { label: 'Creating',    cls: shared.badgeBlue,   spin: true  },
  'running':       { label: 'Running',     cls: shared.badgeGreen               },
  'pending-start': { label: 'Starting…',  cls: shared.badgeBlue,   spin: true  },
  'pending-stop':  { label: 'Stopping…',  cls: shared.badgeOrange, spin: true  },
  'stopped':       { label: 'Stopped',     cls: shared.badgeGray                },
  'stopping':      { label: 'Stopping',    cls: shared.badgeOrange, spin: true  },
  'error':         { label: 'Error',       cls: shared.badgeRed                 },
  'deleted':       { label: 'Deleted',     cls: shared.badgeGray                },
}

export function StatusBadge({ status }: { status: AnyStatus }) {
  const cfg = BADGES[status] ?? { label: status, cls: shared.badgeGray }
  return (
    <span className={`${shared.badge} ${cfg.cls}`}>
      {cfg.spin && <span className={shared.badgeSpinner} />}
      {cfg.label}
    </span>
  )
}