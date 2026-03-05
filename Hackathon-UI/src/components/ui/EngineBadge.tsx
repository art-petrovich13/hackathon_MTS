// Тоже используем классы из shared.module.css
import type { DBEngine } from '../../types/api'
import shared from '../../pages/shared.module.css'

const CFG: Record<DBEngine, { icon: string; label: string; cls: string }> = {
  postgres: { icon: '🐘', label: 'PostgreSQL', cls: shared.badgeBlue   },
  mysql:    { icon: '🐬', label: 'MySQL',      cls: shared.badgeOrange },
  redis:    { icon: '⚡', label: 'Redis',      cls: shared.badgeRed    },
}

export function EngineBadge({ engine }: { engine: DBEngine | string }) {
  const cfg = CFG[engine as DBEngine] ?? { icon: '🗄️', label: engine, cls: shared.badgeGray }
  return (
    <span className={`${shared.badge} ${cfg.cls}`}>
      {cfg.icon} {cfg.label}
    </span>
  )
}