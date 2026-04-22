import { useState, useEffect, useRef } from 'react'
import type { AgentPlan, DeployStep, SSEEvent } from '../../../types/api'
import { agentExecute, readSSEStream } from '../../../api/api'
import m from './AgentPage.module.css'
import './AgentPage.mobile.css'

// ── Типы ──────────────────────────────────────────────────────────────────────

type View = 'market' | 'chat'

interface MarketPreset {
  id: string; industry: string; title: string; description: string
  icon: string; color: string; tags: string[]; includes: string[]
}

type ChatMsg =
  | { kind: 'user';     text: string }
  | { kind: 'thinking'; text: string; loading?: boolean }
  | { kind: 'plan';     plan: AgentPlan }
  | { kind: 'deploy';   steps: DeployStep[] }
  | { kind: 'error';    text: string }

const PRESETS: MarketPreset[] = [
  { id: 'retail',        industry: 'Ритейл',        title: 'Интернет-магазин',    description: 'Готовая e-commerce платформа с каталогом товаров, корзиной и обработкой заказов',            icon: '🛒', color: '#f97316', tags: ['E-commerce','B2C','1000+ users'],      includes: ['VM (App Server)','PostgreSQL','Redis Cache','S3 Storage'] },
  { id: 'medicine',      industry: 'Медицина',       title: 'Телемедицина',         description: 'Защищённая платформа для онлайн-приёмов, хранения записей и медкарт пациентов',            icon: '🏥', color: '#06b6d4', tags: ['152-ФЗ','HIPAA','Secure'],            includes: ['VM (Jitsi)','PostgreSQL','S3 (Записи)'] },
  { id: 'education',     industry: 'Образование',    title: 'LMS для школы',        description: 'Система управления обучением с курсами, тестами и личными кабинетами учеников',            icon: '🎓', color: '#8b5cf6', tags: ['Moodle','500 students','Backups'],     includes: ['VM (Moodle)','PostgreSQL','S3 (Материалы)'] },
  { id: 'manufacturing', industry: 'Производство',   title: 'Цифровой двойник',     description: 'Мониторинг датчиков в реальном времени, визуализация данных и аналитика склада',          icon: '🏭', color: '#64748b', tags: ['IoT','Grafana','MQTT'],               includes: ['VM (Grafana)','PostgreSQL (InfluxDB)','S3 (Дашборды)'] },
  { id: 'startup',       industry: 'Стартап',        title: 'MVP за 5 минут',       description: 'Минимальная инфраструктура для быстрого запуска продукта и первых пользователей',          icon: '🚀', color: 'var(--red-primary)', tags: ['MVP','Quick Start','300 users'], includes: ['VM (Backend)','PostgreSQL'] },
  { id: 'media',         industry: 'Медиа',          title: 'Медиаплатформа',       description: 'Публикация статей, видео и подкастов с CDN-раздачей и полнотекстовым поиском',             icon: '📰', color: '#ec4899', tags: ['CMS','CDN','800 readers'],            includes: ['VM (CMS)','PostgreSQL','S3 (Медиа 200GB)'] },
  { id: 'gameserver',    industry: 'Игры',           title: 'Игровой сервер',       description: 'Высокопроизводительный сервер для многопользовательских игр с низкой задержкой',          icon: '🎮', color: 'var(--green)',      tags: ['Multiplayer','Low Latency','100 CCU'], includes: ['VM (Game)','Redis (State)'] },
  { id: 'analytics',     industry: 'Аналитика',      title: 'Data Pipeline',        description: 'ETL-конвейер для сбора, обработки и визуализации бизнес-данных из разных источников',     icon: '📊', color: 'var(--yellow)',     tags: ['ETL','BI','BigData'],                 includes: ['VM (Analytics)','PostgreSQL','S3 (Data 500GB)'] },
  { id: 'devops',        industry: 'DevOps',         title: 'CI/CD окружение',      description: 'Автоматизация сборки, тестирования и деплоя с хранилищем артефактов',                     icon: '🔧', color: '#6366f1', tags: ['GitLab CI','Jenkins','Docker'],        includes: ['VM (CI Runner)','PostgreSQL','S3 (Артефакты)'] },
  { id: 'chat',          industry: 'Коммуникации',   title: 'Корпоративный чат',    description: 'Мессенджер для команды с каналами, файлами и интеграцией с корпоративными сервисами',    icon: '💬', color: '#14b8a6', tags: ['Rocket.Chat','150 users','Files'],     includes: ['VM (Chat)','PostgreSQL','Redis','S3 (Файлы)'] },
]

// ── Главная страница ──────────────────────────────────────────────────────────

export function AgentPage() {
  const [view, setView]                 = useState<View>('market')
  const [selectedPreset, setSelectedPreset] = useState<MarketPreset | null>(null)
  const [customInput, setCustomInput]   = useState('')

  const openPreset = (preset: MarketPreset) => { setSelectedPreset(preset); setView('chat') }
  const openCustom = () => { if (!customInput.trim()) return; setSelectedPreset(null); setView('chat') }
  const goBack = () => { setView('market'); setSelectedPreset(null); setCustomInput('') }

  if (view === 'chat') {
    return <AgentChat preset={selectedPreset} customMessage={selectedPreset ? undefined : customInput} onBack={goBack} />
  }
  return <AgentMarket onSelectPreset={openPreset} customInput={customInput} setCustomInput={setCustomInput} onCustomSubmit={openCustom} />
}

// ── Market ────────────────────────────────────────────────────────────────────

function AgentMarket({
  onSelectPreset, customInput, setCustomInput, onCustomSubmit,
}: {
  onSelectPreset: (p: MarketPreset) => void
  customInput: string
  setCustomInput: (v: string) => void
  onCustomSubmit: () => void
}) {
  const canSend = !!customInput.trim()

  return (
    <div className={m.page}>
      <div className={m.marketHeader}>
        <div className={m.marketTitleRow}>
          <h1 className={m.marketTitle}>Agent Market</h1>
          <span className={m.aiBadge}>AI POWERED</span>
        </div>
        <p className={m.marketSubtitle}>Выберите готовое решение по отрасли или опишите свой проект</p>
      </div>

      <div className={m.presetsGrid}>
        {PRESETS.map(preset => <PresetCard key={preset.id} preset={preset} onSelect={onSelectPreset} />)}
      </div>

      <div className={m.divider}>
        <div className={m.dividerLine} />
        <span className={m.dividerText}>или опишите свою задачу</span>
        <div className={m.dividerLine} />
      </div>

      <div className={m.customBox}>
        <div className={m.customBoxHeader}>
          <div>
            <div className={m.customBoxTitle}>Помощь агента</div>
            <div className={m.customBoxSub}>AI проанализирует и предложит оптимальный вариант</div>
          </div>
        </div>
        <div className={m.customInputRow}>
          <textarea
            className={m.customTextarea}
            value={customInput}
            onChange={e => setCustomInput(e.target.value)}
            rows={2}
            placeholder="Например: FastAPI сервис с PostgreSQL и Redis для 200 пользователей..."
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onCustomSubmit() } }}
          />
          <button
            className={`${m.customSendBtn} ${canSend ? m.customSendBtnActive : m.customSendBtnDisabled}`}
            onClick={onCustomSubmit}
            disabled={!canSend}
          >➤</button>
        </div>
        <div className={m.hints}>
          {['Django + PostgreSQL для 500 пользователей', 'Node.js API + Redis кеш', 'WordPress сайт с S3 хранилищем'].map(hint => (
            <button key={hint} className={m.hintBtn} onClick={() => setCustomInput(hint)}>{hint}</button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── PresetCard ────────────────────────────────────────────────────────────────

function PresetCard({ preset, onSelect }: { preset: MarketPreset; onSelect: (p: MarketPreset) => void }) {
  const [hovered, setHovered] = useState(false)

  return (
    <div
      className={m.presetCard}
      onClick={() => onSelect(preset)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        borderColor: hovered ? preset.color : undefined,
        boxShadow: hovered ? `0 0 24px ${preset.color}22` : 'none',
      } as React.CSSProperties}
    >
      <div className={m.presetTopBar}
        style={{ background: `linear-gradient(90deg, ${preset.color}, transparent)`, opacity: hovered ? 1 : 0.4 }} />

      <div className={m.presetCardHeader}>
        <div>
          <div className={m.presetIndustry} style={{ color: preset.color }}>{preset.industry}</div>
          <div className={m.presetTitle}>{preset.title}</div>
        </div>
        <span className={m.presetIcon}>{preset.icon}</span>
      </div>

      <p className={m.presetDesc}>{preset.description}</p>

      <div className={m.presetIncludes}>
        {preset.includes.map(item => <span key={item} className={m.includeTag}>{item}</span>)}
      </div>

      <div className={m.presetFooter}>
        <div className={m.presetTags}>
          {preset.tags.map(tag => (
            <span key={tag} className={m.presetTag} style={{ color: preset.color }}>#{tag}</span>
          ))}
        </div>
        <span className={m.presetCta} style={{ color: hovered ? preset.color : 'var(--text-dim)' }}>
          Развернуть →
        </span>
      </div>
    </div>
  )
}

// ── AgentChat ─────────────────────────────────────────────────────────────────

function AgentChat({ preset, customMessage, onBack }: {
  preset: MarketPreset | null; customMessage?: string; onBack: () => void
}) {
  const [messages, setMessages]         = useState<ChatMsg[]>([])
  const [streaming, setStreaming]       = useState(false)
  const [deploying, setDeploying]       = useState(false)
  const [currentPlan, setCurrentPlan]   = useState<AgentPlan | null>(null)
  const [input, setInput]               = useState('')
  const startedRef                      = useRef(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!startedRef.current) { startedRef.current = true; preset ? startPreset(preset.id) : customMessage && sendCustom(customMessage) }
  }, []) // eslint-disable-line

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  const addMsg = (msg: ChatMsg) => setMessages(prev => [...prev, msg])

  const startPreset = async (presetId: string) => {
    setStreaming(true)
    const token = sessionStorage.getItem('auth_token')
    try {
      const resp = await fetch('/api/v1/agent/preset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ preset_id: presetId }),
      })
      if (!resp.ok || !resp.body) throw new Error(`HTTP ${resp.status}`)
      await readSSEStream(resp.body.getReader(), handleSSEEvent)
    } catch { addMsg({ kind: 'error', text: 'Ошибка подключения к серверу' }) }
    finally { setStreaming(false) }
  }

  const sendCustom = async (text: string) => {
    if (!text.trim() || streaming || deploying) return
    setStreaming(true); setCurrentPlan(null)
    addMsg({ kind: 'user', text: text.trim() })
    const token = sessionStorage.getItem('auth_token')
    try {
      const resp = await fetch('/api/v1/agent/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ message: text.trim() }),
      })
      if (!resp.ok || !resp.body) throw new Error(`HTTP ${resp.status}`)
      await readSSEStream(resp.body.getReader(), handleSSEEvent)
    } catch { addMsg({ kind: 'error', text: 'Ошибка соединения. Проверьте что бэкенд запущен на :8080.' }) }
    finally { setStreaming(false) }
  }

  const handleSSEEvent = (ev: SSEEvent) => {
    if (ev.type === 'thinking')    addMsg({ kind: 'thinking', text: ev.content as string })
    else if (ev.type === 'plan') { setCurrentPlan(ev.content as AgentPlan); addMsg({ kind: 'plan', plan: ev.content as AgentPlan }) }
    else if (ev.type === 'error')  addMsg({ kind: 'error', text: ev.content as string })
  }

  const deploy = async () => {
    if (!currentPlan || deploying) return
    setDeploying(true); setCurrentPlan(null)
    const steps: DeployStep[] = []
    setMessages(prev => [...prev, { kind: 'deploy', steps: [] }])
    try {
      const reader = await agentExecute(currentPlan)
      await readSSEStream(reader, (ev: SSEEvent) => {
        if (ev.type === 'deploy_step') {
          steps.push(ev.content as DeployStep)
          setMessages(prev => {
            const idx = [...prev].reverse().findIndex(m => m.kind === 'deploy')
            if (idx === -1) return [...prev, { kind: 'deploy', steps: [...steps] }]
            const realIdx = prev.length - 1 - idx
            const next = [...prev]; next[realIdx] = { kind: 'deploy', steps: [...steps] }; return next
          })
        }
      })
    } catch { addMsg({ kind: 'error', text: 'Ошибка при развёртывании' }) }
    finally { setDeploying(false) }
  }

  const handleSend = () => { if (input.trim()) { sendCustom(input); setInput('') } }
  const isDisabled = streaming || deploying
  const canSend    = !!input.trim() && !isDisabled

  return (
    <div className={m.chatWrap}>
      <div className={m.chatHeader}>
        <button className={m.backBtn} onClick={onBack}>← Назад</button>
        {preset ? (
          <div className={m.chatPresetInfo}>
            <span className={m.chatPresetIcon}>{preset.icon}</span>
            <div>
              <div className={m.chatPresetTitle}>{preset.title}</div>
              <div className={m.chatPresetIndustry}>{preset.industry}</div>
            </div>
          </div>
        ) : (
          <div className={m.chatCustomTitle}>Помощь агента</div>
        )}
        {streaming && (
          <div className={m.streamingIndicator}>
            <span className={m.spinIcon}>⟳</span> Агент думает...
          </div>
        )}
      </div>

      <div className={m.chatMessages}>
        {messages.map((msg, i) => {
          if (msg.kind === 'user')     return <UserBubble     key={i} text={msg.text} />
          if (msg.kind === 'thinking') return <ThinkingLine   key={i} text={msg.text} />
          if (msg.kind === 'plan')     return <PlanCard       key={i} plan={msg.plan} onDeploy={deploy} deploying={deploying} active={currentPlan !== null && i === messages.length - 1} />
          if (msg.kind === 'deploy')   return <DeployTimeline key={i} steps={msg.steps} />
          if (msg.kind === 'error')    return <ErrorLine      key={i} text={msg.text} />
          return null
        })}
        {streaming && <LoadingDots />}
        <div ref={bottomRef} />
      </div>

      <div className={m.chatInputRow}>
        <textarea
          className={m.chatTextarea}
          value={input}
          onChange={e => setInput(e.target.value)}
          disabled={isDisabled}
          rows={1}
          placeholder="Уточните требования или задайте новый вопрос..."
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
        />
        <button
          className={`${m.chatSendBtn} ${canSend ? m.chatSendBtnActive : m.chatSendBtnDisabled}`}
          onClick={handleSend}
          disabled={!canSend}
        >➤</button>
      </div>
    </div>
  )
}

// ── Вспомогательные компоненты ────────────────────────────────────────────────

function UserBubble({ text }: { text: string }) {
  return <div className={m.userBubble}><div className={m.userBubbleInner}>{text}</div></div>
}

function ThinkingLine({ text }: { text: string }) {
  return (
    <div className={m.thinkingLine}>
      <div className={m.thinkingDot} />
      <span className={m.thinkingText}>{text}</span>
    </div>
  )
}

function ErrorLine({ text }: { text: string }) {
  return <div className={m.errorLine}>⚠️ {text}</div>
}

function LoadingDots() {
  return (
    <div className={m.loadingDots}>
      <div className={m.loadingDot} />
      <div className={m.loadingDot} />
      <div className={m.loadingDot} />
      <span className={m.loadingLabel}>Подбираю конфигурацию...</span>
    </div>
  )
}

// ── PlanCard ──────────────────────────────────────────────────────────────────

const SVC_ICON:  Record<string, string> = { vm: '🖥️', database: '🗄️', object_storage: '🪣' }
const SVC_LABEL: Record<string, string> = { vm: 'Virtual Machine', database: 'Database', object_storage: 'Object Storage' }

function PlanCard({ plan, onDeploy, deploying, active }: {
  plan: AgentPlan; onDeploy: () => void; deploying: boolean; active: boolean
}) {
  return (
    <div className={`${m.planCard} ${active ? m.planCardActive : m.planCardDone}`}>
      <div className={m.planSummary}>📋 {plan.summary}</div>

      <div className={m.planServices}>
        {plan.services.map((svc, i) => (
          <div key={i} className={m.planService}>
            <div>
              <div className={m.planServiceName}>
                {SVC_ICON[svc.service_type] ?? '⚙️'} {svc.name}
                <span className={m.planServiceType}>{SVC_LABEL[svc.service_type] ?? svc.service_type}</span>
              </div>
              <div className={m.planServiceFlavor}>{svc.flavor_name}</div>
              {svc.reason && <div className={m.planServiceReason}>💡 {svc.reason}</div>}
            </div>
            <div className={m.planServiceCost}>${svc.cost_per_hour.toFixed(3)}/ч</div>
          </div>
        ))}
      </div>

      <div className={m.planFooter}>
        <div>
          <span className={m.planCostLabel}>Итого: </span>
          <span className={m.planCostValue}>${plan.total_cost_per_hour.toFixed(3)}/ч</span>
          <span className={m.planCostMonth}>≈ ${(plan.total_cost_per_hour * 720).toFixed(0)}/мес</span>
        </div>
        {active && (
          <button className="btn-primary" onClick={onDeploy} disabled={deploying}>
            {deploying ? '⏳ Развёртываю...' : '🚀 Развернуть'}
          </button>
        )}
      </div>
    </div>
  )
}

// ── DeployTimeline ────────────────────────────────────────────────────────────

function DeployTimeline({ steps }: { steps: DeployStep[] }) {
  const isDone    = steps.some(s => s.step === 'done')
  const realSteps = steps.filter(s => s.step !== 'done')

  return (
    <div className={`${m.deployCard} ${isDone ? m.deployCardDone : m.deployCardPending}`}>
      <div className={m.deployTitle}>
        {isDone ? '✅ Развёртывание завершено' : '⚙️ Идёт развёртывание...'}
      </div>
      <div className={m.deploySteps}>
        {realSteps.map((step, i) => (
          <div key={i} className={m.deployStep}>
            <div className={`${m.deployStepIcon} ${step.status === 'success' ? m.stepSuccess : step.status === 'error' ? m.stepError : m.stepInProgress}`}>
              {step.status === 'success' ? '✓' : step.status === 'error' ? '✗' : '⟳'}
            </div>
            <span className={m.deployStepMsg}>{step.message}</span>
          </div>
        ))}
      </div>
    </div>
  )
}