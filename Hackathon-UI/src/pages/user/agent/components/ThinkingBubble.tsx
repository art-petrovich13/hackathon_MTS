import s from './AgentPage.module.css'

interface ThinkingBubbleProps {
  text?: string
  isLoading?: boolean
}

export function ThinkingBubble({ text, isLoading }: ThinkingBubbleProps) {
  return (
    <div className={s.agentRow}>
      <div className={s.avatar}>🤖</div>
      <div className={s.thinkingBubble}>
        {isLoading ? (
          <span className={s.thinkingLoading}>
            <span className={s.dot}>●</span>
            <span className={s.dot}>●</span>
            <span className={s.dot}>●</span>
            <span className={s.thinkingLoadingText}>агент думает...</span>
          </span>
        ) : (
          <p className={s.thinkingText}>{text}</p>
        )}
      </div>
    </div>
  )
}