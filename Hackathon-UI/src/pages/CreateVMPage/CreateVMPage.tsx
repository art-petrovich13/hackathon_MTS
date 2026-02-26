// src/pages/CreateVMPage.tsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getFlavors, getImages, createVM, type Flavor, type Image } from '../../api/api'
import s from '../shared.module.css'
import styles from './CreateVMPage.module.css'

// ── Временный project_id до дня 13 (аутентификация) ─────────────────────
// Замени на реальный UUID из БД: SELECT id FROM projects LIMIT 1;
const DEFAULT_PROJECT_ID = '18b192b4-57c2-4f9e-ad30-135160284b1d'

export function CreateVMPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()

  const [name, setName] = useState('')
  const [flavorId, setFlavorId] = useState('')
  const [imageId, setImageId] = useState('')
  const [formError, setFormError] = useState('')

  const { data: flavors = [], isLoading: loadFlavors } = useQuery({ queryKey: ['flavors'], queryFn: getFlavors })
  const { data: images = [], isLoading: loadImages } = useQuery({ queryKey: ['images'], queryFn: getImages })

  const mutation = useMutation({
    mutationFn: createVM,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vms'] })
      navigate('/vms')
    },
    onError: (err: any) => {
      setFormError(err.response?.data?.message ?? 'Failed to create VM. Check backend logs.')
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setFormError('')
    if (!name.trim()) return setFormError('VM name is required')
    if (!flavorId) return setFormError('Please select a flavor')
    if (!imageId) return setFormError('Please select an image')
    mutation.mutate({
      name: name.trim(),
      project_id: DEFAULT_PROJECT_ID,
      flavor_id: flavorId,
      image_id: imageId,
    })
  }

  const loading = loadFlavors || loadImages

  return (
    <div className={styles.page}>
      {/* ── Заголовок ──────────────────────────────────────────────── */}
      <div className={styles.header}>
        <button className={styles.back} onClick={() => navigate('/vms')}>
          ← Virtual Machines
        </button>
        <h1 className={s.pageTitle}>Create Virtual Machine</h1>
        <p className={s.pageSubtitle}>
          VM is created asynchronously — status changes to Running in a few seconds.
        </p>
      </div>

      {loading && (
        <div className={s.stateBox}>
          <div className={s.stateIcon}>◉</div>
          <p className={s.stateText}>Loading configuration…</p>
        </div>
      )}

      {!loading && (
        <form className={styles.form} onSubmit={handleSubmit} noValidate>

          {/* ── Имя ────────────────────────────────────────────────── */}
          <Section title="Name" hint="Unique identifier for your VM">
            <input
              className={styles.input}
              type="text"
              placeholder="e.g. web-server-01"
              value={name}
              onChange={e => setName(e.target.value)}
              autoFocus
              maxLength={64}
            />
          </Section>

          {/* ── Flavor ─────────────────────────────────────────────── */}
          <Section title="Flavor" hint="CPU and RAM configuration">
            <div className={styles.flavorGrid}>
              {flavors.map(f => (
                <FlavorCard
                  key={f.id}
                  flavor={f}
                  selected={flavorId === f.id}
                  onClick={() => setFlavorId(f.id)}
                />
              ))}
            </div>
          </Section>

          {/* ── Image ──────────────────────────────────────────────── */}
          <Section title="Image" hint="Operating system for your VM">
            <div className={styles.imageList}>
              {images.map(img => (
                <ImageRow
                  key={img.id}
                  image={img}
                  selected={imageId === img.id}
                  onClick={() => setImageId(img.id)}
                />
              ))}
            </div>
          </Section>

          {/* ── Ошибка ─────────────────────────────────────────────── */}
          {formError && (
            <div className={styles.errorBox}>
              <span className={styles.errorIcon}>⚠</span>
              {formError}
            </div>
          )}

          {/* ── Кнопки ─────────────────────────────────────────────── */}
          <div className={styles.footer}>
            <button type="button" className={styles.btnCancel} onClick={() => navigate('/vms')}>
              Cancel
            </button>
            <button type="submit" className={s.btnPrimary} disabled={mutation.isPending}>
              {mutation.isPending ? 'Creating…' : 'Create VM →'}
            </button>
          </div>

        </form>
      )}
    </div>
  )
}

// ── Секция формы ──────────────────────────────────────────────────────────
function Section({ title, hint, children }: {
  title: string; hint?: string; children: React.ReactNode
}) {
  return (
    <div className={styles.section}>
      <div className={styles.sectionHeader}>
        <span className={styles.sectionTitle}>{title}</span>
        {hint && <span className={styles.sectionHint}>{hint}</span>}
      </div>
      {children}
    </div>
  )
}

// ── Flavor card ───────────────────────────────────────────────────────────
function FlavorCard({ flavor, selected, onClick }: {
  flavor: Flavor; selected: boolean; onClick: () => void
}) {
  const ram = flavor.ram_mb >= 1024
    ? `${flavor.ram_mb / 1024} GB`
    : `${flavor.ram_mb} MB`

  return (
    <button
      type="button"
      className={`${styles.flavorCard} ${selected ? styles.selected : ''}`}
      onClick={onClick}
    >
      {selected && <span className={styles.checkmark}>✓</span>}
      <span className={styles.flavorName}>{flavor.name}</span>
      <span className={styles.flavorSpec}>{flavor.cpu} vCPU</span>
      <span className={styles.flavorSpec}>{ram} RAM</span>
      <span className={styles.flavorSpec}>{flavor.disk_gb} GB Disk</span>
    </button>
  )
}

// ── Image row ─────────────────────────────────────────────────────────────
function ImageRow({ image, selected, onClick }: {
  image: Image; selected: boolean; onClick: () => void
}) {
  return (
    <button
      type="button"
      className={`${styles.imageRow} ${selected ? styles.selected : ''}`}
      onClick={onClick}
    >
      <div className={styles.imageIcon}>◉</div>
      <div className={styles.imageInfo}>
        <span className={styles.imageName}>{image.name}</span>
        <span className={styles.imageTag}>{image.docker_image}</span>
      </div>
      <div className={styles.imageMeta}>
        <span className={styles.imageVer}>{image.version}</span>
        <span className={styles.imageOs}>{image.os_type}</span>
      </div>
      {selected && <span className={styles.checkmark}>✓</span>}
    </button>
  )
}