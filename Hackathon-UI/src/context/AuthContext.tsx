import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'
import type { AuthUser, LoginRequest } from '../types/api'
import { login as apiLogin } from '../api/api'

interface AuthState {
  user: AuthUser | null
  token: string | null
  isAdmin: boolean
  login: (payload: LoginRequest) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthState | null>(null)

// Восстанавливаем сессию при перезагрузке страницы
function loadSession(): { user: AuthUser | null; token: string | null } {
  try {
    const token   = sessionStorage.getItem('auth_token')
    const userStr = sessionStorage.getItem('auth_user')
    if (token && userStr) {
      return { token, user: JSON.parse(userStr) as AuthUser }
    }
  } catch {
    // ignore — невалидный JSON в storage
  }
  return { user: null, token: null }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [{ user, token }, setSession] = useState(loadSession)

  const login = useCallback(async (payload: LoginRequest) => {
    const response = await apiLogin(payload)
    sessionStorage.setItem('auth_token', response.token)
    sessionStorage.setItem('auth_user', JSON.stringify(response.user))
    setSession({ user: response.user, token: response.token })
  }, [])

  const logout = useCallback(() => {
    sessionStorage.removeItem('auth_token')
    sessionStorage.removeItem('auth_user')
    setSession({ user: null, token: null })
  }, [])

  return (
    <AuthContext.Provider value={{
      user,
      token,
      isAdmin: user?.role === 'admin',
      login,
      logout,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}