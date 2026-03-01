import { useState } from 'react'
import { X, Eye, EyeOff, Copy, Check, ExternalLink } from 'lucide-react'

export interface CredField {
  label: string
  value: string
  secret?: boolean
  isLink?: boolean
  copyable?: boolean   // default: true
}

interface Props {
  title: string
  fields: CredField[]
  onClose: () => void
}

export function CredentialsModal({ title, fields, onClose }: Props) {
  const [shown, setShown] = useState<Set<string>>(new Set())
  const [copied, setCopied] = useState<string | null>(null)

  const toggleShow = (label: string) =>
    setShown(s => {
      const n = new Set(s)
      n.has(label) ? n.delete(label) : n.add(label)
      return n
    })

  const copy = (label: string, value: string) => {
    navigator.clipboard.writeText(value)
    setCopied(label)
    setTimeout(() => setCopied(null), 1800)
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--color-surface, #1e293b)',
          border: '1px solid var(--color-border, #334155)',
          borderRadius: 14, padding: 24, width: 420, maxWidth: '90vw',
          boxShadow: '0 25px 60px rgba(0,0,0,0.5)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <span style={{ fontWeight: 700, fontSize: 16 }}>🔑 {title}</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {fields.map(f => {
            const isVisible = !f.secret || shown.has(f.label)
            const display = isVisible ? f.value : '••••••••••'
            const isCopied = copied === f.label

            return (
              <div key={f.label} style={{
                background: 'rgba(0,0,0,0.2)',
                border: '1px solid var(--color-border, #334155)',
                borderRadius: 8, padding: '8px 12px',
              }}>
                <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 3, fontWeight: 500 }}>
                  {f.label}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ flex: 1, fontSize: 13, fontFamily: 'monospace', wordBreak: 'break-all' }}>
                    {f.isLink
                      ? <a href={f.value} target="_blank" rel="noreferrer" style={{ color: '#60a5fa' }}>{display}</a>
                      : display
                    }
                  </span>
                  {f.isLink && (
                    <a href={f.value} target="_blank" rel="noreferrer" style={{ color: '#60a5fa' }}>
                      <ExternalLink size={13} />
                    </a>
                  )}
                  {f.secret && (
                    <button onClick={() => toggleShow(f.label)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 2 }}>
                      {shown.has(f.label) ? <EyeOff size={13} /> : <Eye size={13} />}
                    </button>
                  )}
                  {(f.copyable !== false) && (
                    <button onClick={() => copy(f.label, f.value)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer',
                        color: isCopied ? '#4ade80' : '#94a3b8', padding: 2 }}>
                      {isCopied ? <Check size={13} /> : <Copy size={13} />}
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        <button
          onClick={onClose}
          style={{
            marginTop: 18, width: '100%', padding: '10px 0',
            background: 'transparent',
            border: '1px solid var(--color-border, #334155)',
            borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 14,
          }}
        >
          Закрыть
        </button>
      </div>
    </div>
  )
}