import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

interface Props {
  requiredRole?: 'admin' | 'user'
}

export function ProtectedRoute({ requiredRole }: Props) {
  const { user } = useAuth()

  // Не залогинен — на страницу логина
  if (!user) {
    return <Navigate to="/login" replace />
  }

  // Залогинен, но не подходит роль (user пытается зайти в /admin)
  if (requiredRole === 'admin' && user.role !== 'admin') {
    return <Navigate to="/dashboard" replace />
  }

  // Всё ок — рендерим вложенные роуты
  return <Outlet />
}