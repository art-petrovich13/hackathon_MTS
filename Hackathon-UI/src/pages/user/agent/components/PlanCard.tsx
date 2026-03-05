import type { AgentPlan } from '../../../../types/api'

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
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
      {/* Аватар агента */}
      <div style={{
        width: 32, height: 32, borderRadius: '50%', background: '#1d4ed8', flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16,
      }}>🤖</div>

      {/* Карточка плана */}
      <div style={{
        flex: 1, border: '1px solid #3b82f6',
        borderRadius: '4px 18px 18px 18px', background: '#0f172a', padding: 18,
      }}>
        {/* Заголовок */}
        <p style={{ margin: '0 0 14px', fontWeight: 600, color: '#f1f5f9', fontSize: 15 }}>
          📋 {plan.summary}
        </p>

        {/* Список сервисов */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
          {plan.services.map((svc, i) => (
            <div key={i} style={{
              background: '#1e293b', borderRadius: 12,
              padding: '12px 14px', border: '1px solid #1e3a5f',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <span style={{ fontWeight: 600, color: '#f1f5f9', fontSize: 14 }}>
                    {SVC_ICONS[svc.service_type] ?? '⚙️'} {svc.name}
                  </span>
                  <div style={{ color: '#64748b', fontSize: 12, marginTop: 2 }}>
                    {svc.flavor_name}
                  </div>
                  <div style={{ color: '#60a5fa', fontSize: 12, marginTop: 4 }}>
                    💡 {svc.reason}
                  </div>
                </div>
                <span style={{
                  color: '#34d399', fontFamily: 'monospace',
                  fontSize: 13, marginLeft: 12, flexShrink: 0,
                }}>
                  ${svc.cost_per_hour.toFixed(3)}/ч
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Итог и кнопки */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          borderTop: '1px solid #1e293b', paddingTop: 14,
        }}>
          <div style={{ fontSize: 13, color: '#94a3b8' }}>
            Итого:{' '}
            <strong style={{ color: '#f1f5f9' }}>
              ${plan.total_cost_per_hour.toFixed(3)}/ч
            </strong>
            <span style={{ color: '#475569', fontSize: 11, marginLeft: 8 }}>
              (~${(plan.total_cost_per_hour * 720).toFixed(0)}/мес)
            </span>
          </div>
          <button
            onClick={onDeploy}
            disabled={deploying}
            style={{
              background: deploying ? '#374151' : '#16a34a',
              color: '#fff', border: 'none', borderRadius: 10,
              padding: '9px 20px', fontWeight: 700,
              cursor: deploying ? 'not-allowed' : 'pointer',
              fontSize: 14, transition: 'background 0.15s',
            }}
          >
            {deploying ? '⏳ Развёртываю...' : '🚀 Развернуть'}
          </button>
        </div>
      </div>
    </div>
  )
}
