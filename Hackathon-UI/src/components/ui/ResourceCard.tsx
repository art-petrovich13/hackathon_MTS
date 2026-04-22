import type { ReactNode } from 'react'
import { StatusBadge } from './StatusBadge'
import s from './ui.module.css'

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
    <div className={s.resourceCard}>
      <div className={s.resourceCardHeader}>
        <span className={s.resourceCardIcon}>{icon}</span>
        <div className={s.resourceCardMeta}>
          <div className={s.resourceCardTitle}>{title}</div>
          {subtitle && <div className={s.resourceCardSubtitle}>{subtitle}</div>}
        </div>
        {typeof status === 'string' ? <StatusBadge status={status} /> : status}
      </div>
      {details && <div className={s.resourceCardDetails}>{details}</div>}
      {actions && <div className={s.resourceCardActions}>{actions}</div>}
    </div>
  )
}