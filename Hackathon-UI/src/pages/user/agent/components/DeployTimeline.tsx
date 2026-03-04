import type { DeployStep } from '../../../../types/api'

const STATUS_ICON: Record<string, string> = {
  in_progress: '⟳',
  success: '✓',
  error: '✗',
}
const STATUS_COLOR: Record<string, string> = {
  in_progress: '#3b82f6',
  success: '#16a34a',
  error: '#dc2626',
}

export function DeployTimeline({ steps }: { steps: DeployStep[] }) {
  const isDone      = steps.some(s => s.step === 'done')
  const realSteps   = steps.filter(s => s.step !== 'done')
  const resources   = realSteps.filter(s => s.status === 'success' && s.result).map(s => s.result as Record<string, unknown>)

  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
      <div style={{
        width: 32, height: 32, borderRadius: '50%',
        background: isDone ? '#16a34a' : '#3b82f6', flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16,
      }}>
        {isDone ? '✅' : '🔄'}
      </div>

      <div style={{
        flex: 1, border: `1px solid ${isDone ? '#16a34a' : '#3b82f6'}`,
        borderRadius: '4px 18px 18px 18px', background: '#0f172a', padding: 18,
      }}>
        <p style={{ margin: '0 0 14px', fontWeight: 600, color: '#f1f5f9', fontSize: 15 }}>
          {isDone ? '✅ Инфраструктура готова!' : '⚙️ Развёртываю...'}
        </p>

        {/* Timeline шагов */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {realSteps.map((step, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                background: STATUS_COLOR[step.status] ?? '#475569',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, color: '#fff', fontWeight: 700,
              }}>
                {STATUS_ICON[step.status] ?? '?'}
              </div>
              <span style={{ color: '#cbd5e1', fontSize: 13 }}>{step.message}</span>
            </div>
          ))}
        </div>

        {/* Карточки созданных ресурсов */}
        {isDone && resources.length > 0 && (
          <div style={{ marginTop: 16, borderTop: '1px solid #1e293b', paddingTop: 14 }}>
            <p style={{ margin: '0 0 10px', color: '#34d399', fontSize: 13, fontWeight: 600 }}>
              📋 Данные для подключения:
            </p>
            {resources.map((res, i) => (
              <ResourceCard key={i} res={res} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Карточка одного созданного ресурса ─────────────────────────────────────────
function ResourceCard({ res }: { res: Record<string, unknown> }) {
  const isDB  = 'db_name' in res
  const isS3  = 's3_endpoint' in res
  const isVM  = !isDB && !isS3

  return (
    <div style={{
      background: '#1e293b', borderRadius: 12,
      padding: '12px 14px', marginBottom: 8,
      border: '1px solid #1e3a5f',
    }}>
      {/* Имя и статус */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontWeight: 600, color: '#f1f5f9', fontSize: 14 }}>
          {isDB ? '🗄️' : isS3 ? '🪣' : '🖥️'}{' '}
          {String(res.name ?? '—')}
        </span>
        <span style={{
          fontSize: 11, padding: '2px 8px', borderRadius: 10,
          background: res.status === 'running' ? 'rgba(22,163,74,0.15)' : 'rgba(251,191,36,0.1)',
          color: res.status === 'running' ? '#34d399' : '#fbbf24',
        }}>
          {String(res.status ?? 'pending')}
        </span>
      </div>

      {/* Кредентиалы */}
      <div style={{ fontFamily: 'monospace', fontSize: 12, color: '#64748b', lineHeight: 1.8 }}>
        {isDB && (
          <>
            <div>Host: <Highlight>{String(res.host ?? 'pending')}</Highlight>{res.port ? `:${res.port}` : ''}</div>
            <div>DB:   <Highlight>{String(res.db_name ?? '—')}</Highlight></div>
            <div>User: <Highlight>{String(res.db_user ?? 'pending')}</Highlight></div>
            <div>Pass: <Highlight yellow>{String(res.db_password ?? 'pending')}</Highlight></div>
          </>
        )}
        {isS3 && (
          <>
            <div>S3:    <Highlight>{String(res.s3_endpoint ?? 'pending')}</Highlight></div>
            <div>Key:   <Highlight yellow>{String(res.access_key ?? 'pending')}</Highlight></div>
            <div>Bucket:<Highlight>{String(res.bucket_name ?? '—')}</Highlight></div>
          </>
        )}
        {isVM && (
          <div>IP: <Highlight>{String(res.ip_address ?? 'ожидается...')}</Highlight></div>
        )}
      </div>
    </div>
  )
}

function Highlight({ children, yellow }: { children: React.ReactNode; yellow?: boolean }) {
  return (
    <span style={{ color: yellow ? '#fcd34d' : '#34d399' }}>{children}</span>
  )
}
