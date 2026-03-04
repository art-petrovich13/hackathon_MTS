// src/pages/CreateVMPage.tsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getFlavors, getImages, createVM } from '../../../api/api'
import { type Image } from "../../../types/api"
import type { Flavor } from '../../../types/api'
import s from '../../shared.module.css'
import styles from './CreateVMPage.module.css'

const DEFAULT_PROJECT_ID = '9d320322-31f5-48d5-ade8-43f1b03b5b59'

export function CreateVMPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()

  const [name, setName] = useState('')
  const [flavorId, setFlavorId] = useState('')
  const [imageId, setImageId] = useState('')
  const [formError, setFormError] = useState('')

  
  const { data: flavors = [], isLoading: loadFlavors } = useQuery({
  queryKey: ['flavors', 'compute'],
  queryFn: () => getFlavors('compute'),
})
  const { data: images = [], isLoading: loadImages } = useQuery({ queryKey: ['images'], queryFn: getImages })

  const mutation = useMutation({
    mutationFn: createVM,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vms'] })
      navigate('/admin/vms')
    },
    onError: (err: any) => {
      setFormError(err.response?.data?.message ?? 'Failed to create VM.')
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setFormError('')
    if (!name.trim()) return setFormError('VM name is required')
    if (!flavorId) return setFormError('Please select a flavor')
    if (!imageId) return setFormError('Please select an image')
    mutation.mutate({ name: name.trim(), project_id: DEFAULT_PROJECT_ID, flavor_id: flavorId, image_id: imageId })
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

        {/* ── Name ───────────────────────────────────────────────────── */}
        <div className={styles.section}>
          <label className={styles.sectionTitle}>VM Name</label>
          <input
            className={styles.input}
            type="text"
            placeholder="e.g. web-server-01"
            value={name}
            onChange={e => setName(e.target.value)}
            autoFocus
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