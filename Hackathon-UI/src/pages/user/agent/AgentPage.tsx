import { AgentChat } from './components/AgentChat'
import styles from './components/AgentPage.module.css'

export function AgentPage() {
  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>
          🤖 Cloud Agent
          <span className={styles.badge}>NEW</span>
        </h1>
        <p className={styles.subtitle}>
          Опишите задачу — агент спроектирует и развернёт инфраструктуру автоматически
        </p>
      </div>
      <AgentChat />
    </div>
  )
}