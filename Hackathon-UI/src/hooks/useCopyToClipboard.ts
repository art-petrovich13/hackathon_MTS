import { useState, useCallback } from 'react'
import toast from 'react-hot-toast'

export function useCopyToClipboard(resetMs = 1800) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null)

  const copy = useCallback((text: string, key = 'default') => {
    navigator.clipboard.writeText(text)
      .then(() => {
        setCopiedKey(key)
        toast.success('Скопировано!', { duration: 1500 })
        setTimeout(() => setCopiedKey(null), resetMs)
      })
      .catch(() => toast.error('Не удалось скопировать'))
  }, [resetMs])

  return { copiedKey, copy }
}