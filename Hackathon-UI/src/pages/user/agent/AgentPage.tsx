import { useState } from 'react'
import type { AgentPlan, DeployStep, SSEEvent } from '../../../types/api'
import { agentExecute, readSSEStream } from '../../../api/api'

// ── Типы ──────────────────────────────────────────────────────────────────────

type View = 'market' | 'chat'

interface MarketPreset {
  id: string
  industry: string
  title: string
  description: string
  icon: string
  color: string
  tags: string[]
  includes: string[]
}

type ChatMsg =
  | { kind: 'user';     text: string }
  | { kind: 'thinking'; text: string; loading?: boolean }
  | { kind: 'plan';     plan: AgentPlan }
  | { kind: 'deploy';   steps: DeployStep[] }
  | { kind: 'error';    text: string }

// ── Пресеты — 10 готовых решений ─────────────────────────────────────────────

const PRESETS: MarketPreset[] = [
  {
    id: 'retail',
    industry: 'Ритейл',
    title: 'Интернет-магазин',
    description: 'Готовая e-commerce платформа с каталогом товаров, корзиной и обработкой заказов',
    icon: '🛒',
    color: '#f97316',
    tags: ['E-commerce', 'B2C', '1000+ users'],
    includes: ['VM (App Server)', 'PostgreSQL', 'Redis Cache', 'S3 Storage'],
  },
  {
    id: 'medicine',
    industry: 'Медицина',
    title: 'Телемедицина',
    description: 'Защищённая платформа для онлайн-приёмов, хранения записей и медкарт пациентов',
    icon: '🏥',
    color: '#06b6d4',
    tags: ['152-ФЗ', 'HIPAA', 'Secure'],
    includes: ['VM (Jitsi)', 'PostgreSQL', 'S3 (Записи)'],
  },
  {
    id: 'education',
    industry: 'Образование',
    title: 'LMS для школы',
    description: 'Система управления обучением с курсами, тестами и личными кабинетами учеников',
    icon: '🎓',
    color: '#8b5cf6',
    tags: ['Moodle', '500 students', 'Backups'],
    includes: ['VM (Moodle)', 'PostgreSQL', 'S3 (Материалы)'],
  },
  {
    id: 'manufacturing',
    industry: 'Производство',
    title: 'Цифровой двойник',
    description: 'Мониторинг датчиков в реальном времени, визуализация данных и аналитика склада',
    icon: '🏭',
    color: '#64748b',
    tags: ['IoT', 'Grafana', 'MQTT'],
    includes: ['VM (Grafana)', 'PostgreSQL (InfluxDB)', 'S3 (Дашборды)'],
  },
  {
    id: 'startup',
    industry: 'Стартап',
    title: 'MVP за 5 минут',
    description: 'Минимальная инфраструктура для быстрого запуска продукта и первых пользователей',
    icon: '🚀',
    color: '#3b82f6',
    tags: ['MVP', 'Quick Start', '300 users'],
    includes: ['VM (Backend)', 'PostgreSQL'],
  },
  {
    id: 'media',
    industry: 'Медиа',
    title: 'Медиаплатформа',
    description: 'Публикация статей, видео и подкастов с CDN-раздачей и полнотекстовым поиском',
    icon: '📰',
    color: '#ec4899',
    tags: ['CMS', 'CDN', '800 readers'],
    includes: ['VM (CMS)', 'PostgreSQL', 'S3 (Медиа 200GB)'],
  },
  {
    id: 'gameserver',
    industry: 'Игры',
    title: 'Игровой сервер',
    description: 'Высокопроизводительный сервер для многопользовательских игр с низкой задержкой',
    icon: '🎮',
    color: '#10b981',
    tags: ['Multiplayer', 'Low Latency', '100 CCU'],
    includes: ['VM (Game)', 'Redis (State)'],
  },
  {
    id: 'analytics',
    industry: 'Аналитика',
    title: 'Data Pipeline',
    description: 'ETL-конвейер для сбора, обработки и визуализации бизнес-данных из разных источников',
    icon: '📊',
    color: '#f59e0b',
    tags: ['ETL', 'BI', 'BigData'],
    includes: ['VM (Analytics)', 'PostgreSQL', 'S3 (Data 500GB)'],
  },
  {
    id: 'devops',
    industry: 'DevOps',
    title: 'CI/CD окружение',
    description: 'Автоматизация сборки, тестирования и деплоя с хранилищем артефактов',
    icon: '🔧',
    color: '#6366f1',
    tags: ['GitLab CI', 'Jenkins', 'Docker'],
    includes: ['VM (CI Runner)', 'PostgreSQL', 'S3 (Артефакты)'],
  },
  {
    id: 'chat',
    industry: 'Коммуникации',
    title: 'Корпоративный чат',
    description: 'Мессенджер для команды с каналами, файлами и интеграцией с корпоративными сервисами',
    icon: '💬',
    color: '#14b8a6',
    tags: ['Rocket.Chat', '150 users', 'Files'],
    includes: ['VM (Chat)', 'PostgreSQL', 'Redis', 'S3 (Файлы)'],
  },
]

// ── Главная страница ──────────────────────────────────────────────────────────

export function AgentPage() {
  const [view, setView] = useState<View>('market')
  const [selectedPreset, setSelectedPreset] = useState<MarketPreset | null>(null)
  const [customInput, setCustomInput] = useState('')

  const openPreset = (preset: MarketPreset) => {
    setSelectedPreset(preset)
    setView('chat')
  }

  const openCustom = () => {
    if (!customInput.trim()) return
    setSelectedPreset(null)
    setView('chat')
  }

  const goBack = () => {
    setView('market')
    setSelectedPreset(null)
    setCustomInput('')
  }

  if (view === 'chat') {
    return (
      <AgentChat
        preset={selectedPreset}
        customMessage={selectedPreset ? undefined : customInput}
        onBack={goBack}
      />
    )
  }

  return <AgentMarket onSelectPreset={openPreset} customInput={customInput} setCustomInput={setCustomInput} onCustomSubmit={openCustom} />
}

// ── Market — страница с карточками ───────────────────────────────────────────

function AgentMarket({
  onSelectPreset,
  customInput,
  setCustomInput,
  onCustomSubmit,
}: {
  onSelectPreset: (p: MarketPreset) => void
  customInput: string
  setCustomInput: (v: string) => void
  onCustomSubmit: () => void
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>

      {/* ── Шапка ──────────────────────────────────────────────────────── */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#f1f5f9', letterSpacing: '-0.5px' }}>
            Agent Market
          </h1>
          <span style={{
            fontSize: 10, fontWeight: 700, letterSpacing: '0.1em',
            background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
            color: '#fff', padding: '3px 10px', borderRadius: 20,
          }}>AI POWERED</span>
        </div>
        <p style={{ margin: 0, fontSize: 14, color: '#64748b' }}>
          Выберите готовое решение по отрасли или опишите свой проект
        </p>
      </div>

      {/* ── Карточки пресетов ──────────────────────────────────────────── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
        gap: 14,
        marginBottom: 32,
      }}>
        {PRESETS.map(preset => (
          <PresetCard key={preset.id} preset={preset} onSelect={onSelectPreset} />
        ))}
      </div>

      {/* ── Разделитель ────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
        <div style={{ flex: 1, height: 1, background: '#1e293b' }} />
        <span style={{ fontSize: 12, color: '#475569', whiteSpace: 'nowrap' }}>
          или опишите свою задачу
        </span>
        <div style={{ flex: 1, height: 1, background: '#1e293b' }} />
      </div>

      {/* ── Свой запрос ────────────────────────────────────────────────── */}
      <div style={{
        background: '#0f172a',
        border: '1px solid #1e293b',
        borderRadius: 16, padding: 20,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <span style={{ fontSize: 22 }}>✍️</span>
          <div>
            <div style={{ fontWeight: 700, color: '#f1f5f9', fontSize: 15 }}>Свой запрос</div>
            <div style={{ fontSize: 12, color: '#64748b' }}>AI проанализирует и предложит оптимальную инфраструктуру</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <textarea
            value={customInput}
            onChange={e => setCustomInput(e.target.value)}
            rows={2}
            placeholder="Например: FastAPI сервис с PostgreSQL и Redis для 200 пользователей, нужно хранилище для загрузки файлов..."
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                onCustomSubmit()
              }
            }}
            style={{
              flex: 1, background: '#1e293b', color: '#f1f5f9',
              border: '1px solid #334155', borderRadius: 12,
              padding: '10px 14px', resize: 'none', fontSize: 14,
              outline: 'none', fontFamily: 'inherit', lineHeight: 1.5,
            }}
          />
          <button
            onClick={onCustomSubmit}
            disabled={!customInput.trim()}
            style={{
              padding: '0 20px', borderRadius: 12,
              background: customInput.trim()
                ? 'linear-gradient(135deg, #3b82f6, #6366f1)'
                : '#1e293b',
              color: customInput.trim() ? '#fff' : '#475569',
              border: 'none', cursor: customInput.trim() ? 'pointer' : 'not-allowed',
              fontSize: 18, flexShrink: 0, fontWeight: 700,
              transition: 'all 0.15s',
            }}
          >
            ➤
          </button>
        </div>
        <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {[
            'Django + PostgreSQL для 500 пользователей',
            'Node.js API + Redis кеш',
            'WordPress сайт с S3 хранилищем',
          ].map(hint => (
            <button
              key={hint}
              onClick={() => setCustomInput(hint)}
              style={{
                fontSize: 11, padding: '4px 10px',
                background: '#1e293b', border: '1px solid #334155',
                borderRadius: 8, color: '#64748b', cursor: 'pointer',
                transition: 'all 0.1s',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = '#3b82f6'; e.currentTarget.style.color = '#93c5fd' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = '#334155'; e.currentTarget.style.color = '#64748b' }}
            >
              {hint}
            </button>
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
      onClick={() => onSelect(preset)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered ? '#0f172a' : '#080f1a',
        border: `1px solid ${hovered ? preset.color : '#1e293b'}`,
        borderRadius: 14, padding: 18, cursor: 'pointer',
        transition: 'all 0.18s', position: 'relative', overflow: 'hidden',
        boxShadow: hovered ? `0 0 24px ${preset.color}22` : 'none',
      }}
    >
      {/* Цветная полоска сверху */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 3,
        background: `linear-gradient(90deg, ${preset.color}, transparent)`,
        opacity: hovered ? 1 : 0.4, transition: 'opacity 0.18s',
      }} />

      {/* Шапка карточки */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
        <div>
          <span style={{ fontSize: 10, color: preset.color, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            {preset.industry}
          </span>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#f1f5f9', marginTop: 2 }}>
            {preset.title}
          </div>
        </div>
        <span style={{ fontSize: 28, flexShrink: 0 }}>{preset.icon}</span>
      </div>

      {/* Описание */}
      <p style={{ margin: '0 0 12px', fontSize: 13, color: '#64748b', lineHeight: 1.5 }}>
        {preset.description}
      </p>

      {/* Что включает */}
      <div style={{ marginBottom: 12 }}>
        {preset.includes.map(item => (
          <span key={item} style={{
            display: 'inline-block', fontSize: 11,
            background: '#1e293b', color: '#94a3b8',
            padding: '2px 8px', borderRadius: 6, margin: '2px 3px 2px 0',
          }}>
            {item}
          </span>
        ))}
      </div>

      {/* Теги */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {preset.tags.map(tag => (
            <span key={tag} style={{
              fontSize: 10, fontWeight: 600,
              color: preset.color, opacity: 0.8,
            }}>#{tag}</span>
          ))}
        </div>
        <span style={{
          fontSize: 12, color: hovered ? preset.color : '#475569',
          fontWeight: 600, transition: 'color 0.18s',
        }}>
          Развернуть →
        </span>
      </div>
    </div>
  )
}

// ── AgentChat — чат с AI и деплоем ───────────────────────────────────────────

function AgentChat({
  preset,
  customMessage,
  onBack,
}: {
  preset: MarketPreset | null
  customMessage?: string
  onBack: () => void
}) {
  const [messages, setMessages] = useState<ChatMsg[]>([])
  const [streaming, setStreaming] = useState(false)
  const [deploying, setDeploying] = useState(false)
  const [currentPlan, setCurrentPlan] = useState<AgentPlan | null>(null)
  const [input, setInput] = useState('')
  const [started, setStarted] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  // Auto-start on mount
  useEffect(() => {
    if (!started) {
      setStarted(true)
      if (preset) {
        startPreset(preset.id)
      } else if (customMessage) {
        sendCustom(customMessage)
      }
    }
  }, []) // eslint-disable-line

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const addMsg = (msg: ChatMsg) => setMessages(prev => [...prev, msg])

  // ── Пресет — вызывает /agent/preset без AI ────────────────────────────
  const startPreset = async (presetId: string) => {
    setStreaming(true)
    const token = sessionStorage.getItem('auth_token')
    try {
      const resp = await fetch('/api/v1/agent/preset', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ preset_id: presetId }),
      })
      if (!resp.ok || !resp.body) throw new Error(`HTTP ${resp.status}`)
      await readSSEStream(resp.body.getReader(), handleSSEEvent)
    } catch {
      addMsg({ kind: 'error', text: 'Ошибка подключения к серверу' })
    } finally {
      setStreaming(false)
    }
  }

  // ── Свободный запрос — вызывает /agent/chat через AI ─────────────────
  const sendCustom = async (text: string) => {
    if (!text.trim() || streaming || deploying) return
    setStreaming(true)
    setCurrentPlan(null)
    addMsg({ kind: 'user', text: text.trim() })
    const token = sessionStorage.getItem('auth_token')
    try {
      const resp = await fetch('/api/v1/agent/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ message: text.trim() }),
      })
      if (!resp.ok || !resp.body) throw new Error(`HTTP ${resp.status}`)
      await readSSEStream(resp.body.getReader(), handleSSEEvent)
    } catch {
      addMsg({ kind: 'error', text: 'Ошибка соединения. Проверьте что бэкенд запущен на :8080.' })
    } finally {
      setStreaming(false)
    }
  }

  const handleSSEEvent = (ev: SSEEvent) => {
    if (ev.type === 'thinking') {
      addMsg({ kind: 'thinking', text: ev.content as string })
    } else if (ev.type === 'plan') {
      const plan = ev.content as AgentPlan
      setCurrentPlan(plan)
      addMsg({ kind: 'plan', plan })
    } else if (ev.type === 'error') {
      addMsg({ kind: 'error', text: ev.content as string })
    }
  }

  // ── Деплой ────────────────────────────────────────────────────────────
  const deploy = async () => {
    if (!currentPlan || deploying) return
    setDeploying(true)
    setCurrentPlan(null)
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
            const next = [...prev]
            next[realIdx] = { kind: 'deploy', steps: [...steps] }
            return next
          })
        }
      })
    } catch {
      addMsg({ kind: 'error', text: 'Ошибка при развёртывании' })
    } finally {
      setDeploying(false)
    }
  }

  const handleSend = () => {
    if (input.trim()) {
      sendCustom(input)
      setInput('')
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

      {/* ── Шапка чата ─────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        paddingBottom: 14, borderBottom: '1px solid #1e293b', marginBottom: 16,
        flexShrink: 0,
      }}>
        <button
          onClick={onBack}
          style={{
            background: '#1e293b', border: '1px solid #334155',
            borderRadius: 8, color: '#94a3b8', cursor: 'pointer',
            padding: '6px 12px', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6,
          }}
        >
          ← Назад
        </button>
        {preset && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 20 }}>{preset.icon}</span>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#f1f5f9' }}>{preset.title}</div>
              <div style={{ fontSize: 11, color: '#64748b' }}>{preset.industry}</div>
            </div>
          </div>
        )}
        {!preset && (
          <div style={{ fontSize: 14, fontWeight: 700, color: '#f1f5f9' }}>
            ✍️ Свой запрос
          </div>
        )}
        {streaming && (
          <div style={{
            marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6,
            fontSize: 12, color: '#3b82f6',
          }}>
            <span style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }}>⟳</span>
            Агент думает...
          </div>
        )}
      </div>

      {/* ── Сообщения ──────────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {messages.map((msg, i) => {
          if (msg.kind === 'user')     return <UserBubble key={i} text={msg.text} />
          if (msg.kind === 'thinking') return <ThinkingLine key={i} text={msg.text} />
          if (msg.kind === 'plan')     return <PlanCard key={i} plan={msg.plan} onDeploy={deploy} deploying={deploying} active={currentPlan !== null && i === messages.length - 1} />
          if (msg.kind === 'deploy')   return <DeployTimeline key={i} steps={msg.steps} />
          if (msg.kind === 'error')    return <ErrorLine key={i} text={msg.text} />
          return null
        })}
        {streaming && <LoadingDots />}
        <div ref={bottomRef} />
      </div>

      {/* ── Ввод дополнительного запроса ───────────────────────────────── */}
      <div style={{
        borderTop: '1px solid #1e293b', paddingTop: 12, flexShrink: 0,
        display: 'flex', gap: 8, alignItems: 'flex-end', marginTop: 8,
      }}>
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          disabled={streaming || deploying}
          rows={1}
          placeholder="Уточните требования или задайте новый вопрос..."
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              handleSend()
            }
          }}
          style={{
            flex: 1, background: '#0f172a', color: '#f1f5f9',
            border: '1px solid #1e293b', borderRadius: 10,
            padding: '9px 14px', resize: 'none', fontSize: 13,
            outline: 'none', fontFamily: 'inherit',
            opacity: streaming || deploying ? 0.5 : 1,
          }}
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || streaming || deploying}
          style={{
            padding: '9px 16px', borderRadius: 10,
            background: input.trim() && !streaming && !deploying
              ? 'linear-gradient(135deg, #3b82f6, #6366f1)'
              : '#1e293b',
            color: input.trim() && !streaming && !deploying ? '#fff' : '#475569',
            border: 'none', cursor: input.trim() ? 'pointer' : 'not-allowed',
            fontSize: 16, flexShrink: 0,
          }}
        >
          ➤
        </button>
      </div>
    </div>
  )
}

// ── Вспомогательные компоненты чата ──────────────────────────────────────────

function UserBubble({ text }: { text: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
      <div style={{
        background: 'linear-gradient(135deg, #1d4ed8, #4f46e5)',
        color: '#fff', borderRadius: '16px 16px 4px 16px',
        padding: '9px 14px', maxWidth: '70%', fontSize: 14,
      }}>{text}</div>
    </div>
  )
}

function ThinkingLine({ text }: { text: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{
        width: 6, height: 6, borderRadius: '50%',
        background: '#3b82f6', flexShrink: 0,
      }} />
      <span style={{ fontSize: 13, color: '#475569', fontStyle: 'italic' }}>{text}</span>
    </div>
  )
}

function ErrorLine({ text }: { text: string }) {
  return (
    <div style={{
      background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
      borderRadius: 10, padding: '10px 14px', color: '#f87171', fontSize: 13,
    }}>
      ⚠️ {text}
    </div>
  )
}

function LoadingDots() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 0' }}>
      {[0, 1, 2].map(i => (
        <div key={i} style={{
          width: 6, height: 6, borderRadius: '50%', background: '#3b82f6',
          animation: `bounce 0.8s ${i * 0.2}s infinite ease-in-out`,
        }} />
      ))}
      <span style={{ fontSize: 12, color: '#475569', marginLeft: 4 }}>
        Подбираю конфигурацию...
      </span>
    </div>
  )
}

// ── PlanCard ──────────────────────────────────────────────────────────────────

const SVC_ICON: Record<string, string> = { vm: '🖥️', database: '🗄️', object_storage: '🪣' }
const SVC_LABEL: Record<string, string> = { vm: 'Virtual Machine', database: 'Database', object_storage: 'Object Storage' }

function PlanCard({
  plan, onDeploy, deploying, active,
}: {
  plan: AgentPlan
  onDeploy: () => void
  deploying: boolean
  active: boolean
}) {
  return (
    <div style={{
      background: '#0a1628',
      border: `1px solid ${active ? '#3b82f6' : '#1e293b'}`,
      borderRadius: 14, padding: 18,
      boxShadow: active ? '0 0 20px rgba(59,130,246,0.15)' : 'none',
      transition: 'all 0.2s',
    }}>
      <div style={{ fontSize: 13, color: '#94a3b8', marginBottom: 14, lineHeight: 1.5 }}>
        📋 {plan.summary}
      </div>

      {/* Сервисы */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
        {plan.services.map((svc, i) => (
          <div key={i} style={{
            background: '#0f172a', borderRadius: 10, padding: '10px 14px',
            border: '1px solid #1e293b',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <div>
              <div style={{ fontWeight: 600, color: '#e2e8f0', fontSize: 14 }}>
                {SVC_ICON[svc.service_type] ?? '⚙️'} {svc.name}
                <span style={{ marginLeft: 8, fontSize: 11, color: '#475569', fontWeight: 400 }}>
                  {SVC_LABEL[svc.service_type] ?? svc.service_type}
                </span>
              </div>
              <div style={{ fontSize: 12, color: '#475569', marginTop: 3 }}>{svc.flavor_name}</div>
              {svc.reason && (
                <div style={{ fontSize: 11, color: '#3b82f6', marginTop: 3 }}>💡 {svc.reason}</div>
              )}
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 12 }}>
              <div style={{ fontFamily: 'monospace', fontSize: 13, color: '#34d399' }}>
                ${svc.cost_per_hour.toFixed(3)}/ч
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Итого + кнопка */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        borderTop: '1px solid #1e293b', paddingTop: 14,
      }}>
        <div>
          <span style={{ fontSize: 13, color: '#64748b' }}>Итого: </span>
          <span style={{ fontSize: 15, fontWeight: 700, color: '#f1f5f9', fontFamily: 'monospace' }}>
            ${plan.total_cost_per_hour.toFixed(3)}/ч
          </span>
          <span style={{ fontSize: 11, color: '#475569', marginLeft: 8 }}>
            ≈ ${(plan.total_cost_per_hour * 720).toFixed(0)}/мес
          </span>
        </div>
        {active && (
          <button
            onClick={onDeploy}
            disabled={deploying}
            style={{
              background: deploying
                ? '#1e293b'
                : 'linear-gradient(135deg, #16a34a, #15803d)',
              color: deploying ? '#475569' : '#fff',
              border: 'none', borderRadius: 10,
              padding: '9px 22px', fontWeight: 700, fontSize: 14,
              cursor: deploying ? 'not-allowed' : 'pointer',
              transition: 'all 0.15s',
            }}
          >
            {deploying ? '⏳ Развёртываю...' : '🚀 Развернуть'}
          </button>
        )}
      </div>
    </div>
  )
}

// ── DeployTimeline ────────────────────────────────────────────────────────────

function DeployTimeline({ steps }: { steps: DeployStep[] }) {
  const isDone = steps.some(s => s.step === 'done')
  const realSteps = steps.filter(s => s.step !== 'done')

  return (
    <div style={{
      background: '#0a1628',
      border: `1px solid ${isDone ? '#16a34a' : '#1e293b'}`,
      borderRadius: 14, padding: 18,
      transition: 'border-color 0.3s',
    }}>
      <div style={{ fontWeight: 700, color: '#f1f5f9', fontSize: 14, marginBottom: 14 }}>
        {isDone ? '✅ Развёртывание завершено' : '⚙️ Идёт развёртывание...'}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {realSteps.map((step, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
              background: step.status === 'success' ? '#16a34a' : step.status === 'error' ? '#dc2626' : '#3b82f6',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 10, color: '#fff', fontWeight: 700,
            }}>
              {step.status === 'success' ? '✓' : step.status === 'error' ? '✗' : '⟳'}
            </div>
            <span style={{ fontSize: 13, color: '#cbd5e1' }}>{step.message}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── SSE reader helper ─────────────────────────────────────────────────────────


// ── Хуки нужны в AgentChat ────────────────────────────────────────────────────
import { useEffect, useRef } from 'react'

// CSS keyframes для анимаций (инжектируем один раз)
if (typeof document !== 'undefined' && !document.getElementById('agent-keyframes')) {
  const style = document.createElement('style')
  style.id = 'agent-keyframes'
  style.textContent = `
    @keyframes bounce {
      0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
      40% { transform: translateY(-6px); opacity: 1; }
    }
    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
  `
  document.head.appendChild(style)
}
