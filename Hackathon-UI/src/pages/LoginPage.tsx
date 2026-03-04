import { useState, useEffect, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useAuth } from '../context/AuthContext'

export function LoginPage() {
  const { login, user } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')

  // Если уже залогинен — редиректим сразу
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
      // useEffect выше сделает редирект когда обновится user
    } catch {
      setError('Неверный email или пароль')
      toast.error('Ошибка авторизации')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        width: 420, padding: '40px 36px', borderRadius: 20,
        background: 'rgba(30,41,59,0.85)',
        border: '1px solid rgba(99,102,241,0.2)',
        backdropFilter: 'blur(20px)',
        boxShadow: '0 25px 50px rgba(0,0,0,0.5)',
      }}>
        {/* Логотип */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>⬡</div>
          <h1 style={{
            margin: 0, fontSize: 24, fontWeight: 800,
            color: '#f1f5f9', letterSpacing: '-0.03em',
          }}>
            IaaS<em style={{ fontStyle: 'italic', color: '#818cf8' }}>Panel</em>
          </h1>
          <p style={{ margin: '6px 0 0', color: '#64748b', fontSize: 13 }}>
            Войдите в свой аккаунт
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Email */}
          <div>
            <label style={labelSt}>Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="admin@iaas.local"
              autoFocus
              style={inputSt}
            />
          </div>

          {/* Password */}
          <div>
            <label style={labelSt}>Пароль</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              style={inputSt}
            />
          </div>

          {/* Ошибка */}
          {error && (
            <div style={{
              padding: '10px 14px', borderRadius: 8,
              background: 'rgba(239,68,68,0.1)',
              border: '1px solid rgba(239,68,68,0.3)',
              color: '#f87171', fontSize: 13,
            }}>
              ⚠ {error}
            </div>
          )}

          {/* Кнопка входа */}
          <button
            type="submit"
            disabled={loading}
            style={{
              padding: '13px 20px', borderRadius: 10, border: 'none',
              background: loading
                ? 'rgba(99,102,241,0.4)'
                : 'linear-gradient(135deg, #6366f1, #818cf8)',
              color: '#fff', fontWeight: 700, fontSize: 15,
              cursor: loading ? 'not-allowed' : 'pointer',
              marginTop: 4, transition: 'opacity 0.2s',
            }}
          >
            {loading ? 'Входим...' : 'Войти →'}
          </button>
        </form>

        {/* Demo credentials подсказка */}
        <div style={{
          marginTop: 24, padding: '12px 14px', borderRadius: 8,
          background: 'rgba(99,102,241,0.06)',
          border: '1px solid rgba(99,102,241,0.15)',
          fontSize: 12, color: '#64748b', lineHeight: 1.7,
        }}>
          <strong style={{ color: '#94a3b8' }}>Demo credentials:</strong><br />
          Admin: <code>admin@iaas.local</code> / <code>admin123</code><br />
          User: <code>user@example.com</code> / <code>user123</code>
        </div>
      </div>
    </div>
  )
}

const labelSt: React.CSSProperties = {
  display: 'block', fontSize: 11, fontWeight: 700,
  color: '#64748b', marginBottom: 6,
  textTransform: 'uppercase', letterSpacing: '0.08em',
}

const inputSt: React.CSSProperties = {
  width: '100%', padding: '12px 16px', borderRadius: 10,
  border: '1px solid rgba(99,102,241,0.3)',
  background: 'rgba(15,23,42,0.6)',
  color: '#f1f5f9', fontSize: 14, outline: 'none',
  boxSizing: 'border-box',
}