// src/pages/NotFoundPage.tsx
import { Link } from 'react-router-dom'
import styles from './NotFoundPage.module.css'

export function NotFoundPage() {
  return (
    <div className={styles.page}>
      <span className={styles.code}>404</span>
      <p className={styles.msg}>Page not found</p>
      <Link to="/vms" className={styles.link}>← Back to Virtual Machines</Link>
    </div>
  )
}