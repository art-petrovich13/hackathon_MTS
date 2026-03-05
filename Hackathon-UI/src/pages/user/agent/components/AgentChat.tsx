import { useState, useRef, useEffect } from 'react'
import type { AgentPlan, DeployStep, SSEEvent } from '../../../../types/api'
import { agentChat, agentExecute, readSSEStream } from '../../../../api/api'
import { ThinkingBubble } from './ThinkingBubble'
import { PlanCard } from './PlanCard'
import { DeployTimeline } from './DeployTimeline'
import s from './AgentPage.module.css'

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

export function AgentChat() {
  const [messages, setMessages]       = useState<Msg[]>([])
  const [input, setInput]             = useState('')
  const [streaming, setStreaming]     = useState(false)
  const [deploying, setDeploying]     = useState(false)
  const [currentPlan, setCurrentPlan] = useState<AgentPlan | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const addMsg = (msg: Msg) => setMessages(prev => [...prev, msg])

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
        if (ev.type === 'thinking') addMsg({ kind: 'thinking', text: ev.content as string })
        else if (ev.type === 'plan') { setCurrentPlan(ev.content as AgentPlan); addMsg({ kind: 'plan', plan: ev.content as AgentPlan }) }
        else if (ev.type === 'error') addMsg({ kind: 'error', text: ev.content as string })
      })
    } catch {
      addMsg({ kind: 'error', text: 'Ошибка соединения с агентом. Проверьте что бэкенд запущен.' })
    } finally {
      setStreaming(false)
    }
  }

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
          const step = ev.content as DeployStep
          steps.push(step)
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
  const canSend    = !isDisabled && !!input.trim()

  return (
    <div className={s.chat}>

      {/* ── Сообщения ────────────────────────────────────────────────────── */}
      <div className={s.messages}>

        {messages.length === 0 && (
          <div className={s.empty}>
            <div className={s.emptyIcon}>🤖</div>
            <p className={s.emptyHint}>Напишите задачу или выберите пример:</p>
            <div className={s.exampleList}>
              {EXAMPLES.map(ex => (
                <button key={ex} className={s.exampleBtn} onClick={() => send(ex)}>
                  💬 {ex}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => {
          if (msg.kind === 'user')     return <UserBubble     key={i} text={msg.text} />
          if (msg.kind === 'thinking') return <ThinkingBubble key={i} text={msg.text} />
          if (msg.kind === 'plan')     return <PlanCard        key={i} plan={msg.plan} onDeploy={deploy} deploying={deploying} />
          if (msg.kind === 'deploy')   return <DeployTimeline  key={i} steps={msg.steps} />
          if (msg.kind === 'error')    return <ErrorBubble     key={i} text={msg.text} />
          return null
        })}

        {streaming && <ThinkingBubble isLoading />}
        <div ref={bottomRef} />
      </div>

      {/* ── Ввод ─────────────────────────────────────────────────────────── */}
      <div className={s.inputRow}>
        <textarea
          className={s.textarea}
          value={input}
          onChange={e => setInput(e.target.value)}
          disabled={isDisabled}
          rows={2}
          placeholder="Опишите задачу... (Enter — отправить, Shift+Enter — перенос строки)"
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input) } }}
        />
        <button
          className={`${s.sendBtn} ${canSend ? s.sendBtnActive : s.sendBtnDisabled}`}
          onClick={() => send(input)}
          disabled={!canSend}
        >
          {streaming ? '⏳' : '➤'}
        </button>
      </div>
    </div>
  )
}

function UserBubble({ text }: { text: string }) {
  return (
    <div className={s.userRow}>
      <div className={s.userBubble}>{text}</div>
    </div>
  )
}

function ErrorBubble({ text }: { text: string }) {
  return <div className={s.errorBubble}>⚠️ {text}</div>
}