import { useQuery } from '@tanstack/react-query'
import { getUsers } from '../../api/api'
import s from './ui.module.css'

interface UserFilterProps {
  selectedUserId: string | null
  onChange: (userId: string | null) => void
  label?: string
}

export function UserFilter({ selectedUserId, onChange, label = 'Фильтр по пользователю' }: UserFilterProps) {
  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: getUsers,
    staleTime: 60_000,
  })

  return (
    <div className={s.filterWrap}>
      <span className={s.filterLabel}>{label}</span>
      <div className={s.filterBtns}>
        <button
          className={`${s.filterBtn} ${selectedUserId === null ? s.filterBtnActive : ''}`}
          onClick={() => onChange(null)}
        >
          👥 Все ({users.length})
        </button>
        {users.map(u => (
          <button
            key={u.id}
            className={`${s.filterBtn} ${selectedUserId === u.id ? s.filterBtnActive : ''}`}
            onClick={() => onChange(u.id)}
            title={`${u.email} · ${u.role}`}
          >
            {u.role === 'admin' ? '🔑' : '👤'} {u.email.split('@')[0]}
          </button>
        ))}
      </div>
    </div>
  )
}