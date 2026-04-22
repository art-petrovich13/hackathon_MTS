import { useState } from 'react'
import { X, Eye, EyeOff, Copy, Check, ExternalLink } from 'lucide-react'
import s from './ui.module.css'

export interface CredField {
  label: string
  value: string
  secret?: boolean
  isLink?: boolean
  copyable?: boolean
}

interface Props {
  title: string
  fields: CredField[]
  onClose: () => void
}

export function CredentialsModal({ title, fields, onClose }: Props) {
  const [shown, setShown]   = useState<Set<string>>(new Set())
  const [copied, setCopied] = useState<string | null>(null)

  const toggleShow = (label: string) =>
    setShown(s => { const n = new Set(s); n.has(label) ? n.delete(label) : n.add(label); return n })

  const copy = (label: string, value: string) => {
    navigator.clipboard.writeText(value)
    setCopied(label)
    setTimeout(() => setCopied(null), 1800)
  }

  return (
    <div className={s.overlay} onClick={onClose}>
      <div className={s.modal} onClick={e => e.stopPropagation()}>

        <div className={s.modalHeader}>
          <span className={s.modalTitle}>🔑 {title}</span>
          <button className={s.modalCloseBtn} onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className={s.credFields}>
          {fields.map(f => {
            const isVisible = !f.secret || shown.has(f.label)
            const display   = isVisible ? f.value : '••••••••••'
            const isCopied  = copied === f.label
            return (
              <div key={f.label} className={s.credField}>
                <div className={s.credFieldLabel}>{f.label}</div>
                <div className={s.credFieldRow}>
                  <span className={s.credFieldValue}>
                    {f.isLink
                      ? <a href={f.value} target="_blank" rel="noreferrer" className={s.credFieldLink}>{display}</a>
                      : display
                    }
                  </span>
                  {f.isLink && (
                    <a href={f.value} target="_blank" rel="noreferrer" className={s.credIconBtn}>
                      <ExternalLink size={13} />
                    </a>
                  )}
                  {f.secret && (
                    <button className={s.credIconBtn} onClick={() => toggleShow(f.label)}>
                      {shown.has(f.label) ? <EyeOff size={13} /> : <Eye size={13} />}
                    </button>
                  )}
                  {f.copyable !== false && (
                    <button
                      className={`${s.credIconBtn} ${isCopied ? s.credIconBtnCopied : ''}`}
                      onClick={() => copy(f.label, f.value)}
                    >
                      {isCopied ? <Check size={13} /> : <Copy size={13} />}
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        <button className={s.modalFooterBtn} onClick={onClose}>Закрыть</button>
      </div>
    </div>
  )
}