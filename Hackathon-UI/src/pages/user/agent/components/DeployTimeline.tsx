import type { DeployStep } from '../../../../types/api'
import s from './AgentPage.module.css'

const STATUS_ICON: Record<string, string> = {
  in_progress: '⟳',
  success:     '✓',
  error:       '✗',
}

const STEP_CLASS: Record<string, string> = {
  in_progress: s.stepInProgress,
  success:     s.stepSuccess,
  error:       s.stepError,
}

export function DeployTimeline({ steps }: { steps: DeployStep[] }) {
  const isDone    = steps.some(s => s.step === 'done')
  const realSteps = steps.filter(s => s.step !== 'done')
  const resources = realSteps
    .filter(s => s.status === 'success' && s.result)
    .map(s => s.result as Record<string, unknown>)

  return (
    <div className={s.agentRow}>
      <div className={s.avatar}>{isDone ? '✅' : '🔄'}</div>
      <div className={`${s.deployBubble} ${isDone ? s.deployBubbleDone : s.deployBubblePending}`}>

        <p className={s.deployTitle}>
          {isDone ? '✅ Инфраструктура готова!' : '⚙️ Развёртываю...'}
        </p>

        <div className={s.deploySteps}>
          {realSteps.map((step, i) => (
            <div key={i} className={s.deployStep}>
              <div className={`${s.stepIcon} ${STEP_CLASS[step.status] ?? s.stepDefault}`}>
                {STATUS_ICON[step.status] ?? '?'}
              </div>
              <span className={s.stepMsg}>{step.message}</span>
            </div>
          ))}
        </div>

        {isDone && resources.length > 0 && (
          <div className={s.resources}>
            <p className={s.resourcesTitle}>📋 Данные для подключения:</p>
            {resources.map((res, i) => <ResourceCard key={i} res={res} />)}
          </div>
        )}

      </div>
    </div>
  )
}

function ResourceCard({ res }: { res: Record<string, unknown> }) {
  const isDB = 'db_name' in res
  const isS3 = 's3_endpoint' in res

  const statusClass = res.status === 'running' ? s.resourceStatusRunning : s.resourceStatusPending

  return (
    <div className={s.resourceCard}>
      <div className={s.resourceHeader}>
        <span className={s.resourceName}>
          {isDB ? '🗄️' : isS3 ? '🪣' : '🖥️'} {String(res.name ?? '—')}
        </span>
        <span className={statusClass}>{String(res.status ?? 'pending')}</span>
      </div>
      <div className={s.resourceCreds}>
        {isDB && (
          <>
            <div>Host: <span className={s.highlightGreen}>{String(res.host ?? 'pending')}</span>{res.port ? `:${res.port}` : ''}</div>
            <div>DB:   <span className={s.highlightGreen}>{String(res.db_name ?? '—')}</span></div>
            <div>User: <span className={s.highlightGreen}>{String(res.db_user ?? 'pending')}</span></div>
            <div>Pass: <span className={s.highlightYellow}>{String(res.db_password ?? 'pending')}</span></div>
          </>
        )}
        {isS3 && (
          <>
            <div>S3:    <span className={s.highlightGreen}>{String(res.s3_endpoint ?? 'pending')}</span></div>
            <div>Key:   <span className={s.highlightYellow}>{String(res.access_key ?? 'pending')}</span></div>
            <div>Bucket:<span className={s.highlightGreen}>{String(res.bucket_name ?? '—')}</span></div>
          </>
        )}
        {!isDB && !isS3 && (
          <div>IP: <span className={s.highlightGreen}>{String(res.ip_address ?? 'ожидается...')}</span></div>
        )}
      </div>
    </div>
  )
}