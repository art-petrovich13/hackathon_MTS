// src/pages/admin/vms/CreateVMPage.tsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getFlavors, getImages, createVM, getUsers } from '../../../api/api'
import { useAuth } from '../../../context/AuthContext'
import { type Image } from '../../../types/api'
import type { Flavor, UserWithProject } from '../../../types/api'
import s from '../../shared.module.css'
import styles from './CreateVMPage.module.css'

export function CreateVMPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { user: me, isAdmin } = useAuth()

  const [name, setName] = useState('')
  const [flavorId, setFlavorId] = useState('')
  const [imageId, setImageId] = useState('')
  const [targetUserId, setTargetUserId] = useState<string>('')
  const [formError, setFormError] = useState('')

  const { data: flavors = [], isLoading: loadFlavors } = useQuery({
    queryKey: ['flavors', 'compute'],
    queryFn: () => getFlavors('compute'),
  })
  const { data: images = [], isLoading: loadImages } = useQuery({
    queryKey: ['images'],
    queryFn: getImages,
  })

  // Список пользователей — только для admin
  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: getUsers,
    enabled: isAdmin,
    staleTime: 60_000,
  })

  const mutation = useMutation({
    mutationFn: createVM,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vms'] })
      navigate('/admin/vms')
    },
    onError: (err: any) => {
      setFormError(err.response?.data?.error ?? err.response?.data?.message ?? 'Failed to create VM.')
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setFormError('')
    if (!name.trim()) return setFormError('VM name is required')
    if (!flavorId) return setFormError('Please select a flavor')
    if (!imageId) return setFormError('Please select an image')

    // Определяем project_id
    let projectId: string
    if (isAdmin) {
      // Для admin — обязательно выбрать целевого пользователя
      if (!targetUserId) return setFormError('Выберите пользователя, для которого создаётся VM')
      const targetUser = users.find(u => u.id === targetUserId)
      if (!targetUser?.project?.id) return setFormError('У выбранного пользователя нет проекта')
      projectId = targetUser.project.id
    } else {
      // Для user — свой project_id из токена
      if (!me?.project_id) return setFormError('Project ID not found. Try re-login.')
      projectId = me.project_id
    }

    mutation.mutate({
      name: name.trim(),
      project_id: projectId,
      flavor_id: flavorId,
      image_id: imageId,
    })
  }

  if (loadFlavors || loadImages) {
    return (
      <div className={s.stateBox}>
        <div className={s.stateIcon}>◉</div>
        <p className={s.stateText}>Loading…</p>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <button className={styles.backBtn} onClick={() => navigate('/admin/vms')}>← Back</button>
        <h1 className={s.pageTitle}>Create Virtual Machine</h1>
        <p className={s.pageSubtitle}>VM is created asynchronously — status changes to Running in a few seconds.</p>
      </div>

      <form className={styles.form} onSubmit={handleSubmit} noValidate>

        {/* ── Выбор пользователя (только для admin) ─────────────────────── */}
        {isAdmin && (
          <div className={styles.section}>
            <label className={styles.sectionTitle}>
              Создать для пользователя <span style={{ color: '#ef4444' }}>*</span>
            </label>
            {users.length === 0 ? (
              <p style={{ color: '#94a3b8', fontSize: 13 }}>Загрузка пользователей...</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {users.filter(u => u.role !== 'admin').map(u => {
                  const selected = targetUserId === u.id
                  return (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => setTargetUserId(u.id)}
                      style={{
                        padding: '10px 14px', borderRadius: 8, textAlign: 'left',
                        cursor: 'pointer',
                        border: `1px solid ${selected ? 'var(--accent)' : 'var(--border)'}`,
                        background: selected ? 'var(--accent-dim)' : 'transparent',
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      }}
                    >
                      <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-pri)' }}>
                        👤 {u.email}
                      </span>
                      <span style={{ fontSize: 11, color: '#94a3b8' }}>
                        {u.project?.id ? `project: ${u.project.id.slice(0, 8)}…` : 'нет проекта'}
                      </span>
                      {selected && <span style={{ color: 'var(--accent)', marginLeft: 8 }}>✓</span>}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* ── Name ───────────────────────────────────────────────────── */}
        <div className={styles.section}>
          <label className={styles.sectionTitle}>VM Name</label>
          <input
            className={styles.input}
            type="text"
            placeholder="e.g. web-server-01"
            value={name}
            onChange={e => setName(e.target.value)}
            autoFocus={!isAdmin}
            maxLength={64}
          />
        </div>

        {/* ── Flavor ─────────────────────────────────────────────────── */}
        <div className={styles.section}>
          <label className={styles.sectionTitle}>
            Flavor <span className={styles.sectionHint}>— CPU &amp; RAM configuration</span>
          </label>
          <div className={styles.flavorGrid}>
            {flavors.map(f => (
              <FlavorCard key={f.id} flavor={f} selected={flavorId === f.id} onClick={() => setFlavorId(f.id)} />
            ))}
          </div>
        </div>

        {/* ── Image ──────────────────────────────────────────────────── */}
        <div className={styles.section}>
          <label className={styles.sectionTitle}>
            Image <span className={styles.sectionHint}>— operating system</span>
          </label>
          <div className={styles.imageList}>
            {images.map(img => (
              <ImageRow key={img.id} image={img} selected={imageId === img.id} onClick={() => setImageId(img.id)} />
            ))}
          </div>
        </div>

        {/* ── Error ──────────────────────────────────────────────────── */}
        {formError && (
          <div className={styles.errorBox}>
            <span>⚠</span> {formError}
          </div>
        )}

        {/* ── Footer ─────────────────────────────────────────────────── */}
        <div className={styles.formFooter}>
          <button type="button" className={styles.btnCancel} onClick={() => navigate('/admin/vms')}>
            Cancel
          </button>
          <button type="submit" className={s.btnPrimary} disabled={mutation.isPending}>
            {mutation.isPending ? 'Creating…' : 'Create VM →'}
          </button>
        </div>

      </form>
    </div>
  )
}

function FlavorCard({ flavor, selected, onClick }: { flavor: Flavor; selected: boolean; onClick: () => void }) {
  const ram = flavor.ram_mb >= 1024 ? `${flavor.ram_mb / 1024} GB` : `${flavor.ram_mb} MB`
  return (
    <button type="button" className={`${styles.flavorCard} ${selected ? styles.selectedCard : ''}`} onClick={onClick}>
      {selected && <span className={styles.checkmark}>✓</span>}
      <span className={styles.flavorName}>{flavor.name}</span>
      <span className={styles.flavorSpec}>{flavor.cpu} vCPU</span>
      <span className={styles.flavorSpec}>{ram} RAM</span>
      <span className={styles.flavorSpec}>{flavor.disk_gb} GB Disk</span>
    </button>
  )
}

function ImageRow({ image, selected, onClick }: { image: Image; selected: boolean; onClick: () => void }) {
  return (
    <button type="button" className={`${styles.imageRow} ${selected ? styles.selectedCard : ''}`} onClick={onClick}>
      <div className={styles.imageIcon}>◉</div>
      <div className={styles.imageInfo}>
        <span className={styles.imageName}>{image.name}</span>
        <span className={styles.imageTag}>{image.docker_image}</span>
      </div>
      <div className={styles.imageMeta}>
        <span className={styles.imageVersion}>{image.version}</span>
        <span className={styles.imageOs}>{image.os_type}</span>
      </div>
      {selected && <span className={styles.checkmark}>✓</span>}
    </button>
  )
}