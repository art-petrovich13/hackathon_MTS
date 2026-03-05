import { useState, useRef, useEffect } from 'react'
import type { AgentPlan, DeployStep, SSEEvent } from '../../../../types/api'
import { agentChat, agentExecute, readSSEStream } from '../../../../api/api'
import { ThinkingBubble } from './ThinkingBubble'
import { PlanCard } from './PlanCard'
import { DeployTimeline } from './DeployTimeline'

// ── Типы сообщений в чате ──────────────────────────────────────────────────────
type Msg =
  | { kind: 'user';     text: string }
  | { kind: 'thinking'; text: string }
  | { kind: 'plan';     plan: AgentPlan }
  | { kind: 'deploy';   steps: DeployStep[] }
  | { kind: 'error';    text: string }

const EXAMPLES = [
  'Разверни Django + PostgreSQL для 500 пользователей',
  'Мне нужен Redis кеш для моего API',
  'Создай S3 хранилище для медиафайлов',
  'Node.js бэкенд + MySQL + объектное хранилище',
]

// ── Основной компонент чата ────────────────────────────────────────────────────
export function AgentChat() {
  const [messages, setMessages]     = useState<Msg[]>([])
  const [input, setInput]           = useState('')
  const [streaming, setStreaming]   = useState(false)
  const [deploying, setDeploying]   = useState(false)
  const [currentPlan, setCurrentPlan] = useState<AgentPlan | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const addMsg = (msg: Msg) => setMessages(prev => [...prev, msg])

  // ── Отправка сообщения агенту ──────────────────────────────────────────────
  const send = async (text: string) => {
    if (!text.trim() || streaming || deploying) return
    const trimmed = text.trim()
    setInput('')
    setStreaming(true)
    setCurrentPlan(null)
    addMsg({ kind: 'user', text: trimmed })

    try {
      const reader = await agentChat(trimmed)
      await readSSEStream(reader, (ev: SSEEvent) => {
        if (ev.type === 'thinking') {
          addMsg({ kind: 'thinking', text: ev.content as string })
        } else if (ev.type === 'plan') {
          const plan = ev.content as AgentPlan
          setCurrentPlan(plan)
          addMsg({ kind: 'plan', plan })
        } else if (ev.type === 'error') {
          addMsg({ kind: 'error', text: ev.content as string })
        }
      })
    } catch {
      addMsg({ kind: 'error', text: 'Ошибка соединения с агентом. Проверьте что бэкенд запущен.' })
    } finally {
      setStreaming(false)
    }
  }

  // ── Деплой одобренного плана ──────────────────────────────────────────────
  const deploy = async () => {
    if (!currentPlan || deploying) return
    setDeploying(true)
    setCurrentPlan(null) // убираем кнопку

    const steps: DeployStep[] = []
    // Добавляем первый deploy-msg сразу
    setMessages(prev => [...prev, { kind: 'deploy', steps: [] }])

    try {
      const reader = await agentExecute(currentPlan)
      await readSSEStream(reader, (ev: SSEEvent) => {
        if (ev.type === 'deploy_step') {
          const step = ev.content as DeployStep
          steps.push(step)
          // Обновляем последнее deploy-сообщение
          setMessages(prev => {
            const idx = prev.findLastIndex(m => m.kind === 'deploy')
            if (idx === -1) return [...prev, { kind: 'deploy', steps: [...steps] }]
            const next = [...prev]
            next[idx] = { kind: 'deploy', steps: [...steps] }
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

  const isDisabled = streaming || deploying

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, paddingTop: 16 }}>

      {/* ── Список сообщений ─────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* Пустое состояние с примерами */}
        {messages.length === 0 && (
          <div style={{ textAlign: 'center', paddingTop: 32 }}>
            <div style={{ fontSize: 52, marginBottom: 12 }}>🤖</div>
            <p style={{ color: '#64748b', fontSize: 14, marginBottom: 20 }}>
              Напишите задачу или выберите пример:
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center' }}>
              {EXAMPLES.map(ex => (
                <button
                  key={ex}
                  onClick={() => send(ex)}
                  style={{
                    width: '100%', maxWidth: 460, padding: '10px 16px',
                    background: '#1e293b', border: '1px solid #334155',
                    borderRadius: 12, color: '#94a3b8', cursor: 'pointer',
                    textAlign: 'left', fontSize: 13, transition: 'border-color 0.15s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = '#4f46e5')}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = '#334155')}
                >
                  💬 {ex}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Сообщения */}
        {messages.map((msg, i) => {
          if (msg.kind === 'user')     return <UserBubble    key={i} text={msg.text} />
          if (msg.kind === 'thinking') return <ThinkingBubble key={i} text={msg.text} />
          if (msg.kind === 'plan')     return <PlanCard       key={i} plan={msg.plan} onDeploy={deploy} deploying={deploying} />
          if (msg.kind === 'deploy')   return <DeployTimeline key={i} steps={msg.steps} />
          if (msg.kind === 'error')    return <ErrorBubble    key={i} text={msg.text} />
          return null
        })}

        {/* Индикатор "агент думает" во время стриминга */}
        {streaming && <ThinkingBubble isLoading />}

        <div ref={bottomRef} />
      </div>

      {/* ── Поле ввода ───────────────────────────────────────────────────── */}
      <div style={{
        borderTop: '1px solid #334155', paddingTop: 12,
        display: 'flex', gap: 10, alignItems: 'flex-end',
      }}>
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          disabled={isDisabled}
          rows={2}
          placeholder="Опишите задачу... (Enter — отправить, Shift+Enter — перенос строки)"
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              send(input)
            }
          }}
          style={{
            flex: 1, background: '#1e293b', color: '#f1f5f9',
            border: '1px solid #334155', borderRadius: 12,
            padding: '10px 14px', resize: 'none', fontSize: 14,
            outline: 'none', fontFamily: 'inherit', lineHeight: 1.5,
            opacity: isDisabled ? 0.6 : 1,
          }}
        />
        <button
          onClick={() => send(input)}
          disabled={isDisabled || !input.trim()}
          style={{
            padding: '0 20px', height: 46,
            background: isDisabled || !input.trim() ? '#1e293b' : '#1d4ed8',
            color: isDisabled || !input.trim() ? '#475569' : '#fff',
            border: '1px solid #334155', borderRadius: 12,
            cursor: isDisabled || !input.trim() ? 'not-allowed' : 'pointer',
            fontSize: 20, transition: 'all 0.15s', flexShrink: 0,
          }}
        >
          {streaming ? '⏳' : '➤'}
        </button>
      </div>
    </div>
  )
}

// ── Вспомогательные компоненты ─────────────────────────────────────────────────

function UserBubble({ text }: { text: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
      <div style={{
        background: '#1d4ed8', color: '#fff',
        borderRadius: '18px 18px 4px 18px',
        padding: '10px 16px', maxWidth: '70%', fontSize: 14,
      }}>
        {text}
      </div>
    </div>
  )
}

function ErrorBubble({ text }: { text: string }) {
  return (
    <div style={{
      background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.3)',
      borderRadius: 12, padding: '10px 16px', color: '#fca5a5', fontSize: 14,
    }}>
      ⚠️ {text}
    </div>
  )
}
