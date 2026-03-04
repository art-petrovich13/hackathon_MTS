// ─── ThinkingBubble ───────────────────────────────────────────────────────────

interface ThinkingBubbleProps {
  text?: string
  isLoading?: boolean
}

export function ThinkingBubble({ text, isLoading }: ThinkingBubbleProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
      <div style={{
        width: 32, height: 32, borderRadius: '50%', background: '#1d4ed8', flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16,
      }}>🤖</div>
      <div style={{
        background: '#1e293b', border: '1px solid #334155',
        borderRadius: '4px 18px 18px 18px',
        padding: '10px 14px', maxWidth: '80%',
      }}>
        {isLoading ? (
          <span style={{ color: '#60a5fa', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 8, animation: 'pulse 0.8s infinite' }}>●</span>
            <span style={{ fontSize: 8, animation: 'pulse 0.8s 0.3s infinite' }}>●</span>
            <span style={{ fontSize: 8, animation: 'pulse 0.8s 0.6s infinite' }}>●</span>
            <span style={{ marginLeft: 2 }}>агент думает...</span>
          </span>
        ) : (
          <p style={{ margin: 0, color: '#94a3b8', fontSize: 13, lineHeight: 1.5 }}>{text}</p>
        )}
      </div>
    </div>
  )
}
