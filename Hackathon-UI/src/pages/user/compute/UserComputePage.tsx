import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { getVMs, startVM, stopVM, deleteVM } from '../../../api/api'
import type { VirtualMachine } from '../../../types/api'
import { StatusBadge } from '../../../components/ui/StatusBadge'
import s from '../../shared.module.css'
import { VncViewer } from '../../../components/ui/VncViewer'

const TRANSITIONAL = new Set(['pending', 'creating', 'pending-start', 'pending-stop'])

export function UserComputePage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [viewVm, setViewVm] = useState<VirtualMachine | null>(null)

  const { data: vms = [], isLoading, isError } = useQuery<VirtualMachine[]>({
    queryKey: ['vms'],
    queryFn: getVMs,
    refetchInterval: (query) => {
      const data = query.state.data as VirtualMachine[] | undefined
      return data?.some(v => TRANSITIONAL.has(v.status)) ? 3_000 : 10_000
    },
  })

  const invalidate = () => qc.invalidateQueries({ queryKey: ['vms'] })

  const startMut = useMutation({ mutationFn: startVM, onSuccess: () => { invalidate(); toast.success('VM запускается...') }, onError: () => toast.error('Ошибка запуска VM') })
  const stopMut = useMutation({ mutationFn: stopVM, onSuccess: () => { invalidate(); toast.success('VM останавливается...') }, onError: () => toast.error('Ошибка остановки VM') })
  const deleteMut = useMutation({
    mutationFn: deleteVM,
    onSuccess: () => { invalidate(); setConfirmDeleteId(null); toast.success('VM удалена') },
    onError: () => toast.error('Ошибка удаления VM'),
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
      <div className={s.pageHeader}>
        <div>
          <h1 className={s.pageTitle}>Compute</h1>
          <p className={s.pageSubtitle}>{vms.length} virtual machine{vms.length !== 1 ? 's' : ''}</p>
        </div>
        <button className={s.btnPrimary} onClick={() => navigate('/admin/vms/create')}>
          + New VM
        </button>
      </div>

      {isLoading && (
        <div className={s.stateBox}>
          <div className={s.stateIcon}>🖥️</div>
          <p className={s.stateText}>Loading VMs…</p>
        </div>
      )}
      {isError && (
        <div className={s.stateBox}>
          <p className={s.stateTextErr}>Failed to load VMs.</p>
        </div>
      )}
      {!isLoading && !isError && vms.length === 0 && (
        <div className={s.stateBox}>
          <div className={s.stateIcon} style={{ fontSize: 48, opacity: 0.2 }}>🖥️</div>
          <p className={s.stateText}>No virtual machines yet</p>
          <button className={s.btnPrimary} style={{ marginTop: 12 }} onClick={() => navigate('/admin/vms/create')}>
            + Create first VM
          </button>
        </div>
      )}

      {!isLoading && !isError && vms.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
          {vms.map(vm => (
            <VMCard
              key={vm.id}
              vm={vm}
              isConfirming={confirmDeleteId === vm.id}
              onStart={() => startMut.mutate(vm.id)}
              onStop={() => stopMut.mutate(vm.id)}
              onDeleteRequest={() => setConfirmDeleteId(vm.id)}
              onDeleteConfirm={() => deleteMut.mutate(vm.id)}
              onDeleteCancel={() => setConfirmDeleteId(null)}
              deletePending={deleteMut.isPending}
              onViewScreen={vm.novnc_port ? () => setViewVm(vm) : undefined}
            />
          ))}
        </div>
      )}
      {viewVm && viewVm.novnc_port && (
        <VncViewer
          host={viewVm.ip_address ?? '127.0.0.1'}
          port={viewVm.novnc_port}
          title={`Linux VM — ${viewVm.name}`}
          onClose={() => setViewVm(null)}
        />
      )}
    </div>
  )
}

function VMCard({
  vm, isConfirming,
  onStart, onStop, onDeleteRequest, onDeleteConfirm, onDeleteCancel, deletePending,
  onViewScreen,
}: {
  vm: VirtualMachine
  isConfirming: boolean
  onStart: () => void
  onStop: () => void
  onDeleteRequest: () => void
  onDeleteConfirm: () => void
  onDeleteCancel: () => void
  deletePending: boolean
  onViewScreen?: () => void   // ← ДОБАВИТЬ (опциональный)
}) {
  const trans = TRANSITIONAL.has(vm.status)

  return (
    <div style={{
      background: 'var(--bg-surface)', border: '1px solid var(--border)',
      borderRadius: 12, padding: 20,
      display: 'flex', flexDirection: 'column', gap: 14,
    }}>
      {/* Шапка */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <span style={{ fontSize: 28 }}>🖥️</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-pri)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {vm.name}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 2, fontFamily: 'monospace' }}>
            {vm.ip_address ?? 'No IP assigned'}
          </div>
        </div>
        <StatusBadge status={vm.status} />
      </div>

      {/* Детали */}
      <div style={{ fontSize: 12, color: 'var(--text-sec)', display: 'flex', flexDirection: 'column', gap: 3 }}>
        <span>Container: <code style={{ fontFamily: 'monospace', color: 'var(--text-dim)' }}>{vm.docker_container_id?.slice(0, 12) ?? '—'}</code></span>
        <span>Created: {new Date(vm.created_at).toLocaleString('ru-RU')}</span>
      </div>

      {/* Действия */}
      <div style={{ display: 'flex', gap: 8 }}>
        {vm.status === 'stopped' && (
          <button disabled={trans} onClick={onStart}
            style={{
              flex: 1, padding: '7px 0', borderRadius: 7, border: 'none',
              background: '#14532d', color: '#4ade80', cursor: 'pointer', fontWeight: 600, fontSize: 13
            }}>
            ▶ Запустить
          </button>
        )}

        {/* ← ДОБАВИТЬ: кнопка просмотра экрана для VNC-образов */}
        {vm.status === 'running' && onViewScreen && (
          <button
            onClick={onViewScreen}
            style={{
              padding: '7px 10px', borderRadius: 7, border: 'none',
              background: 'rgba(99,102,241,0.15)',
              color: '#818cf8', cursor: 'pointer', fontSize: 13,
            }}
            title="Просмотр экрана VM"
          >
            🖥️
          </button>
        )}

        {vm.status === 'running' && (
          <button disabled={trans} onClick={onStop}
            style={{
              flex: 1, padding: '7px 0', borderRadius: 7, border: 'none',
              background: '#431407', color: '#fb923c', cursor: 'pointer', fontWeight: 600, fontSize: 13
            }}>
            ■ Остановить
          </button>
        )}

        {/* Кнопка удаления без window.confirm */}
        {isConfirming ? (
          <>
            <button onClick={onDeleteConfirm} disabled={deletePending}
              style={{
                padding: '7px 12px', borderRadius: 7, border: 'none',
                background: '#4a0f0f', color: '#f87171', cursor: 'pointer', fontWeight: 600, fontSize: 13
              }}>
              {deletePending ? '...' : 'Удалить?'}
            </button>
            <button onClick={onDeleteCancel}
              style={{
                padding: '7px 12px', borderRadius: 7, border: '1px solid var(--border)',
                background: 'transparent', color: 'var(--text-sec)', cursor: 'pointer', fontSize: 13
              }}>
              Нет
            </button>
          </>
        ) : (
          <button disabled={trans} onClick={onDeleteRequest}
            style={{
              padding: '7px 14px', borderRadius: 7, border: 'none',
              background: '#3f1212', color: '#f87171', cursor: 'pointer', fontWeight: 600, fontSize: 13,
              opacity: trans ? 0.4 : 1
            }}>
            ✕
          </button>
        )}
      </div>

    </div>
  )
}