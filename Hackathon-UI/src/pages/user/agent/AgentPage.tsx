import { AgentChat } from './components/AgentChat'

export function AgentPage() {
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ paddingBottom: 14, borderBottom: '1px solid var(--color-border, #334155)' }}>
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#f1f5f9', display: 'flex', alignItems: 'center', gap: 10 }}>
          🤖 AgentMesh
          <span style={{
            fontSize: 11, background: '#1d4ed8', color: '#bfdbfe',
            padding: '2px 9px', borderRadius: 20, fontWeight: 600, letterSpacing: '0.05em',
          }}>NEW</span>
        </h1>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b' }}>
          Опишите задачу — агент спроектирует и развернёт инфраструктуру автоматически
        </p>
      </div>
      <AgentChat />
    </div>
  )
}
