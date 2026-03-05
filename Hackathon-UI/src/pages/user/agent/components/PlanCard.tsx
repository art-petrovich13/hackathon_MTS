import type { AgentPlan } from '../../../../types/api'
import s from './AgentPage.module.css'

const SVC_ICONS: Record<string, string> = {
  vm: '🖥️',
  database: '🗄️',
  object_storage: '🪣',
}

interface PlanCardProps {
  plan: AgentPlan
  onDeploy: () => void
  deploying: boolean
}

export function PlanCard({ plan, onDeploy, deploying }: PlanCardProps) {
  return (
    <div className={s.agentRow}>
      <div className={s.avatar}>🤖</div>
      <div className={s.planBubble}>

        <p className={s.planTitle}>📋 {plan.summary}</p>

        <div className={s.planServices}>
          {plan.services.map((svc, i) => (
            <div key={i} className={s.serviceCard}>
              <div className={s.serviceCardInner}>
                <div>
                  <div className={s.serviceName}>
                    {SVC_ICONS[svc.service_type] ?? '⚙️'} {svc.name}
                  </div>
                  <div className={s.serviceFlavor}>{svc.flavor_name}</div>
                  <div className={s.serviceReason}>💡 {svc.reason}</div>
                </div>
                <span className={s.serviceCost}>${svc.cost_per_hour.toFixed(3)}/ч</span>
              </div>
            </div>
          ))}
        </div>

        <div className={s.planFooter}>
          <div className={s.planCost}>
            Итого:{' '}
            <strong className={s.planCostValue}>${plan.total_cost_per_hour.toFixed(3)}/ч</strong>
            <span className={s.planCostMonth}>(~${(plan.total_cost_per_hour * 720).toFixed(0)}/мес)</span>
          </div>
          <button className={s.deployBtn} onClick={onDeploy} disabled={deploying}>
            {deploying ? '⏳ Развёртываю...' : '🚀 Развернуть'}
          </button>
        </div>

      </div>
    </div>
  )
}