import { useQuery } from '@tanstack/react-query'
import { getUsers } from '../../api/api'
import type { UserWithProject } from '../../types/api'
import s from '../../pages/shared.module.css'

interface UserFilterProps {
  selectedUserId: string | null  // null = "все"
  onChange: (userId: string | null) => void
  label?: string
}

export function UserFilter({ selectedUserId, onChange, label = 'Фильтр по пользователю' }: UserFilterProps) {
  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: getUsers,
    staleTime: 60_000, // кешируем на 1 минуту
  })

  return (
    <div style={{ marginBottom: 16 }}>
      <span style={{ fontSize: 12, color: '#64748b', marginBottom: 8, display: 'block' }}>
        {label}
      </span>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {/* Кнопка "Все пользователи" */}
        <button
          onClick={() => onChange(null)}
          style={{
            padding: '6px 14px',
            borderRadius: 20,
            fontSize: 12,
            fontWeight: selectedUserId === null ? 700 : 400,
            border: `1px solid ${selectedUserId === null ? '#3b82f6' : '#1e293b'}`,
            background: selectedUserId === null ? 'rgba(59,130,246,0.15)' : 'transparent',
            color: selectedUserId === null ? '#3b82f6' : '#64748b',
            cursor: 'pointer',
          }}
        >
          👥 Все ({users.length})
        </button>

        {/* По одной кнопке на каждого пользователя */}
        {users.map(u => (
          <button
            key={u.id}
            onClick={() => onChange(u.id)}
            title={`${u.email} · ${u.role}`}
            style={{
              padding: '6px 14px',
              borderRadius: 20,
              fontSize: 12,
              fontWeight: selectedUserId === u.id ? 700 : 400,
              border: `1px solid ${selectedUserId === u.id ? '#3b82f6' : '#1e293b'}`,
              background: selectedUserId === u.id ? 'rgba(59,130,246,0.15)' : 'transparent',
              color: selectedUserId === u.id ? '#3b82f6' : '#94a3b8',
              cursor: 'pointer',
              maxWidth: 180,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {u.role === 'admin' ? '🔑' : '👤'} {u.email.split('@')[0]}
          </button>
        ))}
      </div>
    </div>
  )
}