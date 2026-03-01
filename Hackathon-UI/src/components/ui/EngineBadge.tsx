import type { DBEngine } from '../../types/api'

const CFG: Record<DBEngine, { icon: string; label: string; bg: string; color: string }> = {
  postgres: { icon: '🐘', label: 'PostgreSQL', bg: '#dbeafe', color: '#1d4ed8' },
  mysql:    { icon: '🐬', label: 'MySQL',      bg: '#ffedd5', color: '#c2410c' },
  redis:    { icon: '⚡', label: 'Redis',      bg: '#fee2e2', color: '#b91c1c' },
}

export function EngineBadge({ engine }: { engine: DBEngine | string }) {
  const cfg = CFG[engine as DBEngine] ?? { icon: '🗄️', label: engine, bg: '#f3f4f6', color: '#374151' }
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '2px 10px', borderRadius: 9999,
      fontSize: 12, fontWeight: 600, color: cfg.color, background: cfg.bg,
    }}>
      {cfg.icon} {cfg.label}
    </span>
  )
}