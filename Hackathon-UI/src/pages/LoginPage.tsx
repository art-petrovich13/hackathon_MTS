// src/pages/LoginPage.tsx
import { useState, useEffect, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useAuth } from '../context/AuthContext'
import styles from './LoginPage.module.css'
import './LoginPage.mobile.css'
import './LoginPage.mobile.css'

export function LoginPage() {
  const { login, user } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')

  useEffect(() => {
    if (user) {
      navigate(user.role === 'admin' ? '/admin/vms' : '/dashboard', { replace: true })
    }
  }, [user, navigate])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    if (!email.trim() || !password) {
      setError('Введите email и пароль')
      return
    }
    setLoading(true)
    try {
      await login({ email: email.trim(), password })
      toast.success('Добро пожаловать!')
    } catch {
      setError('Неверный email или пароль')
      toast.error('Ошибка авторизации')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>

        {/* ── Логотип ─────────────────────────────────────────────────────── */}
        <div className={styles.logo}>
          <div className={styles.logoIcon}>⬡</div>
          <h1 className={styles.logoTitle}>
            MTS<em>Cloud</em>
          </h1>
          <p className={styles.logoSubtitle}>Войдите в свой аккаунт</p>
        </div>

        {/* ── Форма ───────────────────────────────────────────────────────── */}
        <form className={styles.form} onSubmit={handleSubmit}>

          <div>
            <label className={styles.label}>Email</label>
            <input
              className={styles.input}
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="admin@iaas.local"
              autoFocus
            />
          </div>

          <div>
            <label className={styles.label}>Пароль</label>
            <input
              className={styles.input}
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>

          {error && (
            <div className={styles.error}>⚠ {error}</div>
          )}

          <button
            className={styles.btnSubmit}
            type="submit"
            disabled={loading}
          >
            {loading ? 'Входим...' : 'Войти →'}
          </button>
        </form>

        {/* ── Demo credentials ────────────────────────────────────────────── */}
        <div className={styles.demo}>
          <strong className={styles.demoTitle}>Demo credentials:</strong><br />
          Admin: <code className={styles.demoCode}>admin@iaas.local</code> / <code className={styles.demoCode}>admin123</code><br />
          User: <code className={styles.demoCode}>user@example.com</code> / <code className={styles.demoCode}>user123</code>
        </div>

      </div>
    </div>
  )
}